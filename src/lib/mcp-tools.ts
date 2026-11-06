import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "@/lib/db";
import { makeLocalizer } from "@/lib/localize-images";
import { MENU_KEY, defaultMenu, normalizeMenu } from "@/lib/menu";
import { getShop } from "@/lib/shop";
import { TAXONOMY_KEY, defaultTaxonomy, normalizeTaxonomy, type Taxonomy } from "@/lib/taxonomy";
import {
  deletePost, deleteProduct, refreshSite, savePost, saveProduct, saveShop, saveTaxonomy, togglePost, toggleProduct,
} from "@/lib/admin-service";

// The tools an AI client can call on /api/mcp. Every write goes through the same functions as the admin pages
// (lib/admin-service.ts), so the checks (links, images, HTML, unique paths...) are written once.
// Reading uses parameters only; nothing is put into SQL text.
export type Ctx = { keyName: string; origin: string };
type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

export const ok = (v: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }] });
export const fail = (message: string): Result => ({ isError: true, content: [{ type: "text", text: message }] });
// one line per write in the server log: which key, which tool, which row. Never the key itself.
export const logWrite = (ctx: Ctx, tool: string, detail: string) => console.log(`[mcp] key=${JSON.stringify(ctx.keyName)} tool=${tool} ${detail}`);

// read straight from the database (lib/repo.ts keeps its answer for the rest of a request, which would hide a change just saved)
export const readTaxonomy = async (): Promise<Taxonomy> => {
  const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [TAXONOMY_KEY]);
  return row ? normalizeTaxonomy(row.v) : defaultTaxonomy();
};
export const readMenu = async () => {
  const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [MENU_KEY]);
  return row ? normalizeMenu(row.v) : defaultMenu();
};

const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};
const strs = (v: unknown): string[] => asArray(v).map(String);
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;
const pageOf = (page: number | undefined, per: number | undefined) => {
  const perPage = Math.min(Math.max(per ?? 20, 1), 50);
  const p = Math.max(page ?? 1, 1);
  return { perPage, offset: (p - 1) * perPage, page: p };
};

// ---------------------------------------------------------------- products
type ProductRow = {
  id: number; slug: string; code: string | null; name: string; brand: string; types: unknown; price: number; price_max: number; img: string | null;
  gallery: unknown; colors: unknown; variants: unknown; specs: unknown; short_html: string; html: string; active: number;
};
const productView = (r: ProductRow) => ({
  id: r.id, slug: r.slug, code: r.code, name: r.name, brand: r.brand, types: strs(r.types), price: Number(r.price), priceMax: Number(r.price_max), img: r.img,
  gallery: strs(r.gallery), colors: strs(r.colors), variants: asArray(r.variants), specs: asArray(r.specs), shortHtml: r.short_html, html: r.html, active: !!r.active,
});
const getProduct = async (id: number) => (await query<ProductRow>("SELECT * FROM products WHERE id = ?", [id]))[0];

const variantSchema = z.object({
  attrs: z.array(z.object({ name: z.string(), value: z.string() })).describe("Các thuộc tính của dòng này, ví dụ [{name:'Màu sắc', value:'Đỏ'}]"),
  img: z.string().nullable().optional().describe("Ảnh của dòng này (/... hoặc https://...)"),
  price: z.number().optional().describe("Giá riêng của dòng này, 0 nếu dùng giá chung"),
});
const specSchema = z.object({ title: z.string(), items: z.array(z.object({ label: z.string(), value: z.string() })) });

// ---------------------------------------------------------------- posts
type PostRow = { id: number; slug: string; title: string; date: string; section: string; excerpt: string; img: string | null; html: string; published: number };
const postView = (r: PostRow) => ({ id: r.id, slug: r.slug, title: r.title, date: String(r.date).slice(0, 10), section: r.section, excerpt: r.excerpt, img: r.img, html: r.html, published: !!r.published });
const getPost = async (id: number) => (await query<PostRow>("SELECT * FROM posts WHERE id = ?", [id]))[0];

export const confirmDelete = z.literal(true).describe("Bắt buộc là true để xác nhận xoá. Không khôi phục được.");

