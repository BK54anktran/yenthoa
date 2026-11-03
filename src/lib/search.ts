import { query } from "./db.ts";
import type { Brand } from "./taxonomy.ts";
import type { PostSummary } from "./posts.ts";
import type { ProductSummary } from "./products.ts";

// Site search over products (name, brand) and posts (title, excerpt). It ignores accents, including d / đ, which
// MySQL's utf8mb4_unicode_ci would treat as different letters: "xe dien" finds "Xe điện". Every word of the
// query has to match (in any order). Values only ever go in as query parameters.
export const MAX_PRODUCTS = 48;
export const MAX_POSTS = 30;

// "  Xe  Điện " -> "Xe Dien"
const fold = (s: string) => s.normalize("NFC").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/\s+/g, " ").trim();
// the same thing for the column side, evaluated in SQL
const col = (c: string) => `REPLACE(REPLACE(${c}, 'đ', 'd'), 'Đ', 'D')`;
const like = (t: string) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
// brand names without accents, for matching "honda" or "xe 50cc" against the brand of a product
const brandIdsFor = (all: Brand[], token: string) =>
  all.filter((b) => fold(b.name).toLowerCase().includes(token.toLowerCase()) || b.id.includes(token.toLowerCase())).map((b) => b.id);

export function tokensOf(q: string): string[] {
  return fold(q.slice(0, 120)).split(" ").filter(Boolean).map((t) => t.slice(0, 40)).slice(0, 6);
}

type ProductRow = { slug: string; name: string; brand: string; types: string[]; price: number; price_max: number; img: string | null };
type PostRow = { slug: string; title: string; date: string; section: string; excerpt: string; img: string | null };

export async function searchSite(q: string, allBrands: Brand[]): Promise<{ tokens: string[]; products: ProductSummary[]; posts: PostSummary[] }> {
  const tokens = tokensOf(q);
  if (tokens.length === 0) return { tokens, products: [], posts: [] };
  const phrase = tokens.join(" ");

  const pWhere: string[] = [];
  const pArgs: unknown[] = [];
  for (const t of tokens) {
    const brands = brandIdsFor(allBrands, t);
    pWhere.push(`(${col("name")} LIKE ?${brands.length ? ` OR brand IN (${brands.map(() => "?").join(",")})` : ""})`);
    pArgs.push(like(t), ...brands);
  }
  const products = await query<ProductRow>(
    `SELECT slug, name, brand, types, price, price_max, img FROM products WHERE active = 1 AND ${pWhere.join(" AND ")}
     ORDER BY (${col("name")} LIKE ?) DESC, name LIMIT ${MAX_PRODUCTS}`,
    [...pArgs, like(phrase)],
  );

  const tWhere: string[] = [];
  const tArgs: unknown[] = [];
  for (const t of tokens) {
    tWhere.push(`(${col("title")} LIKE ? OR ${col("excerpt")} LIKE ?)`);
    tArgs.push(like(t), like(t));
  }
  const posts = await query<PostRow>(
    `SELECT slug, title, date, section, excerpt, img FROM posts WHERE published = 1 AND ${tWhere.join(" AND ")}
     ORDER BY (${col("title")} LIKE ?) DESC, date DESC, id DESC LIMIT ${MAX_POSTS}`,
    [...tArgs, like(phrase)],
  );

  return {
    tokens,
    products: products.map((r) => ({
      slug: r.slug, name: r.name, brand: r.brand, types: r.types ?? [], price: Number(r.price), priceMax: Math.max(Number(r.price), Number(r.price_max)), img: r.img,
    })),
    posts: posts.map((r) => ({ slug: r.slug, title: r.title, date: r.date, section: r.section, excerpt: r.excerpt, img: r.img })),
  };
}
