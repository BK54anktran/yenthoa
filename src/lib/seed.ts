import fs from "node:fs";
import path from "node:path";
import { exec, query } from "./db.ts";
import { DEFAULT_SHOP, DEFAULT_SLIDES } from "./defaults.ts";
import { normalizeSpecs, normalizeVariants } from "./variants.ts";

// Loads the JSON that came out of the importers (src/content) and the defaults into MySQL.
// Without `force` existing rows are left alone, so re-running never overwrites admin edits.
const CONTENT = () => path.join(process.cwd(), "src/content");
const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

type PostFile = { slug: string; title: string; date: string; section: string; excerpt: string; img: string | null; html: string };
type ProductFile = {
  slug: string; name: string; brand: string; types: string[]; price: number; priceMax: number;
  img: string | null; gallery: string[]; colors: string[]; variants?: unknown; specs?: unknown; shortHtml: string; html: string;
};

export type SeedResult = { posts: number; products: number; slides: number; shop: boolean; specsRepaired: number };

export async function seedAll(opts: { force?: boolean } = {}): Promise<SeedResult> {
  const force = !!opts.force;
  const res: SeedResult = { posts: 0, products: 0, slides: 0, shop: false, specsRepaired: 0 };
  const verb = force ? "INSERT" : "INSERT IGNORE";

  const postsDir = path.join(CONTENT(), "posts");
  const postFiles = fs.existsSync(postsDir) ? fs.readdirSync(postsDir).filter((f) => f.endsWith(".json")) : [];
  for (const f of postFiles) {
    const p = readJson<PostFile>(path.join(postsDir, f));
    const r = await exec(
      `${verb} INTO posts (slug, title, date, section, excerpt, img, html, published) VALUES (?,?,?,?,?,?,?,1)
       ${force ? "ON DUPLICATE KEY UPDATE title=VALUES(title), date=VALUES(date), section=VALUES(section), excerpt=VALUES(excerpt), img=VALUES(img), html=VALUES(html)" : ""}`,
      [p.slug, p.title, p.date, p.section, p.excerpt, p.img, p.html],
    );
    res.posts += r.affectedRows > 0 ? 1 : 0;
  }

  const prodDir = path.join(CONTENT(), "products");
  const prodFiles = fs.existsSync(prodDir) ? fs.readdirSync(prodDir).filter((f) => f.endsWith(".json")) : [];
  for (const f of prodFiles) {
    const p = readJson<ProductFile>(path.join(prodDir, f));
    const r = await exec(
      `${verb} INTO products (slug, name, brand, types, price, price_max, img, gallery, colors, variants, specs, short_html, html, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
       ${force ? "ON DUPLICATE KEY UPDATE name=VALUES(name), variants=VALUES(variants), specs=VALUES(specs), brand=VALUES(brand), types=VALUES(types), price=VALUES(price), price_max=VALUES(price_max), img=VALUES(img), gallery=VALUES(gallery), colors=VALUES(colors), short_html=VALUES(short_html), html=VALUES(html)" : ""}`,
      [p.slug, p.name, p.brand, JSON.stringify(p.types), p.price, p.priceMax, p.img, JSON.stringify(p.gallery), JSON.stringify(p.colors), JSON.stringify(normalizeVariants(p.variants)), JSON.stringify(normalizeSpecs(p.specs)), p.shortHtml, p.html],
    );
    res.products += r.affectedRows > 0 ? 1 : 0;
    // rows seeded before variants existed: fill them in, never touching a product that already has some
    const vs = normalizeVariants(p.variants);
    if (!force && vs.length) await exec("UPDATE products SET variants = ? WHERE slug = ? AND variants IS NULL", [JSON.stringify(vs), p.slug]);
    const sp = normalizeSpecs(p.specs);
    if (!force && sp.length) await exec("UPDATE products SET specs = ? WHERE slug = ? AND specs IS NULL", [JSON.stringify(sp), p.slug]);
    // Two products were first imported with a whole pasted description as one spec label (fixed in the importer).
    // Repair exactly those rows; a product whose specs look normal is never touched, so admin edits survive.
    if (!force && sp.length) {
      const [cur] = await query<{ specs: unknown }>("SELECT specs FROM products WHERE slug = ?", [p.slug]);
      if (normalizeSpecs(cur?.specs).some((g) => g.items.some((i) => i.label.length > 200))) {
        await exec("UPDATE products SET specs = ? WHERE slug = ?", [JSON.stringify(sp), p.slug]);
        res.specsRepaired++;
      }
    }
  }

  const shop = await exec(`${verb} INTO settings (k, v) VALUES ('shop', ?) ${force ? "ON DUPLICATE KEY UPDATE v=VALUES(v)" : ""}`, [JSON.stringify(DEFAULT_SHOP)]);
  res.shop = shop.affectedRows > 0;

  const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM hero_slides");
  if (force || n === 0) {
    if (force) await exec("DELETE FROM hero_slides");
    for (const [i, s] of DEFAULT_SLIDES.entries()) {
      await exec("INSERT INTO hero_slides (eyebrow, title, sub, img, link, sort, active) VALUES (?,?,?,?,?,?,1)", [s.eyebrow, s.title, s.sub, s.img, s.link ?? null, i]);
      res.slides++;
    }
  }
  return res;
}
