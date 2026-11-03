import { collectionHref, type Collection } from "./collections.ts";
import { activeOnly, type Taxonomy } from "./taxonomy.ts";

// The header menu: a tree of any depth (up to MAX_DEPTH levels). Each item has a label and a free link.
// An item can take its sub-items from a source instead of typing them:
//   brands:xe-may | brands:xe-dien | brands:all   the brands (their "menu" setting decides the first two)
//   sections:menu | sections:all                  the news sections
//   collections:all                               the product collections
export type MenuNode = { id: string; label: string; href: string; active: boolean; source: string; children: MenuNode[] };
export type Menu = { main: MenuNode[]; secondary: MenuNode[] };
export type NavNode = { label: string; href: string; children: NavNode[] };
export type Nav = { main: NavNode[]; secondary: NavNode[] };

export const MENU_KEY = "menu";
export const MAX_DEPTH = 4;
export const MAX_NODES = 120;

const node = (id: string, label: string, href: string, source = ""): MenuNode => ({ id, label, href, active: true, source, children: [] });

// the menu the site had before it became editable (an empty link next to a brands source links to the filtered list)
export function defaultMenu(): Menu {
  return {
    main: [
      node("trang-chu", "Trang chủ", "/"),
      node("ve-chung-toi", "Về chúng tôi", "/gioi-thieu"),
      node("xe-may", "Xe máy", "/xe-may", "brands:xe-may"),
      node("xe-dien", "Xe điện", "", "brands:xe-dien"),
    ],
    secondary: [
      node("dich-vu", "Dịch vụ", "/tin-tuc"),
      node("phu-tung", "Phụ tùng", "/#phu-tung"),
      node("phu-kien", "Phụ kiện", "/#phu-tung"),
      node("he-thong-cua-hang", "Hệ thống cửa hàng", "/he-thong-cua-hang"),
      node("tin-tuc", "Tin tức", "/tin-tuc", "sections:menu"),
    ],
  };
}

const str = (v: unknown) => String(v ?? "").trim();

function readNodes(raw: unknown, depth: number): MenuNode[] {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return [];
  const out: MenuNode[] = [];
  for (const r of raw as Partial<MenuNode>[]) {
    if (!r || typeof r !== "object" || !str(r.label)) continue;
    out.push({
      id: str(r.id) || `n${depth}-${out.length + 1}`,
      label: str(r.label),
      href: str(r.href),
      active: r.active !== false,
      source: str(r.source).startsWith("object:") ? "" : str(r.source), // the object feature was removed
      children: readNodes(r.children, depth + 1),
    });
  }
  return out;
}

export function normalizeMenu(raw: unknown): Menu {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = defaultMenu();
  return { main: Array.isArray(r.main) ? readNodes(r.main, 1) : d.main, secondary: Array.isArray(r.secondary) ? readNodes(r.secondary, 1) : d.secondary };
}

const brandLink = (id: string) => `/xe-may?nhom=${id}`;

function fromSource(source: string, tax: Taxonomy, collections: Collection[]): NavNode[] {
  const leaf = (label: string, href: string): NavNode => ({ label, href, children: [] });
  const [kind, arg] = source.split(":");
  if (kind === "brands") {
    const b = activeOnly(tax.brands).filter((x) => arg === "all" || x.menu === arg);
    return b.map((x) => leaf(x.name, brandLink(x.id)));
  }
  if (kind === "sections") return activeOnly(tax.sections).filter((x) => arg === "all" || x.menu).map((x) => leaf(x.name, `/tin-tuc?muc=${x.id}`));
  if (kind === "collections") return collections.filter((c) => c.active).map((c) => leaf(c.name, collectionHref(c.id)));
  return [];
}

function resolveNodes(nodes: MenuNode[], tax: Taxonomy, collections: Collection[]): NavNode[] {
  return nodes
    .filter((n) => n.active)
    .map((n) => {
      const children = n.source ? fromSource(n.source, tax, collections) : resolveNodes(n.children, tax, collections);
      let href = n.href;
      // "Xe điện" and the like: no link typed, so link to the list filtered by the brands inside
      if (!href && n.source.startsWith("brands:")) {
        const ids = activeOnly(tax.brands).filter((x) => n.source === "brands:all" || x.menu === n.source.split(":")[1]).map((x) => x.id);
        href = ids.length ? brandLink(ids.join(",")) : "/xe-may";
      }
      return { label: n.label, href, children };
    });
}

export function resolveMenu(menu: Menu, tax: Taxonomy, collections: Collection[]): Nav {
  return { main: resolveNodes(menu.main, tax, collections), secondary: resolveNodes(menu.secondary, tax, collections) };
}
