import { query } from "./db.ts";
import type { HeroSlide } from "./defaults.ts";
import { PAGE_SIZE, type PostDetailData, type PostSummary } from "./posts.ts";
import type { ProductDetailData, ProductSummary } from "./products.ts";
import { normalizeHomeSections, SETTING_KEY, type HomeSection, defaultSections } from "./home-sections.ts";
import { cache } from "react";
import { defaultMenu, MENU_KEY, normalizeMenu, resolveMenu, type Menu, type Nav } from "./menu.ts";
import { COLLECTIONS_KEY, normalizeCollections, type Collection } from "./collections.ts";
import { activeOnly, defaultTaxonomy, normalizeTaxonomy, TAXONOMY_KEY, type Taxonomy } from "./taxonomy.ts";
import { normalizeSpecs, normalizeVariants } from "./variants.ts";
import { MAX_TEMPLATES, parseTemplateJson, TEMPLATES_KEY, type Template } from "./template.ts";
import { BUILTIN_TEMPLATES } from "./template-samples.ts";

// Read side used by the public site. Only published posts / active products are returned.
// Admin code uses its own queries (src/lib/admin-repo.ts) so it can see hidden rows too.

type PostRow = { id: number; slug: string; title: string; date: string; section: string; excerpt: string; img: string | null; html?: string; published: number };
type ProductRow = {
  id: number; slug: string; code?: string | null; name: string; brand: string; types: string[]; price: number; price_max: number;
  img: string | null; gallery?: string[]; colors?: string[]; variants?: unknown; specs?: unknown; short_html?: string; html?: string; active: number;
};

const postSummary = (r: PostRow): PostSummary => ({ slug: r.slug, title: r.title, date: r.date, section: r.section, excerpt: r.excerpt, img: r.img });
const productSummary = (r: ProductRow): ProductSummary => ({
  slug: r.slug, name: r.name, brand: r.brand, types: r.types ?? [], price: Number(r.price), priceMax: Math.max(Number(r.price), Number(r.price_max)), img: r.img,
});

const POST_COLS = "id, slug, title, date, section, excerpt, img, published";

export async function getPostsPage(section: string | null, page: number) {
  const where = section ? "published = 1 AND section = ?" : "published = 1";
  const args = section ? [section] : [];
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts WHERE ${where}`, args);
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pages);
  const rows = await query<PostRow>(
    `SELECT ${POST_COLS} FROM posts WHERE ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    [...args, PAGE_SIZE, (cur - 1) * PAGE_SIZE],
  );
  return { items: rows.map(postSummary), total: n, pages, page: cur };
}

export async function getLatestPosts(limit: number, withImage = false): Promise<PostSummary[]> {
  const rows = await query<PostRow>(
    `SELECT ${POST_COLS} FROM posts WHERE published = 1 ${withImage ? "AND img IS NOT NULL" : ""} ORDER BY date DESC, id DESC LIMIT ?`,
    [limit],
  );
  return rows.map(postSummary);
}

export async function getRelatedPosts(slug: string, section: string, limit: number): Promise<PostSummary[]> {
  const rows = await query<PostRow>(
    `SELECT ${POST_COLS} FROM posts WHERE published = 1 AND img IS NOT NULL AND section = ? AND slug <> ? ORDER BY date DESC, id DESC LIMIT ?`,
    [section, slug, limit],
  );
  return rows.map(postSummary);
}

export async function getPostBySlug(slug: string): Promise<PostDetailData | null> {
  const [r] = await query<PostRow>(`SELECT ${POST_COLS}, html FROM posts WHERE slug = ? AND published = 1`, [slug]);
  return r ? { ...postSummary(r), id: r.id, html: r.html ?? "", published: !!r.published } : null;
}

export async function getProducts(): Promise<ProductSummary[]> {
  const rows = await query<ProductRow>("SELECT id, slug, name, brand, types, price, price_max, img, active FROM products WHERE active = 1 ORDER BY name");
  return rows.map(productSummary);
}

