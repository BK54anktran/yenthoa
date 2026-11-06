import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "node:crypto";
import { z } from "zod";
import { query } from "@/lib/db";
import { getAllSlides } from "@/lib/admin-repo";
import { getHomeSections } from "@/lib/repo";
import { COLLECTIONS_KEY, normalizeCollections, type Collection } from "@/lib/collections";
import { BUILTIN_TEMPLATES } from "@/lib/template-samples";
import { MAX_TEMPLATES, parseTemplateJson, TEMPLATES_KEY, type Template } from "@/lib/template";
import { addImage, deleteImage, findUsage, isMediaId, listMedia, mediaInfo, refOf, renameImage, replaceImage } from "@/lib/media";
import { fetchImage } from "@/lib/import-image";
import { describeImageError, fileHostsFromEnv, saveImageBytes } from "@/lib/mcp-images";
import { createUploadLink, MAX_UPLOAD_LINK_MINUTES, UPLOAD_LINK_MINUTES } from "@/lib/upload-links";
import { GUIDE_TOPICS, guideFor } from "@/lib/mcp-guide";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { makeLocalizer } from "@/lib/localize-images";
import {
  createCollection, deleteCollection, deleteTemplate, duplicateTemplate, moveCollection, refreshSite, saveCollection, saveHome, saveTaxonomy, saveTemplate,
} from "@/lib/admin-service";
import { confirmDelete, fail, logWrite, ok, readMenu, readTaxonomy, type Ctx } from "@/lib/mcp-tools";

// The rest of the admin: home page, collections, templates, the image library, the header menu, and removing a category.
// Same rules as lib/mcp-tools.ts: every write goes through lib/admin-service.ts, reads use parameters only, and
// nothing that removes data runs without `confirm: true` (or, for a list sent whole, `cho_phep_bo`).

// read straight from the database (lib/repo.ts keeps its answer for the rest of a request)
const readCollections = async (): Promise<Collection[]> => {
  const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [COLLECTIONS_KEY]);
  return row ? normalizeCollections(row.v) : [];
};
const readCustomTemplates = async (): Promise<Template[]> => {
  const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [TEMPLATES_KEY]);
  const raw = row && Array.isArray(row.v) ? (row.v as { id?: unknown }[]) : [];
  const out: Template[] = [];
  for (const r of raw.slice(0, MAX_TEMPLATES)) {
    const id = String(r?.id ?? "").trim();
    const p = parseTemplateJson(r);
    if (id && "template" in p) out.push({ id, ...p.template });
  }
  return out;
};
const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

const idStr = z.string().min(1).max(120);

// thông tin giúp tìm lỗi khi ảnh base64 bị từ chối (kích thước, chữ ký, lỗi gốc của thư viện ảnh)
function imageDiag(raw: string, e: unknown): string {
  let data: Buffer;
  try {
    data = decodeBase64Image(raw);
  } catch {
    return e instanceof Error ? e.message : "Không tải được ảnh.";
  }
  const cleaned = raw.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  const truncated = cleaned.length % 4 === 1 ? " Chuỗi base64 có độ dài không hợp lệ (bị cắt hoặc sao chép sai)." : "";
  return `${describeImageError(data, e)}${truncated} Nếu ảnh bị báo hỏng, chuỗi base64 có thể đã sai khi AI sao chép; hãy dùng lệnh từ lay_lenh_tai_anh_len hoặc tai_anh_tu_link với link công khai.`;
}

// ảnh gửi thẳng dạng base64 (bỏ tiền tố data:...;base64, nếu có); loại ảnh được kiểm lại khi lưu
function decodeBase64Image(raw: string): Buffer {
  const b64 = raw.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(b64)) throw new Error("Dữ liệu không phải base64 hợp lệ.");
  const data = Buffer.from(b64, "base64");
  if (data.length === 0) throw new Error("Dữ liệu ảnh rỗng.");
  if (data.length > MAX_UPLOAD_BYTES) throw new Error("Ảnh quá lớn (tối đa 10 MB).");
  return data;
}

