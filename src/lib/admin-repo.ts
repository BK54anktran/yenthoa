import { query } from "./db.ts";
import type { PostDetailData } from "./posts.ts";
import type { ProductDetailData } from "./products.ts";
import { normalizeSpecs, normalizeVariants } from "./variants.ts";

// Admin read side: unlike repo.ts it also returns hidden posts and inactive products.
export const ADMIN_PAGE = 20;

type PostRow = { id: number; slug: string; title: string; date: string; section: string; excerpt: string; img: string | null; html: string; published: number };
type ProductRow = {
  id: number; slug: string; code: string | null; name: string; brand: string; types: string[]; price: number; price_max: number;
  img: string | null; gallery: string[]; colors: string[]; variants: unknown; specs: unknown; short_html: string; html: string; active: number;
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listPosts(q: string, page: number) {
  const where = q ? "WHERE title LIKE ? OR slug LIKE ?" : "";
  const args = q ? [like(q), like(q)] : [];
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts ${where}`, args);
  const pages = Math.max(1, Math.ceil(n / ADMIN_PAGE));
  const cur = Math.min(Math.max(1, page), pages);
  const rows = await query<Omit<PostRow, "html" | "excerpt" | "img">>(
    `SELECT id, slug, title, date, section, published FROM posts ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    [...args, ADMIN_PAGE, (cur - 1) * ADMIN_PAGE],
  );
  return { rows, total: n, pages, page: cur };
}

export async function getPostById(id: number): Promise<PostDetailData | null> {
  const [r] = await query<PostRow>("SELECT * FROM posts WHERE id = ?", [id]);
  return r ? { id: r.id, slug: r.slug, title: r.title, date: r.date, section: r.section, excerpt: r.excerpt, img: r.img, html: r.html, published: !!r.published } : null;
}

export async function listProductsAdmin(q: string, page: number) {
  const where = q ? "WHERE name LIKE ? OR slug LIKE ? OR code LIKE ?" : "";
  const args = q ? [like(q), like(q), like(q)] : [];
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM products ${where}`, args);
  const pages = Math.max(1, Math.ceil(n / ADMIN_PAGE));
  const cur = Math.min(Math.max(1, page), pages);
  const rows = await query<Pick<ProductRow, "id" | "slug" | "code" | "img" | "name" | "brand" | "price" | "price_max" | "active">>(
    `SELECT id, slug, code, img, name, brand, price, price_max, active FROM products ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...args, ADMIN_PAGE, (cur - 1) * ADMIN_PAGE],
  );
  return { rows, total: n, pages, page: cur };
}

export async function getProductById(id: number): Promise<ProductDetailData | null> {
  const [r] = await query<ProductRow>("SELECT * FROM products WHERE id = ?", [id]);
  return r
    ? {
        id: r.id, slug: r.slug, code: r.code ?? "", name: r.name, brand: r.brand, types: r.types ?? [], price: Number(r.price), priceMax: Number(r.price_max),
        img: r.img, gallery: r.gallery ?? [], colors: r.colors ?? [], variants: normalizeVariants(r.variants), specs: normalizeSpecs(r.specs), shortHtml: r.short_html, html: r.html, active: !!r.active,
      }
    : null;
}

export async function dashboardCounts() {
  const [p] = await query<{ total: number; hidden: number }>("SELECT COUNT(*) AS total, SUM(published = 0) AS hidden FROM posts");
  const [x] = await query<{ total: number; hidden: number }>("SELECT COUNT(*) AS total, SUM(active = 0) AS hidden FROM products");
  const [s] = await query<{ total: number }>("SELECT COUNT(*) AS total FROM hero_slides");
  return { posts: Number(p.total), postsHidden: Number(p.hidden ?? 0), products: Number(x.total), productsHidden: Number(x.hidden ?? 0), slides: Number(s.total) };
}

export type SlideRow = { eyebrow: string; title: string; sub: string; img: string; link: string; active: boolean };
export async function getAllSlides(): Promise<SlideRow[]> {
  const rows = await query<Omit<SlideRow, "link" | "active"> & { link: string | null; active: number }>("SELECT eyebrow, title, sub, img, link, active FROM hero_slides ORDER BY sort, id");
  // a banner that never had a link keeps the site default (/xe-may) until the admin saves it
  return rows.map((r) => ({ ...r, link: r.link ?? "/xe-may", active: !!r.active }));
}

// how many products / posts use each brand, type and news section (a used one cannot be deleted)
export async function taxonomyUsage(): Promise<{ brands: Record<string, number>; types: Record<string, number>; sections: Record<string, number> }> {
  const out = { brands: {} as Record<string, number>, types: {} as Record<string, number>, sections: {} as Record<string, number> };
  const bump = (m: Record<string, number>, k: string) => { if (k) m[k] = (m[k] ?? 0) + 1; };
  for (const r of await query<{ brand: string | null; types: string[] | null }>("SELECT brand, types FROM products")) {
    bump(out.brands, r.brand ?? "");
    for (const t of r.types ?? []) bump(out.types, t);
  }
  for (const r of await query<{ section: string }>("SELECT section FROM posts")) bump(out.sections, r.section);
  return out;
}
