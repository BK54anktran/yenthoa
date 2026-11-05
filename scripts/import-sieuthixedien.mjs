#!/usr/bin/env node
// Import vehicles (no spare parts / batteries) from https://sieuthixedien.com.vn into src/content/products
// and public/sites/yenthoa/img/sp (webp). Prices are taken as listed on the source.
//
//   node scripts/import-sieuthixedien.mjs fetch      list products + download raw pages into $RAW_DIR
//   node scripts/import-sieuthixedien.mjs transform  scrub + write src/content/products/<slug>.json (never overwrites an existing slug)
//   node scripts/import-sieuthixedien.mjs images     download + compress the images referenced by the new products
//   node scripts/import-sieuthixedien.mjs repair     drop images the source could not serve, re-scrub branding left across tags
//   node scripts/import-sieuthixedien.mjs verify     fail if any source branding / phone number is left in the new products
//
// The site sends an incomplete TLS chain (missing the RapidSSL intermediate). Point CA_BUNDLE at a PEM file that holds the
// system CAs plus that intermediate; certificate verification is never switched off.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as cheerio from "cheerio";
import sharp from "sharp";

const ORIGIN = "https://sieuthixedien.com.vn";
const RAW = path.resolve(process.env.RAW_DIR ?? ".cache/sieuthixedien");
const CA = process.env.CA_BUNDLE ?? "/root/.ccr/ca-bundle.crt";
const OUT = path.resolve("src/content/products");
const IMG_DIR = path.resolve("public/sites/yenthoa/img/sp");
const IMG_URL = "/sites/yenthoa/img/sp";
const SHOP = "Yên Thoa";
const MAX_GALLERY = 6;
const MAX_BODY_IMAGES = 3;

// source "Hãng" / category -> our brand id. Anything not listed becomes its own brand.
const BRAND_NAMES = {
  honda: "Honda", yamaha: "Yamaha", sym: "SYM", suzuki: "Suzuki", yadea: "Yadea",
  dibao: "Dibao", tailg: "Tailg", osakar: "Osakar", victoria: "Victoria", "motor-thai": "Motor Thái",
  hyosung: "Hyosung", "viet-thai": "Việt Thái", ally: "Ally", dk: "DK", giant: "Giant", nijia: "Nijia", khac: "Hãng khác",
};
const SKIP_CATEGORY = /^\/p(31|58)_/; // linh kiện / phụ kiện, ắc quy
const SKIP_TITLE = /(ắc ?quy|acquy|pin\b|sạc|lốp|vỏ|săm|ổ khóa|ruột|nắp|chắn bùn|tay ga|điều khiển|phanh\b(?!.*xe))/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function curl(url, out) {
  const args = ["-sS", "--fail", "--cacert", CA, "-m", "60", "-L", "-A", "Mozilla/5.0 (compatible; YenThoaImport/1.0)"];
  if (out) args.push("-o", out);
  args.push(url);
  return execFileSync("curl", args, { maxBuffer: 64 * 1024 * 1024 });
}
function cached(rel, url) {
  const f = path.join(RAW, rel);
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const t = curl(url).toString("utf8");
  fs.writeFileSync(f, t);
  return t;
}

// ---------------------------------------------------------------- fetch
async function fetchAll() {
  const home = cached("home.html", `${ORIGIN}/`);
  const pages = new Set(["/avd32_san-pham-ban-chay", "/avd33_san-pham-moi", "/avd35_loc-san-pham", "/avd36_loc-san-pham"]);
  for (const m of home.matchAll(/href="(\/p\d+_[^"/]+\.html)"/g)) pages.add(m[1]);
  const found = new Map(); // id -> path
  for (const p of pages) {
    const html = cached(`list/${p.replace(/\W+/g, "_")}.html`, ORIGIN + p);
    for (const m of html.matchAll(/href="(\/p\d+_[^"/]+\/(\d+)_[^"]+\.html)"/g)) if (!found.has(m[2])) found.set(m[2], m[1]);
    await sleep(300);
  }
  console.log(`${pages.size} listing pages, ${found.size} products`);
  const list = {};
  for (const [id, p] of found) {
    cached(`product/${id}.html`, ORIGIN + p);
    list[id] = p;
    await sleep(300);
  }
  writeJson(path.join(RAW, "products.json"), list);
  console.log("saved", Object.keys(list).length, "product pages");
}

