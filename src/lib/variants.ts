import type { SpecGroup, Variant, VariantAttr } from "./products.ts";

// Pure helpers for the product page picker and for reading stored data. No path aliases: the seed
// scripts import this file directly with Node.

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export const valueOf = (v: Variant, name: string) => v.attrs.find((a) => a.name === name)?.value ?? "";

// attribute names in the order they first appear (the shop's own order)
export const attributeNames = (variants: Variant[]): string[] => uniq(variants.flatMap((v) => v.attrs.map((a) => a.name)));

// the values of one attribute, without empty ones, in order
export const optionsOf = (variants: Variant[], name: string): string[] => uniq(variants.map((v) => valueOf(v, name)).filter(Boolean));

// the colour attribute is shown as photo swatches, every other attribute as text buttons
export const isColorAttribute = (name: string) => /màu|color/i.test(name);

// Choosing `value` for attribute `name`: among the variants that have it, take the one that agrees with the
// current selection on the most other attributes (ties: the first). So picking a colour keeps the current version
// when that version comes in this colour, otherwise it moves to the closest variant that does.
export function pickOption(variants: Variant[], name: string, value: string, current: Variant | null): Variant | null {
  return pickClosest(variants, variants.filter((v) => valueOf(v, name) === value), current, name);
}

// the candidate that agrees with `current` on the most attributes (other than `except`); ties: the first
export function pickClosest(variants: Variant[], candidates: Variant[], current: Variant | null, except = ""): Variant | null {
  if (!candidates.length) return null;
  if (!current) return candidates[0];
  const names = attributeNames(variants).filter((n) => n !== except);
  const score = (v: Variant) => names.filter((n) => valueOf(v, n) === valueOf(current, n)).length;
  return candidates.reduce((best, c) => (score(c) > score(best) ? c : best));
}

// is `value` available together with everything else already chosen? (used to dim options)
export function isAvailable(variants: Variant[], name: string, value: string, current: Variant | null): boolean {
  if (!current) return true;
  const others = attributeNames(variants).filter((n) => n !== name && valueOf(current, n));
  return variants.some((v) => valueOf(v, name) === value && others.every((n) => valueOf(v, n) === valueOf(current, n)));
}

// Reads what is stored in the database or in src/content. Older data had {version, color, img, price}.
export function normalizeVariants(raw: unknown): Variant[] {
  if (!Array.isArray(raw)) return [];
  const out: Variant[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    let attrs: VariantAttr[] = [];
    if (Array.isArray(r.attrs)) {
      attrs = (r.attrs as Partial<VariantAttr>[])
        .map((a) => ({ name: String(a?.name ?? "").trim(), value: String(a?.value ?? "").trim() }))
        .filter((a) => a.name);
    } else {
      if (r.version) attrs.push({ name: "Phiên bản", value: String(r.version) });
      if (r.color) attrs.push({ name: "Màu sắc", value: String(r.color) });
    }
    if (!attrs.some((a) => a.value)) continue;
    out.push({ attrs, img: typeof r.img === "string" && r.img ? r.img : null, price: Number(r.price) || 0 });
  }
  return out;
}

// Reads the technical specification groups from the database or src/content.
export function normalizeSpecs(raw: unknown): SpecGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: SpecGroup[] = [];
  for (const g of raw as Record<string, unknown>[]) {
    const title = String(g?.title ?? "").trim();
    const items = (Array.isArray(g?.items) ? (g.items as Record<string, unknown>[]) : [])
      .map((i) => ({ label: String(i?.label ?? "").trim(), value: String(i?.value ?? "").trim() }))
      .filter((i) => i.label);
    if (title && items.length) out.push({ title, items });
  }
  return out;
}
