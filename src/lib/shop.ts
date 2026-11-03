import type { Metadata } from "next";
import { hasDatabaseConfig, query } from "./db.ts";
import { DEFAULT_SHOP, type Shop } from "./defaults.ts";

// Shop info (name, hotlines, Facebook, branches, stores) lives in the `settings` table.
// If the database cannot be reached the site still renders with the defaults.
export async function getShop(): Promise<Shop> {
  if (!hasDatabaseConfig()) return DEFAULT_SHOP;
  try {
    const [row] = await query<{ v: Partial<Shop> }>("SELECT v FROM settings WHERE k = 'shop'");
    return { ...DEFAULT_SHOP, ...(row?.v ?? {}) };
  } catch (e) {
    console.error("getShop: using defaults", e instanceof Error ? e.message : e);
    return DEFAULT_SHOP;
  }
}

export async function pageMetadata(title: string, description?: string): Promise<Metadata> {
  const shop = await getShop();
  const hot = shop.hotlines.join(" - ");
  return {
    title: `${title} - ${shop.brand}`,
    description: `${description ? `${description} ` : ""}Hotline ${hot}.`.trim(),
  };
}