export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  const [r] = await query<ProductRow>("SELECT * FROM products WHERE slug = ? AND active = 1", [slug]);
  return r
    ? { ...productSummary(r), id: r.id, code: r.code ?? "", gallery: r.gallery ?? [], colors: r.colors ?? [], variants: normalizeVariants(r.variants), specs: normalizeSpecs(r.specs), shortHtml: r.short_html ?? "", html: r.html ?? "", active: !!r.active }
    : null;
}

export async function getRelatedProducts(brand: string, slug: string, limit: number): Promise<ProductSummary[]> {
  const rows = await query<ProductRow>(
    "SELECT id, slug, name, brand, types, price, price_max, img, active FROM products WHERE active = 1 AND brand = ? AND slug <> ? AND img IS NOT NULL ORDER BY name LIMIT ?",
    [brand, slug, limit],
  );
  return rows.map(productSummary);
}

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const rows = await query<Omit<HeroSlide, "dim" | "fit"> & { dim: number; fit: string }>("SELECT eyebrow, title, sub, img, img_mobile AS imgMobile, fit, link, dim FROM hero_slides WHERE active = 1 ORDER BY sort, id");
  return rows.map((r) => ({ ...r, dim: !!r.dim, fit: r.fit === "natural" ? ("natural" as const) : ("cover" as const) }));
}

export async function getPostSections(): Promise<string[]> {
  const rows = await query<{ section: string }>("SELECT DISTINCT section FROM posts WHERE published = 1");
  return rows.map((r) => r.section);
}

// the home page blocks the admin arranged (all of them, hidden ones included); the brand blocks until it is saved
export async function getHomeSections(): Promise<HomeSection[]> {
  const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [SETTING_KEY]);
  const brands = activeOnly((await getTaxonomy()).brands);
  return row ? normalizeHomeSections(row.v, brands) : defaultSections(brands);
}

// brands, product types and news sections (once per request: the layout and the page both ask for it)
export const getTaxonomy = cache(async (): Promise<Taxonomy> => {
  try {
    const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [TAXONOMY_KEY]);
    return row ? normalizeTaxonomy(row.v) : defaultTaxonomy();
  } catch (e) {
    console.error("getTaxonomy: using defaults", e instanceof Error ? e.message : e);
    return defaultTaxonomy();
  }
});

// the header menu as the admin arranged it (the old fixed menu until it is saved)
export const getMenuConfig = cache(async (): Promise<Menu> => {
  try {
    const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [MENU_KEY]);
    return row ? normalizeMenu(row.v) : defaultMenu();
  } catch (e) {
    console.error("getMenuConfig: using defaults", e instanceof Error ? e.message : e);
    return defaultMenu();
  }
});

// the menu with every source filled in, ready to draw
export const getNav = cache(async (): Promise<Nav> => {
  const [menu, tax, collections] = await Promise.all([getMenuConfig(), getTaxonomy(), getCollections()]);
  return resolveMenu(menu, tax, collections);
});

// the product collections (hidden ones included; callers filter)
// templates made in the admin (kept in settings), and those plus the ones that come with the site
export const getCustomTemplates = cache(async (): Promise<Template[]> => {
  try {
    const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [TEMPLATES_KEY]);
    const raw = row && Array.isArray(row.v) ? (row.v as { id?: unknown }[]) : [];
    const out: Template[] = [];
    for (const r of raw.slice(0, MAX_TEMPLATES)) {
      const id = String(r?.id ?? "").trim();
      const p = parseTemplateJson(r);
      if (id && "template" in p) out.push({ id, ...p.template });
    }
    return out;
  } catch (e) {
    console.error("getCustomTemplates: none", e instanceof Error ? e.message : e);
    return [];
  }
});
export const getAllTemplates = async (): Promise<Template[]> => [...BUILTIN_TEMPLATES, ...(await getCustomTemplates())];

export const getCollections = cache(async (): Promise<Collection[]> => {
  try {
    const [row] = await query<{ v: unknown }>("SELECT v FROM settings WHERE k = ?", [COLLECTIONS_KEY]);
    return row ? normalizeCollections(row.v) : [];
  } catch (e) {
    console.error("getCollections: none", e instanceof Error ? e.message : e);
    return [];
  }
});
