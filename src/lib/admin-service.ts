import { revalidatePath } from "next/cache";
import { exec, query, transaction } from "@/lib/db";
import { type Shop, type Store } from "@/lib/defaults";
import { taxonomyUsage } from "@/lib/admin-repo";
import { getTaxonomy } from "@/lib/repo";
import { TAXONOMY_KEY, type BrandMenu, type Taxonomy } from "@/lib/taxonomy";
import { MAX_DEPTH, MAX_NODES, MENU_KEY, type MenuNode } from "@/lib/menu";
import { cleanHtml, htmlToText } from "@/lib/sanitize";
import type { Variant } from "@/lib/products";
import { normalizeSpecs, normalizeVariants } from "@/lib/variants";
import { slugify } from "@/lib/slug";

// The checking and saving of posts, products, shop info and the taxonomy/menu, in one place.
// Plain module (no "use server"): the admin server actions (login already checked there) and the MCP endpoint (key already checked
// there) both call these, so the rules are written once. Nothing here checks who is calling, and nothing refreshes the pages:
// the caller does assertAdmin()/the key check first and refreshSite() after.
export type Failure = { error: string };
export type Saved = Failure | { id: number };
export type Done = Failure | { ok: true };

export const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
export const num = (f: FormData, k: string) => Math.max(0, Math.round(Number(String(f.get(k) ?? "0").replace(/[^\d.]/g, "")) || 0));
export const lines = (f: FormData, k: string, max: number) => text(f, k, 20000).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, max);
// where a banner button may go: a path on this site, an anchor, any http(s) page, tel: or mailto:.
// Anything else (javascript:, data:, //host) is refused.
export const linkUrl = (v: string) => (v === "" || /^\/(?!\/)/.test(v) || /^#/.test(v) || /^https?:\/\//i.test(v) || /^(tel|mailto):/i.test(v) ? v : null);
// images: our own paths or https URLs only
export const imgUrl = (v: string) => (v === "" || /^\/[^/]/.test(v) || /^https:\/\//i.test(v) ? v : null);
export const refreshSite = () => revalidatePath("/", "layout");
export const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "ER_DUP_ENTRY";
export const parseJson = <T,>(f: FormData, k: string): T | null => {
  try {
    return JSON.parse(String(f.get(k) ?? "")) as T;
  } catch {
    return null;
  }
};
export const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// ---------------------------------------------------------------- posts
export async function savePost(f: FormData): Promise<Saved> {
  const id = Number(f.get("id") || 0);
  const title = text(f, "title", 300);
  if (!title) return { error: "Cần nhập tiêu đề." };
  const date = text(f, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Ngày không hợp lệ." };
  const section = text(f, "section", 40);
  if (!(await getTaxonomy()).sections.some((s) => s.id === section)) return { error: "Mục không hợp lệ." };
  const img = imgUrl(text(f, "img", 500));
  if (img === null) return { error: "Ảnh bìa phải là đường dẫn bắt đầu bằng / hoặc https://" };
  const slug = slugify(text(f, "slug", 191) || title);
  if (!slug) return { error: "Không tạo được đường dẫn từ tiêu đề." };
  const html = cleanHtml(String(f.get("html") ?? "").slice(0, 2_000_000));
  const excerpt = text(f, "excerpt", 600) || htmlToText(html).slice(0, 200);
  const published = f.get("published") ? 1 : 0;
  let pid = id;
  try {
    if (id) await exec("UPDATE posts SET slug=?, title=?, date=?, section=?, excerpt=?, img=?, html=?, published=? WHERE id=?", [slug, title, date, section, excerpt, img || null, html, published, id]);
    else pid = (await exec("INSERT INTO posts (slug, title, date, section, excerpt, img, html, published) VALUES (?,?,?,?,?,?,?,?)", [slug, title, date, section, excerpt, img || null, html, published])).insertId;
  } catch (e) {
    if (isDup(e)) return { error: `Đường dẫn "${slug}" đã có bài khác dùng. Hãy đổi đường dẫn.` };
    throw e;
  }
  return { id: pid };
}

export async function deletePost(id: number): Promise<Done> {
  const r = await exec("DELETE FROM posts WHERE id = ?", [id]);
  return r.affectedRows ? { ok: true } : { error: "Không tìm thấy bài viết." };
}

export async function togglePost(id: number): Promise<Done> {
  const r = await exec("UPDATE posts SET published = 1 - published WHERE id = ?", [id]);
  return r.affectedRows ? { ok: true } : { error: "Không tìm thấy bài viết." };
}

// ---------------------------------------------------------------- products
export async function saveProduct(f: FormData): Promise<Saved> {
  const id = Number(f.get("id") || 0);
  const name = text(f, "name", 200);
  if (!name) return { error: "Cần nhập tên xe." };
  const brand = text(f, "brand", 60);
  const tax = await getTaxonomy();
  if (brand && !tax.brands.some((b) => b.id === brand)) return { error: "Hãng không hợp lệ." };
  const types = f.getAll("types").map(String).filter((t) => tax.types.some((x) => x.id === t));
  const price = num(f, "price");
  const priceMax = Math.max(price, num(f, "priceMax"));
  const img = imgUrl(text(f, "img", 500));
  if (img === null) return { error: "Ảnh đại diện phải bắt đầu bằng / hoặc https://" };
  const gallery = lines(f, "gallery", 30);
  if (gallery.some((u) => imgUrl(u) === null)) return { error: "Mỗi dòng trong thư viện ảnh phải bắt đầu bằng / hoặc https://" };
  const colors = text(f, "colors", 1000).split(",").map((c) => c.trim()).filter(Boolean).slice(0, 20);
  const rawVariants = parseJson<unknown>(f, "variants") ?? [];
  if (!Array.isArray(rawVariants) || rawVariants.length > 60) return { error: "Tối đa 60 dòng phiên bản và màu." };
  const variants: Variant[] = [];
  for (const v of normalizeVariants(rawVariants)) {
    const vImg = (v.img ?? "").slice(0, 500);
    if (imgUrl(vImg) === null) return { error: "Ảnh của mỗi dòng phải bắt đầu bằng / hoặc https://" };
    const attrs = v.attrs.slice(0, 6).map((a) => ({ name: a.name.slice(0, 60), value: a.value.slice(0, 100) }));
    variants.push({ attrs, img: vImg || null, price: Math.max(0, Math.round(v.price)) });
  }
  const rawSpecs = parseJson<unknown>(f, "specs") ?? [];
  if (!Array.isArray(rawSpecs) || rawSpecs.length > 12) return { error: "Tối đa 12 nhóm thông số." };
  const specs = normalizeSpecs(rawSpecs).map((g) => ({
    title: g.title.slice(0, 80),
    items: g.items.slice(0, 60).map((i) => ({ label: i.label.slice(0, 150), value: i.value.slice(0, 300) })),
  }));
  const slug = slugify(text(f, "slug", 191) || name);
  if (!slug) return { error: "Không tạo được đường dẫn từ tên xe." };
  const code = text(f, "code", 40);
  if (code && (await query<{ id: number }>("SELECT id FROM products WHERE code = ? AND id <> ? LIMIT 1", [code, id])).length) return { error: `Mã "${code}" đã có xe khác dùng. Hãy đổi mã.` };
  const shortHtml = cleanHtml(String(f.get("shortHtml") ?? "").slice(0, 200_000));
  const html = cleanHtml(String(f.get("html") ?? "").slice(0, 2_000_000));
  const active = f.get("active") ? 1 : 0;
  const cover = img || gallery[0] || null;
  const args = [slug, code, name, brand, JSON.stringify(types), price, priceMax, cover, JSON.stringify(gallery), JSON.stringify(colors), JSON.stringify(variants), JSON.stringify(specs), shortHtml, html, active];
  let pid = id;
  try {
    if (id) await exec("UPDATE products SET slug=?, code=?, name=?, brand=?, types=?, price=?, price_max=?, img=?, gallery=?, colors=?, variants=?, specs=?, short_html=?, html=?, active=? WHERE id=?", [...args, id]);
    else pid = (await exec("INSERT INTO products (slug, code, name, brand, types, price, price_max, img, gallery, colors, variants, specs, short_html, html, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", args)).insertId;
  } catch (e) {
    if (isDup(e)) return { error: `Đường dẫn "${slug}" đã có xe khác dùng. Hãy đổi đường dẫn.` };
    throw e;
  }
  await exec("UPDATE products SET code = CONCAT('SP', LPAD(id, 4, '0')) WHERE id = ? AND (code IS NULL OR code = '')", [pid]);
  return { id: pid };
}

export async function deleteProduct(id: number): Promise<Done> {
  const r = await exec("DELETE FROM products WHERE id = ?", [id]);
  return r.affectedRows ? { ok: true } : { error: "Không tìm thấy xe." };
}

export async function toggleProduct(id: number): Promise<Done> {
  const r = await exec("UPDATE products SET active = 1 - active WHERE id = ?", [id]);
  return r.affectedRows ? { ok: true } : { error: "Không tìm thấy xe." };
}

// ---------------------------------------------------------------- shop info
export async function saveShop(f: FormData): Promise<Done> {
  const brand = text(f, "brand", 120);
  if (!brand) return { error: "Cần nhập tên cửa hàng." };
  const hotlines = lines(f, "hotlines", 6);
  if (hotlines.length === 0 || hotlines.some((h) => !/^[0-9 .+\-]{8,20}$/.test(h))) return { error: "Hotline chỉ gồm số, mỗi dòng một số (ít nhất một số)." };
  const facebook = text(f, "facebook", 500);
  if (facebook && !/^https:\/\//i.test(facebook)) return { error: "Link Facebook phải bắt đầu bằng https://" };
  const branches = lines(f, "branches", 20).map((b) => b.slice(0, 300));
  const rawStores = parseJson<Partial<Store>[]>(f, "stores");
  if (!Array.isArray(rawStores) || rawStores.length > 20) return { error: "Danh sách cửa hàng không hợp lệ." };
  const stores: Store[] = [];
  for (const s of rawStores) {
    const img = clip(s.img, 500);
    if (imgUrl(img) === null) return { error: "Ảnh cửa hàng phải bắt đầu bằng / hoặc https://" };
    if (!clip(s.name, 120)) continue;
    stores.push({ name: clip(s.name, 120), kind: clip(s.kind, 120), address: clip(s.address, 300), hours: clip(s.hours, 200), img });
  }
  const shop: Shop = { brand, hotlines, facebook, branches, stores };
  await exec("INSERT INTO settings (k, v) VALUES ('shop', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [JSON.stringify(shop)]);
  return { ok: true };
}

// ---------------------------------------------------------------- brands, types, news sections and the header menu
export async function saveTaxonomy(f: FormData): Promise<Done> {
  const raw = parseJson<Record<string, { id?: string; name?: string; active?: boolean; menu?: unknown }[]>>(f, "taxonomy");
  if (!raw || typeof raw !== "object") return { error: "Dữ liệu không hợp lệ." };
  const current = await getTaxonomy();
  const usage = await taxonomyUsage();

  const clean = <T,>(key: "brands" | "types" | "sections", label: string, extra: (r: { menu?: unknown }) => T): ({ id: string; name: string; active: boolean } & T)[] | string => {
    const rows = raw[key];
    if (!Array.isArray(rows) || rows.length > 60) return `${label}: tối đa 60 mục.`;
    const known = new Set(current[key].map((x) => x.id));
    const out: ({ id: string; name: string; active: boolean } & T)[] = [];
    const used = new Set<string>();
    for (const r of rows) {
      const name = clip(r.name, 60);
      if (!name) return `${label}: mỗi mục cần có tên.`;
      let id = clip(r.id, 60);
      if (id) {
        // an existing id never changes; anything else is made from the name
        if (!/^[a-z0-9-]{1,60}$/.test(id) || !known.has(id)) return `${label} "${name}": mã không hợp lệ.`;
      } else {
        const base = slugify(name) || "muc";
        id = base;
        for (let n = 2; used.has(id) || known.has(id); n++) id = `${base}-${n}`.slice(0, 60);
      }
      if (used.has(id)) return `${label}: bị trùng mã "${id}".`;
      used.add(id);
      out.push({ id, name, active: r.active !== false, ...extra(r) });
    }
    if (out.length === 0) return `${label}: cần ít nhất một mục.`;
    for (const old of current[key]) {
      if (!used.has(old.id) && (usage[key][old.id] ?? 0) > 0) {
        return `${label} "${old.name}" đang có ${usage[key][old.id]} ${key === "sections" ? "bài viết" : "xe"} dùng nên chưa xoá được. Hãy chuyển chúng sang mục khác hoặc chỉ tắt "Đang hiện".`;
      }
    }
    return out;
  };

  const brands = clean("brands", "Hãng", (r) => ({ menu: (r.menu === "xe-may" || r.menu === "xe-dien" ? r.menu : "") as BrandMenu }));
  const types = clean("types", "Loại xe", () => ({}));
  const sections = clean("sections", "Mục tin tức", (r) => ({ menu: !!r.menu }));
  for (const x of [brands, types, sections]) if (typeof x === "string") return { error: x };
  const next = { brands, types, sections } as Taxonomy;

  // the header menu: a tree
  const rawMenu = parseJson<{ main?: unknown; secondary?: unknown }>(f, "menu");
  if (!rawMenu || typeof rawMenu !== "object") return { error: "Menu không hợp lệ." };
  let count = 0;
  const readTree = (raw: unknown, depth: number, where: string): MenuNode[] | string => {
    if (!Array.isArray(raw)) return `${where}: dữ liệu không hợp lệ.`;
    if (depth > MAX_DEPTH) return `${where}: menu tối đa ${MAX_DEPTH} cấp.`;
    const out: MenuNode[] = [];
    for (const r of raw as Partial<MenuNode>[]) {
      const label = clip(r.label, 60);
      if (!label) return `${where}: mỗi mục menu cần có tên.`;
      if (++count > MAX_NODES) return `Menu: tối đa ${MAX_NODES} mục.`;
      const href = linkUrl(clip(r.href, 500).replace(/[\u0000-\u001f\s]/g, ""));
      if (href === null) return `Menu "${label}": đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:`;
      const source = clip(r.source, 80);
      if (source && !/^(brands:(xe-may|xe-dien|all)|sections:(menu|all)|collections:all)$/.test(source)) return `Menu "${label}": nguồn mục con không hợp lệ.`;
      const kids = source ? [] : readTree(r.children ?? [], depth + 1, `${where} > ${label}`);
      if (typeof kids === "string") return kids;
      out.push({ id: slugify(clip(r.id, 60)) || `n${count}`, label, href, active: r.active !== false, source, children: kids });
    }
    return out;
  };
  const main = readTree(rawMenu.main ?? [], 1, "Menu chính");
  if (typeof main === "string") return { error: main };
  const secondary = readTree(rawMenu.secondary ?? [], 1, "Menu phụ");
  if (typeof secondary === "string") return { error: secondary };

  await transaction(async (run) => {
    const put = "INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)";
    await run(put, [TAXONOMY_KEY, JSON.stringify(next)]);
    await run(put, [MENU_KEY, JSON.stringify({ main, secondary })]);
  });
  return { ok: true };
}
