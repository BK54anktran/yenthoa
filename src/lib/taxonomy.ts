import { BRANDS, NEWS_SECTIONS, PRODUCT_TYPES } from "./defaults.ts";

// The lists the shop sorts things by: brands and product types for the cars, sections for the news.
// The admin edits them; until it is saved the site uses the defaults from defaults.ts.
//  - active = false: hidden from the menu, filters and pickers (existing products and posts keep it)
//  - brand.menu: which dropdown of the header it shows in ("" = none)
//  - section.menu: shows in the "Tin tức" dropdown of the header
export type Term = { id: string; name: string; active: boolean };
export type BrandMenu = "" | "xe-may" | "xe-dien";
export type Brand = Term & { menu: BrandMenu };
export type Section = Term & { menu: boolean };
export type Taxonomy = { brands: Brand[]; types: Term[]; sections: Section[] };

export const BRAND_MENUS: { id: BrandMenu; label: string }[] = [
  { id: "xe-may", label: "Menu Xe máy" },
  { id: "xe-dien", label: "Menu Xe điện" },
  { id: "", label: "Không hiện trên menu" },
];

export const TAXONOMY_KEY = "taxonomy";

export function defaultTaxonomy(): Taxonomy {
  return {
    brands: BRANDS.map((b) => ({ id: b.id, name: b.name, active: true, menu: b.id === "yadea" || b.id === "xe-dien-yamaha" ? "xe-dien" : "xe-may" })),
    types: PRODUCT_TYPES.map((t) => ({ id: t.id, name: t.name, active: true })),
    sections: NEWS_SECTIONS.map((s) => ({ id: s.slug, name: s.name, active: true, menu: s.slug === "thi-truong" || s.slug === "xe-may" })),
  };
}

type Raw = { id?: unknown; name?: unknown; active?: unknown; menu?: unknown };
const rows = (raw: unknown): Raw[] =>
  Array.isArray(raw) ? (raw as Raw[]).filter((r) => r && typeof r === "object" && String(r.id ?? "").trim() && String(r.name ?? "").trim()) : [];
const term = (x: Raw): Term => ({ id: String(x.id).trim(), name: String(x.name).trim(), active: x.active !== false });

// tolerant reader for what is stored in the database; a list that was never saved falls back to its defaults
export function normalizeTaxonomy(raw: unknown): Taxonomy {
  const d = defaultTaxonomy();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    brands: Array.isArray(r.brands) ? rows(r.brands).map((x) => ({ ...term(x), menu: (x.menu === "xe-may" || x.menu === "xe-dien" ? x.menu : "") as BrandMenu })) : d.brands,
    types: Array.isArray(r.types) ? rows(r.types).map(term) : d.types,
    sections: Array.isArray(r.sections) ? rows(r.sections).map((x) => ({ ...term(x), menu: !!x.menu })) : d.sections,
  };
}

export const activeOnly = <T extends Term>(l: T[]) => l.filter((x) => x.active);
export const brandName = (t: Pick<Taxonomy, "brands">, id: string) => t.brands.find((b) => b.id === id)?.name ?? "Xe máy";
export const typeName = (t: Pick<Taxonomy, "types">, id: string) => t.types.find((x) => x.id === id)?.name ?? "";
export const sectionName = (t: Pick<Taxonomy, "sections">, id: string) => t.sections.find((s) => s.id === id)?.name ?? "Tin tức";