export function registerMoreTools(server: McpServer, ctx: Ctx): void {
  // ================================================ home page
  server.registerTool(
    "xem_trang_chu",
    {
      description: "Xem trang chủ như trang quản trị: danh sách banner đầu trang (slides) và các mục trên trang chủ (sections), kể cả mục đang ẩn.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ok({ slides: await getAllSlides(), sections: await getHomeSections() }),
  );

  const slideSchema = z.looseObject({
    img: z.string().describe("Ảnh banner (/... hoặc https://...), bắt buộc"),
    imgMobile: z.string().optional().describe("Ảnh riêng cho điện thoại"),
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    sub: z.string().optional(),
    link: z.string().optional().describe("Nơi đi tới khi bấm nút; để trống thì không có nút"),
    fit: z.enum(["cover", "natural"]).optional(),
    dim: z.boolean().optional().describe("Phủ lớp tối để đọc chữ (mặc định true)"),
    active: z.boolean().optional(),
  });
  const sectionSchema = z.looseObject({
    id: z.string().optional().describe("Mã mục; có sẵn thì giữ nguyên, bỏ trống để thêm mục mới"),
    kind: z.enum(["slides", "showcase", "banner", "collections", "html", "facts", "template"]),
    name: z.string().optional(),
    active: z.boolean().optional(),
  });

  server.registerTool(
    "luu_trang_chu",
    {
      description:
        "Lưu banner đầu trang và các mục trang chủ. Danh sách gửi lên THAY THẾ cả danh sách cũ, nên hãy lấy từ xem_trang_chu rồi sửa. Phần nào không gửi thì giữ nguyên. " +
        "Bỏ bớt mục hoặc banner so với hiện tại thì bị từ chối, trừ khi gửi cho_phep_bo: true. Ảnh từ trang khác được tự tải về server. " +
        "Các loại mục (kind): slides (banner đầu trang: cardsMode auto|custom|off, cards[{title,img,link}]), showcase (giới thiệu xe: brand | collection | slugs[], backdrop, backdropMobile, dark), " +
        "banner (image, link), html (html), facts (factItems[{label,value,auto:''|products|brands|branches}], factCall), template (templateId, values), collections (display showcase|cards, slugs[] là mã bộ sưu tập).",
      inputSchema: {
        slides: z.array(slideSchema).max(10).optional(),
        sections: z.array(sectionSchema).max(30).optional(),
        cho_phep_bo: z.boolean().optional().describe("true để cho phép danh sách mới ít mục hơn danh sách hiện tại"),
      },
    },
    async (v) => {
      const curSlides = await getAllSlides();
      const curSections = await getHomeSections();
      const pics = makeLocalizer();
      type Loose = Record<string, unknown>;
      let slides: Loose[] = curSlides as unknown as Loose[];
      let sections: Loose[] = curSections as unknown as Loose[];
      if (v.slides) {
        slides = await Promise.all(v.slides.map(async (s) => ({ ...s, img: await pics.url(String(s.img ?? "")), ...(s.imgMobile ? { imgMobile: await pics.url(String(s.imgMobile)) } : {}) })));
        if (slides.length < curSlides.length && !v.cho_phep_bo) {
          return fail(`Danh sách banner mới có ${slides.length} banner, ít hơn hiện tại (${curSlides.length}). Nếu đúng ý muốn bỏ bớt, gửi lại với cho_phep_bo: true.`);
        }
      }
      if (v.sections) {
        const keep = new Set(v.sections.map((s) => String(s.id ?? "")).filter(Boolean));
        const dropped = curSections.filter((s) => !keep.has(s.id));
        if (dropped.length && !v.cho_phep_bo) {
          return fail(`Danh sách mới sẽ bỏ ${dropped.length} mục: ${dropped.map((s) => `"${s.name}" (${s.id})`).join(", ")}. Nếu đúng ý, gửi lại với cho_phep_bo: true.`);
        }
        sections = await Promise.all(
          v.sections.map(async (s) => {
            const o: Loose = { ...s };
            for (const k of ["image", "backdrop", "backdropMobile"]) if (typeof o[k] === "string" && o[k]) o[k] = await pics.url(o[k] as string);
            if (typeof o.html === "string") o.html = await pics.html(o.html);
            if (Array.isArray(o.cards)) o.cards = await Promise.all((o.cards as Loose[]).map(async (c) => ({ ...c, img: await pics.url(String(c.img ?? "")) })));
            return o;
          }),
        );
      }
      const f = new FormData();
      f.set("slides", JSON.stringify(slides));
      f.set("sections", JSON.stringify(sections));
      const r = await saveHome(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_trang_chu", `banner=${slides.length} muc=${sections.length} anh_da_tai=${pics.imported()}`);
      return ok({ slides: await getAllSlides(), sections: await getHomeSections(), ...(pics.failed().length ? { canh_bao_anh_khong_tai_duoc: pics.failed() } : {}) });
    },
  );

  // ================================================ collections
  server.registerTool(
    "xem_bo_suu_tap",
    {
      description: "Xem bộ sưu tập: không có id thì liệt kê tất cả (tóm tắt), có id thì xem đầy đủ một bộ.",
      inputSchema: { id: idStr.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const all = await readCollections();
      if (!id) return ok(all.map((c) => ({ id: c.id, name: c.name, mode: c.mode, active: c.active, so_xe_chon_tay: c.slugs.length, hang: c.brands, loai: c.types })));
      const c = all.find((x) => x.id === id);
      return c ? ok(c) : fail("Không tìm thấy bộ sưu tập.");
    },
  );

  server.registerTool(
    "luu_bo_suu_tap",
    {
      description:
        "Tạo bộ sưu tập (không có id, cần name; chưa có xe thì tạo ở trạng thái ẩn) hoặc sửa (có id; trường nào không gửi thì giữ nguyên). mode manual: chọn tay bằng slugs (mã đường dẫn của xe); mode auto: theo luật brands, types, priceMin, priceMax. Ảnh từ trang khác được tự tải về server.",
      inputSchema: {
        id: idStr.optional().describe("Có id: sửa bộ đó. Không có: tạo mới"),
        name: z.string().max(80).optional(),
        description: z.string().max(5000).optional().describe("Một hai dòng dưới tên"),
        html: z.string().max(200_000).optional().describe("Mô tả chi tiết (HTML)"),
        image: z.string().max(500).optional(),
        backdrop: z.string().max(500).optional().describe("Ảnh nền khi trang chủ hiện bộ này dạng giới thiệu"),
        backdropMobile: z.string().max(500).optional(),
        dark: z.boolean().optional(),
        mode: z.enum(["manual", "auto"]).optional(),
        slugs: z.array(z.string()).max(200).optional(),
        brands: z.array(z.string()).optional(),
        types: z.array(z.string()).optional(),
        priceMin: z.number().min(0).optional(),
        priceMax: z.number().min(0).optional(),
        active: z.boolean().optional(),
      },
    },
    async (v) => {
      let id = v.id;
      let created = false;
      if (!id) {
        if (!v.name?.trim()) return fail("Cần name khi tạo bộ sưu tập mới.");
        const f = new FormData();
        f.set("name", v.name);
        const r = await createCollection(f);
        if ("error" in r) return fail(r.error);
        id = r.id;
        created = true;
      }
      const cur = (await readCollections()).find((c) => c.id === id);
      if (!cur) return fail("Không tìm thấy bộ sưu tập.");
      const { id: _id, ...patch } = v;
      void _id;
      const pics = makeLocalizer();
      const m: Collection = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined)) } as Collection;
      if (v.image !== undefined) m.image = await pics.url(m.image);
      if (v.backdrop !== undefined) m.backdrop = await pics.url(m.backdrop);
      if (v.backdropMobile !== undefined) m.backdropMobile = await pics.url(m.backdropMobile ?? "");
      if (v.html !== undefined) m.html = await pics.html(m.html);
      // bộ mới chọn tay mà chưa có xe thì để ẩn (bản nháp), tránh bị từ chối
      if (created && v.active === undefined && m.mode === "manual" && !m.slugs.length) m.active = false;
      const f = new FormData();
      f.set("id", id);
      f.set("collection", JSON.stringify(m));
      const r = await saveCollection(f);
      if ("error" in r) {
        if (created) await deleteCollection(id);
        return fail(r.error);
      }
      refreshSite();
      logWrite(ctx, "luu_bo_suu_tap", `${created ? "tao" : "sua"} id=${id} anh_da_tai=${pics.imported()}`);
      const saved = (await readCollections()).find((c) => c.id === id);
      return ok({ ...(saved ?? { id }), ...(pics.failed().length ? { canh_bao_anh_khong_tai_duoc: pics.failed() } : {}) });
    },
  );

  server.registerTool(
    "sap_xep_bo_suu_tap",
    { description: "Dời một bộ sưu tập lên hoặc xuống một vị trí trong danh sách.", inputSchema: { id: idStr, huong: z.enum(["len", "xuong"]) } },
    async ({ id, huong }) => {
      const r = await moveCollection(id, huong === "len" ? "up" : "down");
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "sap_xep_bo_suu_tap", `id=${id} ${huong}`);
      return ok((await readCollections()).map((c) => c.id));
    },
  );

  server.registerTool(
    "xoa_bo_suu_tap",
    { description: "Xoá một bộ sưu tập (xe vẫn còn). Không khôi phục được; phải gửi confirm: true.", inputSchema: { id: idStr, confirm: confirmDelete }, annotations: { destructiveHint: true } },
    async ({ id }) => {
      const cur = (await readCollections()).find((c) => c.id === id);
      const r = await deleteCollection(id);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "xoa_bo_suu_tap", `id=${id}`);
      return ok({ da_xoa: { id, name: cur?.name } });
    },
  );

  // ================================================ templates
  server.registerTool(
    "xem_mau",
    {
      description: "Xem mẫu (khối HTML có ô nhập dùng ở trang chủ): không có id thì liệt kê, có id thì xem đầy đủ (html và fields).",
      inputSchema: { id: idStr.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const all = [...BUILTIN_TEMPLATES, ...(await readCustomTemplates())];
      if (!id) return ok(all.map((t) => ({ id: t.id, name: t.name, description: t.description, co_san: !!t.builtIn })));
      const t = all.find((x) => x.id === id);
      return t ? ok(t) : fail("Không tìm thấy mẫu.");
    },
  );

  server.registerTool(
    "luu_mau",
    {
      description:
        "Tạo mẫu mới (không có id) hoặc sửa mẫu tự tạo (có id; mẫu có sẵn không sửa được, hãy nhan_ban_mau trước). Gửi đủ name, html, fields. Chỗ trống trong html viết {{key}}. Mỗi field: {key, label, type, default?, options?, fields?, max?, hint?}.",
      inputSchema: {
        id: idStr.optional(),
        name: z.string().max(80),
        description: z.string().max(500).optional(),
        html: z.string().max(200_000),
        fields: z.array(z.looseObject({ key: z.string(), label: z.string(), type: z.string() })).max(40).optional(),
      },
    },
    async (v) => {
      const f = new FormData();
      if (v.id) f.set("id", v.id);
      f.set("template", JSON.stringify({ name: v.name, description: v.description ?? "", html: v.html, fields: v.fields ?? [] }));
      const r = await saveTemplate(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_mau", `${v.id ? "sua" : "tao"} id=${r.id}`);
      return ok((await readCustomTemplates()).find((t) => t.id === r.id) ?? { id: r.id });
    },
  );

  server.registerTool(
    "nhan_ban_mau",
    { description: "Tạo bản sao có thể sửa của một mẫu (kể cả mẫu có sẵn).", inputSchema: { id: idStr } },
    async ({ id }) => {
      const r = await duplicateTemplate(id);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "nhan_ban_mau", `tu=${id} moi=${r.id}`);
      return ok((await readCustomTemplates()).find((t) => t.id === r.id) ?? { id: r.id });
    },
  );

  server.registerTool(
    "xoa_mau",
    { description: "Xoá một mẫu tự tạo (bị từ chối nếu trang chủ còn dùng). Không khôi phục được; phải gửi confirm: true.", inputSchema: { id: idStr, confirm: confirmDelete }, annotations: { destructiveHint: true } },
    async ({ id }) => {
      const r = await deleteTemplate(id);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "xoa_mau", `id=${id}`);
      return ok({ da_xoa: { id } });
    },
  );

  // ================================================ image library
  server.registerTool(
    "tim_hinh_anh",
    {
      description: "Xem kho Hình ảnh đã tải lên (mới nhất trước, có phân trang). Tìm theo tên, mã hoặc tên nơi đang dùng; lọc ảnh đang dùng hoặc chưa dùng.",
      inputSchema: {
        q: z.string().max(100).optional(),
        dang_dung: z.boolean().optional().describe("true: chỉ ảnh đang được dùng; false: chỉ ảnh chưa dùng"),
        page: z.number().int().min(1).optional(),
        per_page: z.number().int().min(1).max(50).optional().describe("Mặc định 24, tối đa 50"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ q, dang_dung, page, per_page }) => {
      const [all, usage] = await Promise.all([listMedia(), findUsage()]);
      const words = fold(q ?? "").split(/\s+/).filter(Boolean);
      let rows = words.length ? all.filter((f) => words.every((w) => fold([f.name, f.id, ...(usage.get(f.id) ?? []).map((p) => p.label)].join(" ")).includes(w))) : all;
      if (dang_dung !== undefined) rows = rows.filter((f) => usage.has(f.id) === dang_dung);
      const per = per_page ?? 24;
      const p = page ?? 1;
      return ok({
        tong: rows.length,
        trang: p,
        moi_trang: per,
        hinh_anh: rows.slice((p - 1) * per, p * per).map((f) => ({ id: f.id, ten: f.name, link: refOf(f.id), dung_luong_kb: Math.max(1, Math.round(f.size / 1024)), so_noi_dung: usage.get(f.id)?.length ?? 0 })),
      });
    },
  );

  server.registerTool(
    "xem_hinh_anh",
    { description: "Xem một ảnh trong kho và các nơi đang dùng nó.", inputSchema: { id: z.string().length(16) }, annotations: { readOnlyHint: true } },
    async ({ id }) => {
      if (!isMediaId(id)) return fail("Mã ảnh không hợp lệ.");
      const f = (await listMedia()).find((x) => x.id === id);
      if (!f) return fail("Không tìm thấy ảnh.");
      return ok({ id, ten: f.name, link: refOf(id), dung_luong_kb: Math.max(1, Math.round(f.size / 1024)), noi_dang_dung: (await findUsage()).get(id) ?? [] });
    },
  );

  server.registerTool(
    "tai_anh_tu_link",
    {
      description: "Tải một ảnh từ trang web khác về kho Hình ảnh (nén WebP, tối đa 10 MB) và trả link /uploads/<mã> để dùng ở mọi nơi.",
      inputSchema: { url: z.string().url().max(2000), name: z.string().max(200).optional().describe("Tên gợi nhớ; bỏ trống thì lấy từ link") },
    },
    async ({ url, name }) => {
      try {
        const { data, name: fromUrl } = await fetchImage(url);
        const link = await addImage(data, name?.trim() || fromUrl);
        logWrite(ctx, "tai_anh_tu_link", `link=${link}`);
        return ok({ link, id: link.replace("/uploads/", "") });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Không tải được ảnh.");
      }
    },
  );

  server.registerTool(
    "huong_dan",
    {
      description: "Cách dùng bộ công cụ này. Gọi khi chưa chắc cách làm. Không truyền phan thì được hướng dẫn chung; truyền phan để xem chi tiết một phần.",
      inputSchema: { phan: z.enum(GUIDE_TOPICS as [string, ...string[]]).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ phan }) => ok({ huong_dan: guideFor(phan) }),
  );

  server.registerTool(
    "tai_anh_len",
    {
      description:
        "Tải một ảnh lên kho Hình ảnh bằng dữ liệu ảnh (base64), dùng khi ảnh chỉ có trên máy bạn và không có link công khai. Máy chủ không đọc được đường dẫn file trên máy bạn. JPG, PNG, WebP, GIF hoặc AVIF, tối đa 10 MB; ảnh nhỏ gửi nhẹ hơn. Trả link /uploads/<mã>.",
      inputSchema: {
        du_lieu_base64: z.string().min(100).max(14_500_000).describe("Nội dung file ảnh mã hoá base64, không kèm tiền tố data:"),
        name: z.string().max(200).optional().describe("Tên gợi nhớ, vd banner-thang-11"),
      },
    },
    async ({ du_lieu_base64, name }) => {
      try {
        const data = decodeBase64Image(du_lieu_base64);
        const link = await saveImageBytes(data, name ?? "");
        logWrite(ctx, "tai_anh_len", `link=${link}`);
        return ok({ link, id: link.replace("/uploads/", "") });
      } catch (e) {
        const d = imageDiag(du_lieu_base64, e);
        logWrite(ctx, "tai_anh_len", `loi=${d}`);
        return fail(d);
      }
    },
  );

  server.registerTool(
    "lay_lenh_tai_anh_len",
    {
      description:
        "Cách ưu tiên để đưa ảnh có trên máy lên kho mà không phải gõ base64: trả địa chỉ upload và lệnh curl mẫu để chạy bằng Bash (cần biến môi trường YENTHOA_MCP_KEY chứa key MCP). Kết quả của lệnh là link /uploads/<mã>.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const url = `${ctx.origin}/api/mcp-upload`;
      return ok({
        dia_chi: url,
        lenh: `curl -sS -H "Authorization: Bearer $YENTHOA_MCP_KEY" -F "file=@/duong/dan/anh.webp" -F "name=banner-24-11" ${url}`,
        ghi_chu: [
          "Chạy bằng Bash trên máy có file ảnh; đổi /duong/dan/anh.webp và name cho đúng.",
          "Key lấy từ biến môi trường, không dán key vào lệnh hay hội thoại.",
          "Nhận JPG, PNG, WebP, GIF, AVIF, tối đa 10 MB, đúng một tệp, trường tên là file.",
          "Kết quả JSON có link (/uploads/<mã>): dùng link đó cho banner, xe, bài viết.",
        ],
      });
    },
  );

  // A file the person attached in the chat. The chat app (ChatGPT, through the "openai/fileParams" mark) swaps the file for an object
  // with a short-lived download address, so the AI never has to type the photo out. The address is fetched at once, in this call.
  server.registerTool(
    "tai_anh_tu_file",
    {
      description:
        "Đưa ảnh người dùng đính kèm trong khung chat lên kho Hình ảnh (nén WebP, tối đa 10 MB). Ứng dụng chat tự truyền tệp vào tham số file, bạn không cần mã hoá gì. " +
        "Link tải của tệp chỉ sống ngắn và được dùng ngay trong lần gọi này; nếu báo hết hạn hoặc không tải được, nhờ người dùng gửi lại ảnh. Trả image_id, url, size, mime_type.",
      inputSchema: {
        file: z.object({
          download_url: z.string().url().max(4000).describe("Link tải tạm của tệp do ứng dụng chat cấp"),
          file_id: z.string().min(1).max(300),
          mime_type: z.string().max(100).optional(),
          file_name: z.string().max(300).optional(),
        }),
        name: z.string().max(200).optional().describe("Tên gợi nhớ; bỏ trống thì lấy từ tên tệp"),
      },
      _meta: { "openai/fileParams": ["file"] },
    },
    async ({ file, name }) => {
      let data: Buffer;
      let fromUrl: string;
      try {
        ({ data, name: fromUrl } = await fetchImage(file.download_url, { anyContentType: true, httpsOnly: true, allowedHosts: fileHostsFromEnv() }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Không tải được tệp.";
        logWrite(ctx, "tai_anh_tu_file", `file_id=${file.file_id} loi=${msg}`);
        return fail(`${msg} Link tải của tệp có thể đã hết hạn: nhờ người dùng gửi lại ảnh. Nếu vẫn lỗi, dùng tao_link_tai_anh hoặc tai_anh_tu_link.`);
      }
      try {
        const label = name?.trim() || file.file_name?.replace(/\.[a-z0-9]{2,5}$/i, "") || fromUrl;
        const link = await saveImageBytes(data, label);
        const id = link.replace("/uploads/", "");
        const info = await mediaInfo(id);
        logWrite(ctx, "tai_anh_tu_file", `file_id=${file.file_id} link=${link} byte=${data.length}`);
        return ok({ image_id: id, url: `${ctx.origin}${link}`, link, id, size: info?.size ?? null, mime_type: info?.mime ?? "image/webp", kich_thuoc_goc: data.length });
      } catch (e) {
        const d = describeImageError(data, e);
        logWrite(ctx, "tai_anh_tu_file", `file_id=${file.file_id} loi=${d}`);
        return fail(d);
      }
    },
  );

  // For apps that cannot pass a file and cannot run a command: a page the person opens, picks the photo on, and is done.
  server.registerTool(
    "tao_link_tai_anh",
    {
      description:
        `Tạo một địa chỉ trang web dùng MỘT LẦN để người dùng tự chọn ảnh từ máy mình (hết hạn sau ${UPLOAD_LINK_MINUTES} phút). Dùng khi ảnh chỉ có trên máy người dùng và bạn không có Bash, ứng dụng cũng không truyền được tệp. ` +
        "Đưa địa chỉ cho người dùng mở bằng trình duyệt, đợi họ báo đã tải xong, rồi gọi tim_hinh_anh với tên ảnh đã đặt để lấy link /uploads/<mã>. Không dán lại địa chỉ ở nơi công khai.",
      inputSchema: {
        name: z.string().max(200).optional().describe("Tên gợi nhớ để tìm lại ảnh, vd banner-24-11; bỏ trống thì tự đặt"),
        phut: z.number().int().min(1).max(MAX_UPLOAD_LINK_MINUTES).optional().describe(`Số phút địa chỉ còn dùng được (mặc định ${UPLOAD_LINK_MINUTES})`),
      },
    },
    async ({ name, phut }) => {
      const tenAnh = name?.trim() || `tai-len-${crypto.randomBytes(3).toString("hex")}`;
      try {
        const { token, minutes } = await createUploadLink(ctx.keyName, tenAnh, phut);
        logWrite(ctx, "tao_link_tai_anh", `ten=${JSON.stringify(tenAnh)} phut=${minutes}`);
        return ok({
          dia_chi: `${ctx.origin}/tai-anh/${token}`,
          het_han_sau_phut: minutes,
          ten_anh: tenAnh,
          noi_cho_nguoi_dung: `Mở địa chỉ này bằng trình duyệt, chọn ảnh rồi bấm Tải lên (dùng được một lần, còn ${minutes} phút). Xong thì báo lại cho tôi.`,
          buoc_tiep_theo: `Khi người dùng báo đã tải xong, gọi tim_hinh_anh với q="${tenAnh}" để lấy link /uploads/<mã>, rồi dùng link đó (banner, xe, bài viết).`,
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Không tạo được địa chỉ tải ảnh.");
      }
    },
  );

  server.registerTool(
    "doi_ten_hinh_anh",
    { description: "Đổi tên gợi nhớ của một ảnh trong kho (không đổi link).", inputSchema: { id: z.string().length(16), name: z.string().min(1).max(200) } },
    async ({ id, name }) => {
      if (!isMediaId(id)) return fail("Mã ảnh không hợp lệ.");
      if (!(await listMedia()).some((x) => x.id === id)) return fail("Không tìm thấy ảnh.");
      await renameImage(id, name);
      logWrite(ctx, "doi_ten_hinh_anh", `id=${id}`);
      return ok({ id, ten: name.trim().slice(0, 200) });
    },
  );

  server.registerTool(
    "thay_hinh_anh",
    {
      description: "Thay nội dung một ảnh trong kho bằng ảnh tải từ link (url) hoặc dữ liệu base64 (du_lieu_base64). Mọi nơi đang dùng ảnh đó tự hiện ảnh mới, không phải sửa chỗ nào khác. Không khôi phục được ảnh cũ.",
      inputSchema: { id: z.string().length(16), url: z.string().url().max(2000).optional(), du_lieu_base64: z.string().min(100).max(14_500_000).optional().describe("Thay cho url khi ảnh chỉ có trên máy bạn"), confirm: confirmDelete },
      annotations: { destructiveHint: true },
    },
    async ({ id, url, du_lieu_base64 }) => {
      if (!url === !du_lieu_base64) return fail("Gửi đúng một trong hai: url hoặc du_lieu_base64.");
      if (!isMediaId(id)) return fail("Mã ảnh không hợp lệ.");
      if (!(await listMedia()).some((x) => x.id === id)) return fail("Không tìm thấy ảnh.");
      try {
        const data = url ? (await fetchImage(url)).data : decodeBase64Image(du_lieu_base64 ?? "");
        await replaceImage(id, data);
      } catch (e) {
        return fail(du_lieu_base64 ? imageDiag(du_lieu_base64, e) : e instanceof Error ? e.message : "Không thay được ảnh.");
      }
      refreshSite();
      logWrite(ctx, "thay_hinh_anh", `id=${id}`);
      return ok({ id, link: refOf(id), da_thay: true });
    },
  );

  server.registerTool(
    "xoa_hinh_anh",
    {
      description: "Xoá một ảnh khỏi kho. Ảnh đang được dùng thì bị từ chối (liệt kê nơi dùng), trừ khi gửi ke_ca_dang_dung: true. Không khôi phục được; phải gửi confirm: true.",
      inputSchema: { id: z.string().length(16), confirm: confirmDelete, ke_ca_dang_dung: z.boolean().optional() },
      annotations: { destructiveHint: true },
    },
    async ({ id, ke_ca_dang_dung }) => {
      if (!isMediaId(id)) return fail("Mã ảnh không hợp lệ.");
      if (!(await listMedia()).some((x) => x.id === id)) return fail("Không tìm thấy ảnh.");
      const places = (await findUsage()).get(id) ?? [];
      if (places.length && !ke_ca_dang_dung) return fail(`Ảnh đang được dùng ở ${places.length} nơi: ${places.map((p) => p.label).join("; ")}. Nếu vẫn muốn xoá, gửi lại với ke_ca_dang_dung: true.`);
      await deleteImage(id);
      refreshSite();
      logWrite(ctx, "xoa_hinh_anh", `id=${id} noi_dung=${places.length}`);
      return ok({ da_xoa: { id }, tung_dung_o: places.length });
    },
  );

  // ================================================ header menu and removing a category
  server.registerTool(
    "xem_menu",
    { description: "Xem menu đầu trang (menu chính và menu phụ, nhiều cấp).", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => ok(await readMenu()),
  );

  const nodeSchema = z.looseObject({
    id: z.string().optional(),
    label: z.string().describe("Tên hiện trên menu"),
    href: z.string().optional().describe("Đường dẫn (/..., https://..., tel:, mailto:) hoặc để trống nếu chỉ làm nhóm"),
    active: z.boolean().optional(),
    source: z.string().optional().describe("Tự tạo mục con: brands:xe-may | brands:xe-dien | brands:all | sections:menu | sections:all | collections:all"),
    children: z.array(z.any()).optional().describe("Mục con (tối đa 4 cấp)"),
  });
  const countNodes = (list: unknown): number => (Array.isArray(list) ? list.reduce<number>((n, x) => n + 1 + countNodes((x as { children?: unknown })?.children), 0) : 0);

  server.registerTool(
    "luu_menu",
    {
      description: "Lưu menu đầu trang. Cây gửi lên THAY THẾ cả cây cũ (lấy từ xem_menu rồi sửa); main hoặc secondary không gửi thì giữ nguyên. Bỏ bớt mục so với hiện tại thì bị từ chối trừ khi gửi cho_phep_bo: true.",
      inputSchema: { main: z.array(nodeSchema).optional(), secondary: z.array(nodeSchema).optional(), cho_phep_bo: z.boolean().optional() },
    },
    async (v) => {
      const cur = await readMenu();
      for (const [ten, moi, cu] of [["menu chính", v.main, cur.main], ["menu phụ", v.secondary, cur.secondary]] as const) {
        if (moi && countNodes(moi) < countNodes(cu) && !v.cho_phep_bo) {
          return fail(`Cây ${ten} mới có ${countNodes(moi)} mục, ít hơn hiện tại (${countNodes(cu)}). Nếu đúng ý muốn bỏ bớt, gửi lại với cho_phep_bo: true.`);
        }
      }
      const f = new FormData();
      f.set("taxonomy", JSON.stringify(await readTaxonomy()));
      f.set("menu", JSON.stringify({ main: v.main ?? cur.main, secondary: v.secondary ?? cur.secondary }));
      const r = await saveTaxonomy(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "luu_menu", "ok");
      return ok(await readMenu());
    },
  );

  server.registerTool(
    "xoa_muc_danh_muc",
    {
      description: "Xoá một hãng xe, loại xe hoặc mục tin tức. Bị từ chối nếu còn xe hoặc bài đang dùng (khi đó chỉ tắt active bằng luu_danh_muc). Không khôi phục được; phải gửi confirm: true.",
      inputSchema: { loai: z.enum(["brands", "types", "sections"]).describe("brands: hãng xe; types: loại xe; sections: mục tin tức"), id: z.string().min(1).max(60), confirm: confirmDelete },
      annotations: { destructiveHint: true },
    },
    async ({ loai, id }) => {
      const tax = await readTaxonomy();
      const list = tax[loai] as { id: string; name: string }[];
      const item = list.find((x) => x.id === id);
      if (!item) return fail(`Không có mã "${id}" trong ${loai}.`);
      const f = new FormData();
      f.set("taxonomy", JSON.stringify({ ...tax, [loai]: list.filter((x) => x.id !== id) }));
      f.set("menu", JSON.stringify(await readMenu()));
      const r = await saveTaxonomy(f);
      if ("error" in r) return fail(r.error);
      refreshSite();
      logWrite(ctx, "xoa_muc_danh_muc", `${loai} id=${id}`);
      return ok({ da_xoa: { loai, id, name: item.name } });
    },
  );
}
