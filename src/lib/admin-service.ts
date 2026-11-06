import { revalidatePath } from "next/cache";
import { exec, query, transaction } from "@/lib/db";
import { type HeroSlide, type Shop, type Store } from "@/lib/defaults";
import { taxonomyUsage } from "@/lib/admin-repo";
import { getAllTemplates, getCollections, getCustomTemplates, getHomeSections, getTaxonomy } from "@/lib/repo";
import { cleanValues, MAX_TEMPLATES, parseTemplateJson, TEMPLATES_KEY } from "@/lib/template";
import { COLLECTIONS_KEY, MAX_COLLECTIONS, type Collection } from "@/lib/collections";
import { SETTING_KEY, MAX_CARDS, MAX_FACTS, type CornerCard, type FactItem, type HomeSection } from "@/lib/home-sections";
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
export type SavedKey = Failure | { id: string }; // rows named by a code instead of a number (collections, templates)
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

// ---------------------------------------------------------------- home page: top banners and blocks
type Slide = HeroSlide & { link: string; dim: boolean; imgMobile: string; fit: "cover" | "natural"; active: boolean };
function parseSlides(f: FormData): { error: string } | { slides: Slide[] } {
  const raw = parseJson<(Partial<HeroSlide> & { active?: boolean })[]>(f, "slides");
  if (!Array.isArray(raw) || raw.length > 10) return { error: "Tối đa 10 banner đầu trang." };
  const slides: Slide[] = [];
  for (const s of raw) {
    const title = clip(s.title, 200);
    const img = clip(s.img, 500);
    // a banner that was added and never filled in (no picture, no text) is left out instead of stopping the save
    if (!img && !title && !clip(s.sub, 300) && !clip(s.eyebrow, 200) && !clip(s.imgMobile, 500)) continue;
    if (!img || imgUrl(img) === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: ảnh phải bắt đầu bằng / hoặc https://` };
    const imgMobile = clip(s.imgMobile, 500);
    if (imgUrl(imgMobile) === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: ảnh trên điện thoại phải bắt đầu bằng / hoặc https://` };
    const link = linkUrl(clip(s.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
    if (link === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
    slides.push({ eyebrow: clip(s.eyebrow, 200), title, sub: clip(s.sub, 300), img, imgMobile, fit: s.fit === "natural" ? "natural" : "cover", link, dim: s.dim !== false, active: s.active !== false });
  }
  return { slides };
}

async function parseSections(f: FormData): Promise<{ error: string } | { sections: HomeSection[] }> {
  const raw = parseJson<Partial<HomeSection>[]>(f, "sections");
  if (!Array.isArray(raw) || raw.length > 30) return { error: "Tối đa 30 mục." };
  const tax = await getTaxonomy();
  const sections: HomeSection[] = [];
  const used = new Set<string>();
  for (const r of raw) {
    // a block that was added and never filled in at all is left out instead of stopping the save
    if (!clip(r.name, 80) && ((r.kind === "banner" && !clip(r.image, 500) && !clip(r.link, 500)) || (r.kind === "showcase" && !clip(r.brand, 60) && !clip(r.collection, 120) && !(Array.isArray(r.slugs) && r.slugs.length)))) continue;
    const name = clip(r.name, 80) || (r.kind === "html" ? "Khối HTML" : "");
    if (!name) return { error: "Mỗi mục cần có tên." };
    const banner = r.kind === "banner";
    const slidesBlock = r.kind === "slides";
    let id = slugify(clip(r.id, 60)) || slugify(name) || "muc";
    for (let n = 2; used.has(id); n++) id = `${slugify(clip(r.id, 50)) || "muc"}-${n}`;
    used.add(id);
    if (slidesBlock) {
      if (sections.some((x) => x.kind === "slides")) return { error: "Chỉ được có một mục Banner đầu trang." };
      const cardsMode = r.cardsMode === "custom" || r.cardsMode === "off" ? r.cardsMode : "auto";
      const rawCards = Array.isArray(r.cards) ? r.cards : [];
      if (rawCards.length > MAX_CARDS) return { error: `Tối đa ${MAX_CARDS} thẻ ở góc banner.` };
      const cards: CornerCard[] = [];
      for (const c of rawCards) {
        const title = clip(c?.title, 80);
        const img = clip(c?.img, 500);
        if (!title) return { error: "Mỗi thẻ ở góc banner cần có tiêu đề." };
        if (!img || imgUrl(img) === null) return { error: `Thẻ "${title}": cần chọn ảnh (đường dẫn bắt đầu bằng / hoặc https://).` };
        const link = linkUrl(clip(c?.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
        if (link === null || link === "") return { error: `Thẻ "${title}": cần đường dẫn bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
        cards.push({ title, img, link });
      }
      if (cardsMode === "custom" && cards.length === 0) return { error: "Chọn kiểu thẻ tự tạo thì cần ít nhất một thẻ (hoặc đổi sang tự động / ẩn)." };
      sections.push({ id, kind: "slides", image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, cardsMode, cards });
      continue;
    }
    if (r.kind === "template") {
      const tpl = (await getAllTemplates()).find((x) => x.id === r.templateId);
      if (!tpl) return { error: `Mục "${clip(r.name, 80) || "mẫu"}": mẫu không còn tồn tại.` };
      const cv = cleanValues(tpl.fields, r.values, { html: cleanHtml, image: (s) => imgUrl(s), link: (s) => linkUrl(s) });
      if ("error" in cv) return { error: `Mục "${name || tpl.name}": ${cv.error}` };
      sections.push({ id, kind: "template", image: "", link: "", name: name || tpl.name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, templateId: tpl.id, values: cv.values });
      continue;
    }
    if (r.kind === "facts") {
      if (sections.some((x) => x.kind === "facts")) return { error: "Chỉ được có một mục Dải số liệu." };
      const rawItems = Array.isArray(r.factItems) ? r.factItems : [];
      if (rawItems.length > MAX_FACTS) return { error: `Tối đa ${MAX_FACTS} số liệu.` };
      const factItems: FactItem[] = [];
      for (const x of rawItems) {
        const auto = x?.auto === "products" || x?.auto === "brands" || x?.auto === "branches" ? x.auto : "";
        const label = clip(x?.label, 40);
        const value = clip(x?.value, 12);
        if (!label) return { error: "Mỗi số liệu cần có chữ mô tả (ví dụ \"hãng xe\")." };
        if (!auto && !value) return { error: `Số liệu "${label}": chọn cách tự đếm hoặc nhập số.` };
        factItems.push({ label, value: auto ? "" : value, auto });
      }
      sections.push({ id, kind: "facts", image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, factItems, factCall: clip(r.factCall, 80) });
      continue;
    }
    if (r.kind === "html") {
      const html = cleanHtml(String(r.html ?? "").slice(0, 100_000));
      sections.push({ id, kind: "html", html, image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    if (r.kind === "collections") {
      if (sections.some((x) => x.kind === "collections")) return { error: "Chỉ được có một mục Bộ sưu tập." };
      // empty = show every collection; otherwise only the picked ones, in this order
      const known = new Set((await getCollections()).map((c) => c.id));
      const picked = [...new Set((Array.isArray(r.slugs) ? r.slugs : []).map((x) => clip(x, 120)))].filter((x) => known.has(x));
      sections.push({ id, kind: "collections", display: r.display === "cards" ? "cards" : "showcase", image: "", link: "", name, collection: "", brand: "", slugs: picked, backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    if (banner) {
      const image = clip(r.image, 500);
      if (!image || imgUrl(image) === null) return { error: `Banner "${name}": cần chọn ảnh (đường dẫn bắt đầu bằng / hoặc https://).` };
      const link = linkUrl(clip(r.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
      if (link === null) return { error: `Banner "${name}": đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
      sections.push({ id, kind: "banner", image, link, name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    const collection = clip(r.collection, 120);
    if (collection && !(await getCollections()).some((c) => c.id === collection)) return { error: `Mục "${name}": bộ sưu tập không còn tồn tại.` };
    const brand = clip(r.brand, 60);
    if (brand && !tax.brands.some((b) => b.id === brand)) return { error: `Mục "${name}": hãng không hợp lệ.` };
    const slugs = [...new Set((Array.isArray(r.slugs) ? r.slugs : []).map((x) => clip(x, 120)).filter(Boolean))].slice(0, 80);
    if (!collection && !brand && slugs.length === 0) return { error: `Mục "${name}": chọn hãng, bộ sưu tập hoặc thêm ít nhất một xe vào danh sách.` };
    const backdrop = clip(r.backdrop, 500);
    if (imgUrl(backdrop) === null) return { error: `Mục "${name}": ảnh nền phải bắt đầu bằng / hoặc https://` };
    const backdropMobile = clip(r.backdropMobile, 500);
    if (imgUrl(backdropMobile) === null) return { error: `Mục "${name}": ảnh nền trên điện thoại phải bắt đầu bằng / hoặc https://` };
    sections.push({ id, kind: "showcase", image: "", link: "", name, collection, brand, slugs, backdrop, backdropMobile, dark: !!r.dark, active: r.active !== false });
  }
  return { sections };
}

export async function saveHome(f: FormData): Promise<Done> {
  const s = parseSlides(f);
  if ("error" in s) return { error: s.error };
  const c = await parseSections(f);
  if ("error" in c) return { error: c.error };
  await transaction(async (run) => {
    await run("DELETE FROM hero_slides");
    for (const [i, x] of s.slides.entries()) {
      await run("INSERT INTO hero_slides (eyebrow, title, sub, img, img_mobile, fit, link, dim, sort, active) VALUES (?,?,?,?,?,?,?,?,?,?)", [x.eyebrow, x.title, x.sub, x.img, x.imgMobile || null, x.fit, x.link, x.dim ? 1 : 0, i, x.active ? 1 : 0]);
    }
    await run("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [SETTING_KEY, JSON.stringify(c.sections)]);
  });
  return { ok: true };
}

// ---------------------------------------------------------------- collections
const putCollections = (list: Collection[]) =>
  exec("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [COLLECTIONS_KEY, JSON.stringify(list)]);

export async function createCollection(f: FormData): Promise<SavedKey> {
  const name = clip(f.get("name"), 80);
  if (!name) return { error: "Cần nhập tên bộ sưu tập." };
  const all = await getCollections();
  if (all.length >= MAX_COLLECTIONS) return { error: `Tối đa ${MAX_COLLECTIONS} bộ sưu tập.` };
  const base = slugify(name) || "bo-suu-tap";
  let id = base;
  for (let n = 2; all.some((c) => c.id === id); n++) id = `${base}-${n}`.slice(0, 120);
  await putCollections([...all, { id, name, description: "", html: "", image: "", backdrop: "", dark: false, mode: "manual", slugs: [], brands: [], types: [], priceMin: 0, priceMax: 0, active: true }]);
  return { id };
}

export async function saveCollection(f: FormData): Promise<SavedKey> {
  const id = clip(f.get("id"), 120);
  const all = await getCollections();
  if (!all.some((c) => c.id === id)) return { error: "Không tìm thấy bộ sưu tập này." };
  let raw: Partial<Collection>;
  try {
    raw = JSON.parse(String(f.get("collection") ?? ""));
  } catch {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const name = clip(raw.name, 80);
  if (!name) return { error: "Cần nhập tên bộ sưu tập." };
  const image = clip(raw.image, 500);
  if (imgUrl(image) === null) return { error: "Ảnh phải bắt đầu bằng / hoặc https://" };
  const backdrop = clip(raw.backdrop, 500);
  if (imgUrl(backdrop) === null) return { error: "Ảnh nền phải bắt đầu bằng / hoặc https://" };
  const backdropMobile = clip(raw.backdropMobile, 500);
  if (imgUrl(backdropMobile) === null) return { error: "Ảnh nền trên điện thoại phải bắt đầu bằng / hoặc https://" };
  const tax = await getTaxonomy();
  const mode = raw.mode === "auto" ? "auto" : "manual";
  const slugs = [...new Set((Array.isArray(raw.slugs) ? raw.slugs : []).map((x) => clip(x, 191)).filter(Boolean))].slice(0, 200);
  const brands = (Array.isArray(raw.brands) ? raw.brands : []).map((x) => clip(x, 60)).filter((b) => tax.brands.some((x) => x.id === b));
  const types = (Array.isArray(raw.types) ? raw.types : []).map((x) => clip(x, 60)).filter((t) => tax.types.some((x) => x.id === t));
  const money = (v: unknown) => Math.max(0, Math.round(Number(String(v ?? "0").replace(/[^\d.]/g, "")) || 0));
  const priceMin = money(raw.priceMin);
  const priceMax = money(raw.priceMax);
  if (priceMax && priceMin > priceMax) return { error: "Giá từ phải nhỏ hơn hoặc bằng giá đến." };
  if (mode === "manual" && slugs.length === 0 && raw.active !== false) return { error: "Bộ sưu tập chọn tay cần ít nhất một xe (hoặc tắt hiển thị)." };
  const next: Collection = { id, name, description: cleanHtml(String(raw.description ?? "").slice(0, 5000)), html: cleanHtml(String(raw.html ?? "").slice(0, 200_000)), image, backdrop, backdropMobile, dark: !!raw.dark, mode, slugs, brands, types, priceMin, priceMax, active: raw.active !== false };
  await putCollections(all.map((c) => (c.id === id ? next : c)));
  return { id };
}

export async function moveCollection(id: string, dir: "up" | "down"): Promise<Done> {
  const all = await getCollections();
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) return { error: "Không tìm thấy bộ sưu tập này." };
  const j = i + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j], all[i]];
  await putCollections(all);
  return { ok: true };
}

export async function deleteCollection(id: string): Promise<Done> {
  const all = await getCollections();
  if (!all.some((c) => c.id === id)) return { error: "Không tìm thấy bộ sưu tập này." };
  await putCollections(all.filter((c) => c.id !== id));
  return { ok: true };
}

// ---------------------------------------------------------------- templates (home page blocks made from HTML)
const putTemplates = (list: { id: string; name: string; description: string; html: string; fields: unknown }[]) =>
  exec("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [TEMPLATES_KEY, JSON.stringify(list.map((t) => ({ id: t.id, name: t.name, description: t.description, html: t.html, fields: t.fields })))]);

// a free id for a new template: tc-<name>, tc-<name>-2, ...
async function freeTemplateId(name: string): Promise<string> {
  const all = await getAllTemplates();
  const base = `tc-${slugify(name) || "mau"}`.slice(0, 60);
  let id = base;
  for (let n = 2; all.some((t) => t.id === id); n++) id = `${base}-${n}`;
  return id;
}

// saves a whole template (JSON in the field "template"); no "id" = a new template
export async function saveTemplate(f: FormData): Promise<SavedKey> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(f.get("template") ?? ""));
  } catch {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const p = parseTemplateJson(raw);
  if ("error" in p) return { error: p.error };
  const id = String(f.get("id") ?? "").trim();
  const custom = await getCustomTemplates();
  if (!id) {
    if (custom.length >= MAX_TEMPLATES) return { error: `Tối đa ${MAX_TEMPLATES} mẫu.` };
    const nid = await freeTemplateId(p.template.name);
    await putTemplates([...custom, { id: nid, ...p.template }]);
    return { id: nid };
  }
  if (!custom.some((t) => t.id === id)) return { error: "Không tìm thấy mẫu này (mẫu có sẵn không sửa được, hãy tạo bản sao)." };
  await putTemplates(custom.map((t) => (t.id === id ? { id, ...p.template } : t)));
  return { id };
}

// a copy of any template (also of the ones that come with the site) that can be edited
export async function duplicateTemplate(id: string): Promise<SavedKey> {
  const src = (await getAllTemplates()).find((t) => t.id === id);
  const custom = await getCustomTemplates();
  if (!src) return { error: "Không tìm thấy mẫu này." };
  if (custom.length >= MAX_TEMPLATES) return { error: `Tối đa ${MAX_TEMPLATES} mẫu.` };
  const name = `${src.name} (bản sao)`.slice(0, 80);
  const nid = await freeTemplateId(name);
  await putTemplates([...custom, { id: nid, name, description: src.description, html: src.html, fields: src.fields }]);
  return { id: nid };
}

// deleting is refused while a block on the home page still uses the template
export async function deleteTemplate(id: string): Promise<Done> {
  const custom = await getCustomTemplates();
  if (!custom.some((t) => t.id === id)) return { error: "Không tìm thấy mẫu này." };
  const users = (await getHomeSections()).filter((s) => s.kind === "template" && s.templateId === id);
  if (users.length) return { error: `Mẫu đang được dùng ở trang chủ (${users.map((s) => s.name).join(", ")}). Xoá các mục đó trước.` };
  await putTemplates(custom.filter((t) => t.id !== id));
  return { ok: true };
}
