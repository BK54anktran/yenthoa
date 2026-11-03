#!/usr/bin/env node
// Turn a JSON export of the shop's Facebook page posts into news posts.
//
//   node scripts/import-facebook.mjs <posts.json> <imagesDir> [--limit 100] [--branded branded.json]
//
// posts.json: [{ date, url, text, images[], video }] (newest first). imagesDir holds the downloaded
// images as "<postIndex 000>-<imageIndex>.jpg" where postIndex is the position in posts.json.
// Reels (video posts) and exact repeats are skipped. Output: scripts/facebook-posts.json (merged by
// import-hoangkim.mjs transform) and webp images in public/sites/hungphat/img/fb.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [src, imgDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const LIMIT = Number(opt("limit", 100));
const brandedFile = opt("branded", null);
const OUT_IMG = path.resolve("public/sites/hungphat/img/fb");
const URL_IMG = "/sites/hungphat/img/fb";
if (!src || !imgDir) throw new Error("usage: import-facebook.mjs <posts.json> <imagesDir>");

const branded = new Set(brandedFile ? JSON.parse(fs.readFileSync(brandedFile, "utf8")) : []);
const posts = JSON.parse(fs.readFileSync(src, "utf8")).map((p, index) => ({ ...p, index }));

const letters = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 1. pick: no reels, has images, drop repeats (keep the newest), newest first, first LIMIT
const seen = new Set();
const picked = posts
  .filter((p) => !p.video && p.images.length)
  .sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index)
  .filter((p) => {
    const key = letters(p.text).slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .slice(0, LIMIT);

const PROMO = /khuyến mãi|ưu đãi|voucher|giảm giá|giảm ngay|giảm \d|quà tặng|combo|chương trình/i;
const used = new Set();
const out = [];
fs.mkdirSync(OUT_IMG, { recursive: true });

for (const p of picked) {
  const lines = p.text.replace(/\]?\(?https?:\/\/\S+/g, "").replace(/\[|\]\(?$/g, "").split("\n").map((l) => l.trim()).filter((l) => /[\p{L}\p{N}]/u.test(l));
  let title = (lines[0] ?? "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N})”"]+$/u, "").replace(/\s+/g, " ");
  const up = title.replace(/[^\p{L}]/gu, "");
  if (up.length > 8 && up === up.toUpperCase()) title = title.toLowerCase().replace(/^./u, (c) => c.toUpperCase());
  if (title.length > 100) title = `${title.slice(0, 100).replace(/\s+\S*$/, "")}…`;
  if (!title) title = `Bài viết ngày ${p.date.split("-").reverse().join("/")}`;

  let slug = `${slugify(title).slice(0, 70)}-${p.date}`;
  while (used.has(slug)) slug += "-2";
  used.add(slug);

  const imgs = [];
  for (let j = 0; j < p.images.length; j++) {
    const file = path.join(imgDir, `${String(p.index).padStart(3, "0")}-${j}.jpg`);
    const rel = `${slug}-${j + 1}.webp`;
    if (branded.has(`fb/${rel}`)) continue;
    if (!fs.existsSync(file)) continue;
    const dest = path.join(OUT_IMG, rel);
    if (!fs.existsSync(dest)) await sharp(file).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 62, effort: 4 }).toFile(dest);
    imgs.push(`${URL_IMG}/${rel}`);
  }
  if (!imgs.length) continue;

  const fig = (u, k) => `<figure><img src="${u}" alt="${esc(title)} - ảnh ${k + 1}" loading="lazy"></figure>`;
  const body = lines.map((l) => `<p>${esc(l)}</p>`);
  const html = [fig(imgs[0], 0), ...body, ...imgs.slice(1).map((u, k) => fig(u, k + 1))].join("");
  const plain = lines.slice(1).join(" ").replace(/\s+/g, " ");
  const excerpt = (plain.length > 40 ? plain : lines.join(" ")).slice(0, 200).replace(/\s+\S*$/, "") + "…";
  out.push({ slug, title, date: p.date, section: PROMO.test(title) ? "khuyen-mai" : "xe-may", excerpt, img: imgs[0], html });
}

fs.writeFileSync(path.resolve("scripts/facebook-posts.json"), JSON.stringify(out, null, 1));
console.log(`${out.length} posts, ${out.reduce((n, x) => n + (x.html.match(/<img/g) ?? []).length, 0)} images; ${out.filter((x) => x.section === "khuyen-mai").length} promo`);
