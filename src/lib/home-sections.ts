import { BRAND_BACKDROPS } from "./defaults.ts";

// The big "showcase" blocks on the home page (photo + carousel of models). The admin edits this list;
// until it is saved the site shows one block per brand, exactly as before.
//  - brand set, slugs empty: every active product of that brand (automatic)
//  - slugs set: exactly those products, in that order (a custom list; brand only decides the heading link)
//  - kind "banner": not a showcase but one picture (with an optional link) between the blocks
export type CornerCard = { title: string; img: string; link: string };
export const MAX_CARDS = 3;

export type HomeSection = {
  id: string; // anchor on the page
  kind: "slides" | "showcase" | "banner" | "collections" | "html"; // "slides": the rotating banners under the menu, "collections": the list of collections (one of each)
  image: string; // banner only
  link: string; // banner only: where a click goes, "" = nowhere
  name: string;
  html?: string; // html block only: free content (cleaned on save)
  display?: "showcase" | "cards"; // collections block only: one showcase (big photo + strip of models) per collection, or logo cards
  collection: string; // showcase only: take the products from this collection (overrides brand and slugs)
  brand: string; // "" for a custom block
  slugs: string[];
  backdrop: string; // image path, "" = plain white
  backdropMobile?: string; // showcase only: the backdrop on phones ("" = plain white, as before)
  dark: boolean; // dark background: white text
  active: boolean;
  cardsMode?: "auto" | "custom" | "off"; // slides block only: the small cards in the corner of the banner: the two newest articles, a list of your own (up to 3), or none
  cards?: CornerCard[];
};

export const BACKDROP_PRESETS = [
  { label: "Tường bê tông", src: "/sites/yenthoa/bg/concrete.webp", dark: false },
  { label: "Vòm cong", src: "/sites/yenthoa/bg/arches.webp", dark: false },
  { label: "Khung lưới", src: "/sites/yenthoa/bg/wireframe.webp", dark: false },
  { label: "Nền tối", src: "/sites/yenthoa/bg/dark.webp", dark: true },
];

export const SETTING_KEY = "home_sections";

export const SLIDES_ID = "banner-dau-trang";
const slidesBlock = (): HomeSection => ({ id: SLIDES_ID, kind: "slides", image: "", link: "", name: "Banner đầu trang", collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: true });

export const COLLECTIONS_ID = "bo-suu-tap";
const collectionsBlock = (): HomeSection => ({ id: COLLECTIONS_ID, kind: "collections", image: "", link: "", name: "Bộ sưu tập", collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: true });

export function defaultSections(brands: { id: string; name: string }[]): HomeSection[] {
  return [slidesBlock(), ...brands.map((b) => ({
    id: b.id,
    kind: "showcase" as const,
    image: "",
    link: "",
    name: b.name,
    collection: "",
    brand: b.id,
    slugs: [],
    backdrop: BRAND_BACKDROPS[b.id]?.src ?? "",
    dark: !!BRAND_BACKDROPS[b.id]?.dark,
    active: true,
  })), collectionsBlock()];
}

// tolerant reader for what is stored in the database
export function normalizeHomeSections(raw: unknown, brands: { id: string; name: string }[]): HomeSection[] {
  if (!Array.isArray(raw)) return defaultSections(brands);
  const out: HomeSection[] = [];
  for (const r of raw as Partial<HomeSection>[]) {
    if (!r || typeof r !== "object" || !String(r.name ?? "").trim() || (r.kind as string) === "list") continue; // "list" blocks came from the removed objects feature
    out.push({
      id: String(r.id ?? "").trim() || `muc-${out.length + 1}`,
      kind: r.kind === "banner" || r.kind === "slides" || r.kind === "collections" || r.kind === "html" ? r.kind : "showcase",
      html: typeof r.html === "string" ? r.html : "",
      image: String(r.image ?? ""),
      link: String(r.link ?? ""),
      name: String(r.name).trim(),
      display: r.display === "cards" ? "cards" : "showcase",
      collection: String(r.collection ?? ""),
      brand: String(r.brand ?? ""),
      slugs: Array.isArray(r.slugs) ? r.slugs.map(String) : [],
      backdrop: String(r.backdrop ?? ""),
      backdropMobile: String(r.backdropMobile ?? ""),
      dark: !!r.dark,
      active: r.active !== false,
      cardsMode: r.cardsMode === "custom" || r.cardsMode === "off" ? r.cardsMode : "auto",
      cards: Array.isArray(r.cards) ? r.cards.slice(0, MAX_CARDS).map((c) => ({ title: String(c?.title ?? ""), img: String(c?.img ?? ""), link: String(c?.link ?? "") })) : [],
    });
  }
  // the rotating banners are always part of the page: keep the first one, add one at the top if it was never saved
  const first = out.findIndex((x) => x.kind === "slides");
  const rest = out.filter((x, i) => x.kind !== "slides" || i === first);
  const withSlides = first === -1 ? [slidesBlock(), ...rest] : rest;
  // the list of collections too: one block, added at the end when it was never saved
  const firstC = withSlides.findIndex((x) => x.kind === "collections");
  const only = withSlides.filter((x, i) => x.kind !== "collections" || i === firstC);
  return firstC === -1 ? [...only, collectionsBlock()] : only;
}