// ---------------------------------------------------------------- transform
const decode = (s) => cheerio.load(`<p>${s}</p>`).text();
const BRAND_RX = /thế\s*giới\s*xe\s*điện|thegioixedien[\w.-]*|xedapchaydien[\w.-]*|sieuthixedien[\w.-]*|siêu\s*thị\s*xe\s*điện/gi;
const hasBrand = (t) => { BRAND_RX.lastIndex = 0; const r = BRAND_RX.test(t); BRAND_RX.lastIndex = 0; return r; };
const PHONE_RX = /(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){8,9}/g;
const hasPhone = (t) => { PHONE_RX.lastIndex = 0; const r = PHONE_RX.test(t); PHONE_RX.lastIndex = 0; return r; };

function scrubText(s) {
  return s.replace(BRAND_RX, SHOP).replace(PHONE_RX, "").replace(/\s{2,}/g, " ");
}


function cleanHtml($, root, slug, wanted) {
  root.find("script, style, iframe, form, .facebox, .title-block, table").remove();
  let kept = 0;
  root.find("img").each((_, el) => {
    const img = $(el);
    const src = img.attr("src") || "";
    if (++kept > MAX_BODY_IMAGES) return void img.remove();
    if (!src || /^https?:\/\//i.test(src) && !src.startsWith(ORIGIN)) return void img.remove();
    const rel = src.startsWith(ORIGIN) ? src.slice(ORIGIN.length) : src.startsWith("/") ? src : "/" + src;
    const local = wanted(rel, slug);
    const alt = scrubText(decode(img.attr("alt") || img.attr("title") || "")).trim();
    for (const a of Object.keys(el.attribs)) img.removeAttr(a);
    img.attr({ src: local, alt, loading: "lazy" });
  });
  root.find("a").each((_, el) => { $(el).replaceWith($(el).contents()); });
  root.find("*").each((_, el) => {
    if (el.type !== "tag") return;
    for (const a of Object.keys(el.attribs)) if (!["src", "alt", "loading", "colspan"].includes(a)) $(el).removeAttr(a);
  });
  root.find("span, font, div, strong:empty, b:empty, u").each((_, el) => { const e = $(el); if (el.tagName === "strong") return; e.replaceWith(e.contents()); });
  root.find("p").each((_, el) => {
    const p = $(el);
    if (!p.find("img").length && !p.text().replace(/ /g, " ").trim()) p.remove();
  });
  // text scrub on text nodes only
  root.find("*").contents().each((_, n) => { if (n.type === "text") n.data = scrubText(n.data); });
  root.find("p, li, h2, h3, h4").each((_, el) => { const e = $(el); if (!e.find("img").length && !e.text().trim()) e.remove(); });
  return root.html().replace(/\n{2,}/g, "\n").trim();
}

function parseSpecs($, d) {
  const specs = [];
  d.find("table").each((_, tb) => {
    let cur = null;
    $(tb).find("tr").each((__, tr) => {
      const th = $(tr).find("th");
      if (th.length) { cur = { title: scrubText(th.text().replace(/\s+/g, " ").trim()), items: [] }; specs.push(cur); return; }
      const label = $(tr).find("td.spec-title").text().replace(/\s+/g, " ").trim();
      const value = scrubText($(tr).find("td.spec-content").text().replace(/ /g, " ").replace(/\s+/g, " ").trim());
      if (!label || !value) return;
      if (!cur) { cur = { title: "Thông số", items: [] }; specs.push(cur); }
      cur.items.push({ label, value });
    });
  });
  return specs.filter((s) => s.items.length);
}

function typesOf(name, specs) {
  const t = name.toLowerCase();
  const all = specs.flatMap((s) => s.items).map((i) => `${i.label} ${i.value}`).join(" ").toLowerCase();
  if (/xe đạp điện|xe dap dien/.test(t)) return ["xe-dap-dien"];
  if (/máy điện|xe điện/.test(t)) return ["xe-may-dien"];
  if (/\bga\b|tay ga|scoopy|vision|lead|vario|air ?blade|sh\b/.test(t)) return ["xe-tay-ga"];
  if (/tay côn|exciter|winner|raider|satria/.test(t)) return ["xe-tay-con"];
  if (/\bsố\b|wave|cub|sirius|future|dream|jupiter|blade/.test(t + " " + all)) return ["xe-so"];
  return [];
}

function brandOf(name, specs, listPath) {
  const hang = specs.flatMap((s) => s.items).find((i) => /^hãng$/i.test(i.label))?.value ?? "";
  const hay = slugify(`${hang} ${name}`);
  if (/\b50cc\b/i.test(name)) return "xe-50cc";
  for (const id of Object.keys(BRAND_NAMES)) if (new RegExp(`(^|-)${id}(-|$)`).test(hay)) return id;
  const cat = listPath.match(/^\/p\d+_([^/]+)/)?.[1];
  if (cat && BRAND_NAMES[cat]) return cat;
  return slugify(hang) || "khac";
}

function transform() {
  const list = readJson(path.join(RAW, "products.json"));
  const existing = new Set(fs.existsSync(OUT) ? fs.readdirSync(OUT).map((f) => f.replace(/\.json$/, "")) : []);
  const wantedImages = new Map(); // local url -> source path
  const counters = new Map();
  const wanted = (rel, slug) => {
    for (const [u, s] of wantedImages) if (s === rel && u.includes(`/${slug}-`)) return u;
    const n = (counters.get(slug) ?? 0) + 1;
    counters.set(slug, n);
    const u = `${IMG_URL}/${slug}-${n}.webp`;
    wantedImages.set(u, rel);
    return u;
  };
  const skipped = [], written = [], brandsUsed = new Map();
  for (const [id, listPath] of Object.entries(list)) {
    const html = fs.readFileSync(path.join(RAW, `product/${id}.html`), "utf8");
    const $ = cheerio.load(html);
    const d = $("#product_detail");
    const name = scrubText(d.find("h2.title").first().text().trim());
    if (!name) { skipped.push([id, "no title"]); continue; }
    if (SKIP_CATEGORY.test(listPath) || SKIP_TITLE.test(name) && !/xe\b/i.test(name)) { skipped.push([id, name]); continue; }
    const slug = slugify(name);
    if (existing.has(slug)) { skipped.push([id, `exists: ${slug}`]); continue; }
    const price = Number((d.find("p.price").text().match(/[\d.,]{6,}/)?.[0] ?? "0").replace(/\D/g, "")) || 0;
    const gallerySrc = [...new Set(d.find(".sliderkit-panel a").map((_, e) => $(e).attr("href")).get().filter(Boolean))].slice(0, MAX_GALLERY);
    const gallery = gallerySrc.map((s) => wanted(s.startsWith("/") ? s : "/" + s, slug));
    const content = d.find(".content-descr").first();
    const specs = parseSpecs($, content.length ? content : d);
    const body = cleanHtml($, content.clone(), slug, wanted);
    const firstPs = cheerio.load(`<div>${body}</div>`)("div > p").filter((_, e) => cheerio.load(e).text().trim().length > 40).slice(0, 2).map((_, e) => `<p>${cheerio.load(e).text().trim()}</p>`).get().join("\n");
    const colorSpec = specs.flatMap((s) => s.items).find((i) => /m[aàầ]u s[aắ]c/i.test(i.label));
    const colors = colorSpec && !/đủ|nhiều/i.test(colorSpec.value) ? colorSpec.value.split(/[,;/]|\bvà\b/).map((c) => c.trim()).filter(Boolean).slice(0, 12) : [];
    const brand = brandOf(name, specs, listPath);
    brandsUsed.set(brand, (brandsUsed.get(brand) ?? 0) + 1);
    const product = {
      slug, name, brand, types: typesOf(name, specs), price, priceMax: price,
      img: gallery[0] ?? null, gallery, colors, variants: [], specs,
      shortHtml: firstPs, html: body,
    };
    writeJson(path.join(OUT, `${slug}.json`), product);
    written.push(slug);
  }
  writeJson(path.join(RAW, "images-wanted.json"), Object.fromEntries(wantedImages));
  console.log(`written ${written.length}, skipped ${skipped.length}, images ${wantedImages.size}`);
  console.log("brands:", Object.fromEntries(brandsUsed));
  writeJson(path.join(RAW, "written.json"), written);
  if (skipped.length) console.log("skipped:", skipped.map((s) => s.join(": ")).join("\n  "));
}

// ---------------------------------------------------------------- images
async function images() {
  const wantedMap = readJson(path.join(RAW, "images-wanted.json"));
  const failedFile = path.join(RAW, "failed-images.json");
  const failed = [];
  fs.mkdirSync(IMG_DIR, { recursive: true });
  let done = 0, total = 0;
  for (const [local, rel] of Object.entries(wantedMap)) {
    const dest = path.resolve("public" + local);
    if (fs.existsSync(dest)) { done++; continue; }
    total++;
    try {
      const tmp = path.join(RAW, "tmp-img");
      curl(ORIGIN + encodeURI(decodeURI(rel)).replace(/%25/g, "%"), tmp);
      await sharp(tmp, { failOn: "none" }).rotate().resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 74 }).toFile(dest);
      done++;
    } catch (e) {
      failed.push(local);
      console.warn("failed", rel, String(e.message).split("\n")[0]);
    }
    await sleep(150);
  }
  writeJson(failedFile, failed);
  console.log(`images ok ${done}, new ${total}, failed ${failed.length}`);
}

