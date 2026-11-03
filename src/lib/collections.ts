import type { ProductSummary } from "./products.ts";

// Collections, like Shopify: a named group of products with a page of its own, reusable on the home page and in the menu.
//  - manual: exactly the products the shop picked, in that order
//  - auto: every active product that matches the rules (brands, types, price range), by name
export type Collection = {
  id: string; // in the address: /bo-suu-tap/<id>
  name: string;
  description: string; // one or two lines under the title
  html: string; // the detailed description shown on the collection page (HTML, cleaned on save)
  image: string;
  backdrop: string; // studio background behind the big photo when the home page shows it as a showcase ("" = plain white)
  backdropMobile?: string; // the same on phones ("" = plain white)
  dark: boolean; // dark background: white text
  mode: "manual" | "auto";
  slugs: string[]; // manual
  brands: string[]; // auto: any of these brands (empty = any)
  types: string[]; // auto: any of these types (empty = any)
  priceMin: number; // auto: 0 = no limit
  priceMax: number; // auto: 0 = no limit
  active: boolean;
};

export const COLLECTIONS_KEY = "collections";
export const MAX_COLLECTIONS = 60;
export const collectionHref = (id: string) => `/bo-suu-tap/${id}`;

const str = (v: unknown) => String(v ?? "").trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

export function normalizeCollections(raw: unknown): Collection[] {
  if (!Array.isArray(raw)) return [];
  const out: Collection[] = [];
  for (const r of raw as Partial<Collection>[]) {
    if (!r || typeof r !== "object" || !str(r.id) || !str(r.name)) continue;
    out.push({
      id: str(r.id), name: str(r.name), description: str(r.description), html: typeof r.html === "string" ? r.html : "", image: str(r.image), backdrop: str(r.backdrop), backdropMobile: str(r.backdropMobile), dark: !!r.dark,
      mode: r.mode === "auto" ? "auto" : "manual",
      slugs: list(r.slugs), brands: list(r.brands), types: list(r.types), priceMin: num(r.priceMin), priceMax: num(r.priceMax),
      active: r.active !== false,
    });
  }
  return out;
}

// the products of a collection out of the active products (a hidden or deleted product just drops out)
export function productsOf(c: Collection, products: ProductSummary[]): ProductSummary[] {
  if (c.mode === "manual") {
    const by = new Map(products.map((p) => [p.slug, p]));
    return c.slugs.map((s) => by.get(s)).filter((p): p is ProductSummary => !!p);
  }
  return products.filter(
    (p) =>
      (c.brands.length === 0 || c.brands.includes(p.brand)) &&
      (c.types.length === 0 || p.types.some((t) => c.types.includes(t))) &&
      (!c.priceMin || p.price >= c.priceMin) &&
      (!c.priceMax || p.price <= c.priceMax),
  );
}