export function registerTools(server: McpServer, ctx: Ctx): void {
  // ------------------------------------------------ overview
  server.registerTool(
    "tong_quan",
    { description: "Số xe, số bài viết, số đang ẩn, tên cửa hàng.", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => {
      const [p] = await query<{ total: number; shown: number | null }>("SELECT COUNT(*) AS total, SUM(active = 1) AS shown FROM products");
      const [a] = await query<{ total: number; shown: number | null }>("SELECT COUNT(*) AS total, SUM(published = 1) AS shown FROM posts");
      const shop = await getShop();
      return ok({
        cua_hang: shop.brand,
        xe: { tong: Number(p.total), dang_hien: Number(p.shown ?? 0), dang_an: Number(p.total) - Number(p.shown ?? 0) },
        bai_viet: { tong: Number(a.total), dang_hien: Number(a.shown ?? 0), dang_an: Number(a.total) - Number(a.shown ?? 0) },
      });
    },
  );

  // ------------------------------------------------ products
  server.registerTool(
    "tim_xe",
    {
      description: "Tìm hoặc liệt kê xe (có phân trang). Tìm theo tên hoặc mã; lọc theo hãng và trạng thái hiện/ẩn.",
      inputSchema: {
        q: z.string().max(100).optional().describe("Từ khoá trong tên hoặc mã xe"),
        brand: z.string().max(60).optional().describe("Mã hãng, xem bằng xem_danh_muc"),
        active: z.boolean().optional().describe("true: đang hiện, false: đang ẩn"),
        page: z.number().int().min(1).optional(),
        per_page: z.number().int().min(1).max(50).optional().describe("Mặc định 20, tối đa 50"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ q, brand, active, page, per_page }) => {
      const where: string[] = [];
      const args: unknown[] = [];
      if (q?.trim()) { where.push("(name LIKE ? OR code LIKE ?)"); args.push(like(q.trim()), like(q.trim())); }
      if (brand) { where.push("brand = ?"); args.push(brand); }
      if (active !== undefined) { where.push("active = ?"); args.push(active ? 1 : 0); }
      const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { perPage, offset, page: p } = pageOf(page, per_page);
      const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM products ${w}`, args);
      const rows = await query<ProductRow>(`SELECT id, slug, code, name, brand, price, price_max, active FROM products ${w} ORDER BY name LIMIT ? OFFSET ?`, [...args, perPage, offset]);
      return ok({ tong: Number(n), trang: p, moi_trang: perPage, xe: rows.map((r) => ({ id: r.id, code: r.code, name: r.name, brand: r.brand, price: Number(r.price), priceMax: Number(r.price_max), active: !!r.active, slug: r.slug })) });
    },
  );

  server.registerTool(
    "xem_xe",
    { description: "Xem đầy đủ một xe theo id.", inputSchema: { id: z.number().int().min(1) }, annotations: { readOnlyHint: true } },
    async ({ id }) => {
      const r = await getProduct(id);
      return r ? ok(productView(r)) : fail("Không tìm thấy xe.");
    },
  );

  server.registerTool(
    "luu_xe",
    {
      description: "Tạo xe mới (không có id) hoặc sửa xe (có id; trường nào không gửi thì giữ nguyên). Ảnh dùng đường dẫn có sẵn (/...) hoặc https://; ảnh từ trang web khác được tự tải về server. HTML được làm sạch như ở trang quản trị.",
      inputSchema: {
        id: z.number().int().min(1).optional().describe("Có id: sửa xe đó. Không có: tạo xe mới"),
        name: z.string().max(200).optional().describe("Tên xe (bắt buộc khi tạo mới)"),
        brand: z.string().max(60).optional().describe("Mã hãng"),
        types: z.array(z.string()).optional().describe("Mã các loại xe"),
        price: z.number().min(0).optional().describe("Giá từ (đồng)"),
        priceMax: z.number().min(0).optional().describe("Giá đến (đồng)"),
        img: z.string().max(500).optional().describe("Ảnh đại diện"),
        gallery: z.array(z.string()).max(30).optional().describe("Thư viện ảnh"),
        colors: z.array(z.string()).max(20).optional(),
        variants: z.array(variantSchema).max(60).optional().describe("Các dòng phiên bản và màu"),
        specs: z.array(specSchema).max(12).optional().describe("Các nhóm thông số kỹ thuật"),
        slug: z.string().max(191).optional().describe("Đường dẫn; bỏ trống thì tự tạo từ tên"),
        code: z.string().max(40).optional().describe("Mã xe; bỏ trống thì tự đặt"),
        shortHtml: z.string().max(200_000).optional().describe("Mô tả ngắn (HTML)"),
        html: z.string().max(2_000_000).optional().describe("Mô tả chi tiết (HTML)"),
        active: z.boolean().optional().describe("Hiện trên website (mặc định true khi tạo mới)"),
      },
    },
    async (v) => {
      const cur = v.id ? await getProduct(v.id) : undefined;
      if (v.id && !cur) return fail("Không tìm thấy xe.");
      const base = cur ? productView(cur) : { name: "", brand: "", types: [] as string[], price: 0, priceMax: 0, img: "", gallery: [] as string[], colors: [] as string[], variants: [] as unknown[], specs: [] as unknown[], slug: "", code: "", shortHtml: "", html: "", active: true };
      const m = { ...base, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) } as typeof base;
      // photos from other websites that came in this call are downloaded to the server (what was saved earlier is left as it is)
      const pics = makeLocalizer();
      if (v.img !== undefined) m.img = await pics.url(m.img ?? "");
      if (v.gallery !== undefined) m.gallery = await Promise.all(m.gallery.map((u) => pics.url(u)));
      if (v.shortHtml !== undefined) m.shortHtml = await pics.html(m.shortHtml);
      if (v.html !== undefined) m.html = await pics.html(m.html);
      if (v.variants !== undefined) m.variants = await Promise.all((m.variants as { img?: string | null }[]).map(async (x) => (x.img ? { ...x, img: await pics.url(x.img) } : x)));
      const f = new FormData();
      if (v.id) f.set("id", String(v.id));
      f.set("name", m.name);
      f.set("brand", m.brand);
      for (const t of m.types) f.append("types", t);
      f.set("price", String(m.price));
      f.set("priceMax", String(m.priceMax));
      f.set("img", m.img ?? "");
      f.set("gallery", m.gallery.join("\n"));
      f.set("colors", m.colors.join(","));
      f.set("variants", JSON.stringify(m.variants));
      f.set("specs", JSON.stringify(m.specs));
      f.set("slug", m.slug);
      f.set("code", m.code ?? "");
      f.set("shortHtml", m.shortHtml);
      f.set("html", m.html);
      if (m.active) f.set("active", "1");
      const r = await saveProduct(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_xe", `${v.id ? "sua" : "tao"} id=${r.id} anh_da_tai=${pics.imported()}`);
      const saved = await getProduct(r.id);
      return ok({ ...(saved ? productView(saved) : { id: r.id }), ...(pics.failed().length ? { canh_bao_anh_khong_tai_duoc: pics.failed() } : {}) });
    },
  );

  server.registerTool(
    "bat_tat_xe",
    { description: "Hiện hoặc ẩn một xe trên website. Không gửi active thì đảo trạng thái.", inputSchema: { id: z.number().int().min(1), active: z.boolean().optional() } },
    async ({ id, active }) => {
      const cur = await getProduct(id);
      if (!cur) return fail("Không tìm thấy xe.");
      if (active === undefined || !!cur.active !== active) {
        const r = await toggleProduct(id);
        if ("error" in r) return fail(r.error);
        refreshSite();
        logWrite(ctx, "bat_tat_xe", `id=${id} active=${cur.active ? 0 : 1}`);
      }
      return ok({ id, active: (await getProduct(id))?.active === 1 });
    },
  );

  server.registerTool(
    "xoa_xe",
    { description: "Xoá một xe. Không khôi phục được; phải gửi confirm: true.", inputSchema: { id: z.number().int().min(1), confirm: confirmDelete }, annotations: { destructiveHint: true } },
    async ({ id }) => {
      const cur = await getProduct(id);
      const r = await deleteProduct(id);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "xoa_xe", `id=${id}`);
      return ok({ da_xoa: { id, name: cur?.name } });
    },
  );

  // ------------------------------------------------ posts
  server.registerTool(
    "tim_bai_viet",
    {
      description: "Tìm hoặc liệt kê bài viết (có phân trang), không kèm nội dung. Tìm theo tiêu đề; lọc theo mục và trạng thái.",
      inputSchema: {
        q: z.string().max(100).optional().describe("Từ khoá trong tiêu đề"),
        section: z.string().max(40).optional().describe("Mã mục tin, xem bằng xem_danh_muc"),
        published: z.boolean().optional().describe("true: đang hiện, false: đang ẩn"),
        page: z.number().int().min(1).optional(),
        per_page: z.number().int().min(1).max(50).optional().describe("Mặc định 20, tối đa 50"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ q, section, published, page, per_page }) => {
      const where: string[] = [];
      const args: unknown[] = [];
      if (q?.trim()) { where.push("title LIKE ?"); args.push(like(q.trim())); }
      if (section) { where.push("section = ?"); args.push(section); }
      if (published !== undefined) { where.push("published = ?"); args.push(published ? 1 : 0); }
      const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { perPage, offset, page: p } = pageOf(page, per_page);
      const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts ${w}`, args);
      const rows = await query<PostRow>(`SELECT id, slug, title, date, section, published FROM posts ${w} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`, [...args, perPage, offset]);
      return ok({ tong: Number(n), trang: p, moi_trang: perPage, bai_viet: rows.map((r) => ({ id: r.id, title: r.title, date: String(r.date).slice(0, 10), section: r.section, published: !!r.published, slug: r.slug })) });
    },
  );

  server.registerTool(
    "xem_bai_viet",
    { description: "Xem đầy đủ một bài viết (kèm nội dung HTML) theo id.", inputSchema: { id: z.number().int().min(1) }, annotations: { readOnlyHint: true } },
    async ({ id }) => {
      const r = await getPost(id);
      return r ? ok(postView(r)) : fail("Không tìm thấy bài viết.");
    },
  );

  server.registerTool(
    "luu_bai_viet",
    {
      description: "Tạo bài viết mới (không có id) hoặc sửa bài (có id; trường nào không gửi thì giữ nguyên). Ảnh từ trang web khác trong nội dung hoặc ảnh bìa được tự tải về server. HTML được làm sạch như ở trang quản trị.",
      inputSchema: {
        id: z.number().int().min(1).optional().describe("Có id: sửa bài đó. Không có: tạo bài mới"),
        title: z.string().max(300).optional().describe("Tiêu đề (bắt buộc khi tạo mới)"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Ngày đăng YYYY-MM-DD, mặc định hôm nay khi tạo mới"),
        section: z.string().max(40).optional().describe("Mã mục tin, mặc định tin-tuc"),
        slug: z.string().max(191).optional().describe("Đường dẫn; bỏ trống thì tự tạo từ tiêu đề"),
        excerpt: z.string().max(600).optional().describe("Mô tả ngắn; bỏ trống thì lấy từ đầu bài"),
        img: z.string().max(500).optional().describe("Ảnh bìa (/... hoặc https://...)"),
        html: z.string().max(2_000_000).optional().describe("Nội dung (HTML)"),
        published: z.boolean().optional().describe("Hiện trên website (mặc định true khi tạo mới)"),
      },
    },
    async (v) => {
      const cur = v.id ? await getPost(v.id) : undefined;
      if (v.id && !cur) return fail("Không tìm thấy bài viết.");
      const base = cur ? postView(cur) : { title: "", date: new Date().toISOString().slice(0, 10), section: "tin-tuc", slug: "", excerpt: "", img: "", html: "", published: true };
      const m = { ...base, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) } as typeof base;
      // photos from other websites that came in this call are downloaded to the server (what was saved earlier is left as it is)
      const pics = makeLocalizer();
      if (v.img !== undefined) m.img = await pics.url(m.img ?? "");
      if (v.html !== undefined) m.html = await pics.html(m.html);
      const f = new FormData();
      if (v.id) f.set("id", String(v.id));
      f.set("title", m.title);
      f.set("date", m.date);
      f.set("section", m.section);
      f.set("slug", m.slug);
      f.set("excerpt", m.excerpt);
      f.set("img", m.img ?? "");
      f.set("html", m.html);
      if (m.published) f.set("published", "1");
      const r = await savePost(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_bai_viet", `${v.id ? "sua" : "tao"} id=${r.id} anh_da_tai=${pics.imported()}`);
      const saved = await getPost(r.id);
      return ok({ ...(saved ? postView(saved) : { id: r.id }), ...(pics.failed().length ? { canh_bao_anh_khong_tai_duoc: pics.failed() } : {}) });
    },
  );

  server.registerTool(
    "bat_tat_bai_viet",
    { description: "Hiện hoặc ẩn một bài viết. Không gửi published thì đảo trạng thái.", inputSchema: { id: z.number().int().min(1), published: z.boolean().optional() } },
    async ({ id, published }) => {
      const cur = await getPost(id);
      if (!cur) return fail("Không tìm thấy bài viết.");
      if (published === undefined || !!cur.published !== published) {
        const r = await togglePost(id);
        if ("error" in r) return fail(r.error);
        refreshSite();
        logWrite(ctx, "bat_tat_bai_viet", `id=${id} published=${cur.published ? 0 : 1}`);
      }
      return ok({ id, published: (await getPost(id))?.published === 1 });
    },
  );

  server.registerTool(
    "xoa_bai_viet",
    { description: "Xoá một bài viết. Không khôi phục được; phải gửi confirm: true.", inputSchema: { id: z.number().int().min(1), confirm: confirmDelete }, annotations: { destructiveHint: true } },
    async ({ id }) => {
      const cur = await getPost(id);
      const r = await deletePost(id);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "xoa_bai_viet", `id=${id}`);
      return ok({ da_xoa: { id, title: cur?.title } });
    },
  );

  // ------------------------------------------------ shop info
  server.registerTool(
    "xem_thong_tin_cua_hang",
    { description: "Xem thông tin cửa hàng: tên, hotline, Facebook, địa chỉ chân trang, danh sách cửa hàng.", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => ok(await getShop()),
  );

  server.registerTool(
    "luu_thong_tin_cua_hang",
    {
      description: "Sửa thông tin cửa hàng (trường nào không gửi thì giữ nguyên). Danh sách gửi lên thay thế cả danh sách cũ.",
      inputSchema: {
        brand: z.string().max(120).optional().describe("Tên cửa hàng"),
        hotlines: z.array(z.string()).min(1).max(6).optional().describe("Mỗi số một phần tử, chỉ gồm số"),
        facebook: z.string().max(500).optional().describe("Link Facebook, bắt đầu bằng https://"),
        branches: z.array(z.string().max(300)).max(20).optional().describe("Các dòng địa chỉ ở chân trang"),
        stores: z.array(z.object({ name: z.string(), kind: z.string().optional(), address: z.string().optional(), hours: z.string().optional(), img: z.string().optional() })).max(20).optional().describe("Danh sách cửa hàng"),
      },
    },
    async (v) => {
      const cur = await getShop();
      const m = { ...cur, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) } as typeof cur;
      const f = new FormData();
      f.set("brand", m.brand);
      f.set("hotlines", m.hotlines.join("\n"));
      f.set("facebook", m.facebook);
      f.set("branches", m.branches.join("\n"));
      f.set("stores", JSON.stringify(m.stores));
      const r = await saveShop(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_thong_tin_cua_hang", "ok");
      return ok(await getShop());
    },
  );

  // ------------------------------------------------ taxonomy
  server.registerTool(
    "xem_danh_muc",
    { description: "Xem danh mục: hãng xe, loại xe, mục tin tức (mã, tên, đang hiện).", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => ok(await readTaxonomy()),
  );

  const termSchema = z.object({ id: z.string().max(60).optional().describe("Mã có sẵn để sửa; bỏ trống để thêm mới"), name: z.string().max(60), active: z.boolean().optional() });
  server.registerTool(
    "luu_danh_muc",
    {
      description: "Thêm hoặc sửa hãng xe, loại xe, mục tin tức. Mục nào không nhắc tới thì giữ nguyên (không xoá mục nào qua công cụ này). Muốn tắt một mục thì gửi active: false.",
      inputSchema: {
        brands: z.array(termSchema.extend({ menu: z.enum(["xe-may", "xe-dien", ""]).optional().describe("Hãng nằm ở menu Xe máy hay Xe điện") })).max(60).optional(),
        types: z.array(termSchema).max(60).optional(),
        sections: z.array(termSchema.extend({ menu: z.boolean().optional().describe("Hiện trong menu Tin tức") })).max(60).optional(),
      },
    },
    async (v) => {
      const cur = await readTaxonomy();
      type Term = { id: string; name: string; active: boolean; menu?: unknown };
      const merge = (key: "brands" | "types" | "sections", patch: Partial<Term & { id: string }>[] | undefined): Term[] => {
        const out: Term[] = (cur[key] as Term[]).map((x) => ({ ...x }));
        for (const p of patch ?? []) {
          const at = p.id ? out.findIndex((x) => x.id === p.id) : -1;
          if (p.id && at < 0) throw new Error(`Không có mã "${p.id}" trong ${key}. Bỏ trống mã để thêm mới.`);
          const clean = Object.fromEntries(Object.entries(p).filter(([, x]) => x !== undefined)) as Partial<Term>;
          if (at >= 0) out[at] = { ...out[at], ...clean };
          else out.push({ id: "", name: String(p.name ?? ""), active: p.active !== false, ...(p.menu !== undefined ? { menu: p.menu } : {}) });
        }
        return out;
      };
      let next: { brands: Term[]; types: Term[]; sections: Term[] };
      try {
        next = { brands: merge("brands", v.brands), types: merge("types", v.types), sections: merge("sections", v.sections) };
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Dữ liệu không hợp lệ.");
      }
      const f = new FormData();
      f.set("taxonomy", JSON.stringify(next));
      f.set("menu", JSON.stringify(await readMenu()));
      const r = await saveTaxonomy(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_danh_muc", "ok");
      return ok(await readTaxonomy());
    },
  );
}