// ---------------------------------------------------------------- repair
function repair() {
  const written = readJson(path.join(RAW, "written.json"));
  const failed = new Set(fs.existsSync(path.join(RAW, "failed-images.json")) ? readJson(path.join(RAW, "failed-images.json")) : []);
  const scrub = (v) => (typeof v === "string" ? v.replace(/\s*\|\s*(?:Thế Giới Xe Điện|Siêu Thị Xe Điện)\s*/gi, "").replace(BRAND_RX, SHOP) : v);
  let dropped = 0, changed = 0;
  for (const slug of written) {
    const f = path.join(OUT, `${slug}.json`);
    const before = fs.readFileSync(f, "utf8");
    const p = JSON.parse(before);
    for (const u of failed) {
      p.html = p.html.replace(new RegExp(`<img[^>]*src="${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g"), () => (dropped++, ""));
    }
    p.html = p.html.replace(/<p>\s*<\/p>/g, "");
    p.gallery = p.gallery.filter((u) => !failed.has(u));
    p.img = p.gallery[0] ?? null;
    p.name = scrub(p.name);
    p.html = scrub(p.html);
    p.shortHtml = scrub(p.shortHtml);
    for (const sec of p.specs) { sec.title = scrub(sec.title); for (const it of sec.items) { it.label = scrub(it.label); it.value = scrub(it.value); } }
    const after = JSON.stringify(p, null, 2) + "\n";
    if (after !== before) { fs.writeFileSync(f, after); changed++; }
  }
  console.log(`repair: ${changed} files changed, ${dropped} broken <img> removed`);
}

// ---------------------------------------------------------------- verify
function verify() {
  const written = readJson(path.join(RAW, "written.json"));
  const bad = [];
  for (const slug of written) {
    const raw = fs.readFileSync(path.join(OUT, `${slug}.json`), "utf8");
    if (hasBrand(raw.replace(new RegExp(SHOP, "g"), "")) || /sieuthixedien|xedapchaydien|thegioixedien|upimages|upfiles/i.test(raw)) bad.push(`${slug}: source branding/url left`);
    if (hasPhone(raw)) bad.push(`${slug}: phone number left`);
    const p = JSON.parse(raw);
    for (const m of p.html.matchAll(/src="([^"]+)"/g)) if (!fs.existsSync(path.resolve("public" + m[1]))) bad.push(`${slug}: missing body image ${m[1]}`);
    for (const u of [p.img, ...p.gallery].filter(Boolean)) if (!fs.existsSync(path.resolve("public" + u))) bad.push(`${slug}: missing image ${u}`);
  }
  if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
  console.log(`verify ok: ${written.length} products`);
}

const mode = process.argv[2];
if (mode === "fetch") await fetchAll();
else if (mode === "transform") transform();
else if (mode === "images") await images();
else if (mode === "repair") repair();
else if (mode === "verify") verify();
else { console.error("usage: import-sieuthixedien.mjs fetch|transform|images|repair|verify"); process.exit(1); }
