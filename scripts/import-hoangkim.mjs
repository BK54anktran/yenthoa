#!/usr/bin/env node
// Import posts + products from the WordPress site https://xemayhoangkim.vn (public REST API)
// and rewrite them for this shop ("Hùng Phát").
//
//   node scripts/import-hoangkim.mjs fetch      download raw JSON into $RAW_DIR (default .cache/hoangkim)
//   node scripts/import-hoangkim.mjs transform  scrub text/HTML, write src/content + images manifest
//   node scripts/import-hoangkim.mjs images     download + compress images (webp) into public/sites/hungphat/img
//   node scripts/import-hoangkim.mjs verify     fail if any source branding is left in src/content
//
// Run order: fetch -> transform -> images -> transform (drops images that failed) -> verify.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const ORIGIN = "https://xemayhoangkim.vn";
const API = `${ORIGIN}/wp-json`;
const RAW = path.resolve(process.env.RAW_DIR ?? ".cache/hoangkim");
const OUT = path.resolve("src/content");
const IMG_DIR = path.resolve("public/sites/hungphat/img");
const IMG_URL = "/sites/hungphat/img";

const SHOP = "Hùng Phát";
const HOTLINE = "0789.619.698";

// WordPress category id -> our news section. Dropped ids are posts about the source company itself.
const POST_SECTIONS = {
  182: { slug: "thi-truong", name: "Tin thị trường" },
  181: { slug: "xe-may", name: "Tin xe máy" },
  183: { slug: "khuyen-mai", name: "Tin khuyến mãi" },
  77: { slug: "dich-vu", name: "Dịch vụ" },
  78: { slug: "dich-vu", name: "Dịch vụ" },
  1: { slug: "tin-tuc", name: "Tin tức" },
};
const DROP_POST_CATS = new Set([185 /* Tin Hoàng Kim */, 35 /* Tuyển dụng */, 196 /* Tin báo chí */]);

const BRANDS = {
  honda: "Honda",
  yamaha: "Yamaha",
  sym: "SYM",
  suzuki: "Suzuki",
  yadea: "Yadea",
  "xe-50cc": "Xe 50cc",
  "xe-may-nhap-khau": "Xe nhập khẩu",
  "xe-dien-yamaha": "Xe điện",
};
const PRODUCT_TYPES = {
  "xe-so": "Xe số",
  "xe-tay-ga": "Xe tay ga",
  "xe-tay-con": "Xe tay côn",
  "xe-the-thao": "Xe thể thao",
  "xe-may-dien": "Xe máy điện",
  "xe-dap-dien": "Xe đạp điện",
};

// ---------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v));
};

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (content import)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { json: await res.json(), headers: res.headers };
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await sleep(1500 * i);
    }
  }
}

async function getAll(endpoint, query) {
  const out = [];
  for (let page = 1; ; page++) {
    const { json, headers } = await getJson(`${API}/${endpoint}?${query}&per_page=100&page=${page}`);
    out.push(...json);
    if (page >= Number(headers.get("x-wp-totalpages") ?? 1)) break;
  }
  return out;
}

// ---------------------------------------------------------------- fetch
async function fetchRaw() {
  fs.mkdirSync(RAW, { recursive: true });
  const posts = await getAll("wp/v2/posts", "_fields=id,slug,date,title,excerpt,content,categories,featured_media,link");
  console.log("posts", posts.length);
  writeJson(`${RAW}/posts.json`, posts);

  const { json: store } = await getJson(`${API}/wc/store/v1/products?per_page=100`);
  writeJson(`${RAW}/store-products.json`, store);
  const wp = await getAll("wp/v2/product", "_fields=id,slug,class_list,featured_media");
  writeJson(`${RAW}/wp-products.json`, wp);
  console.log("products", store.length);

  const ids = [...new Set([...posts, ...wp].map((p) => p.featured_media).filter(Boolean))];
  const media = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { json } = await getJson(`${API}/wp/v2/media?per_page=100&_fields=id,source_url&include=${ids.slice(i, i + 100).join(",")}`);
    for (const m of json) media[m.id] = m.source_url;
  }
  writeJson(`${RAW}/media.json`, media);

  // WooCommerce keeps one image per variation (version + colour) only in the product page markup
  const variations = {};
  const specs = {}; // technical specification accordion (Động cơ, Khung xe, Kích thước, Bảo hành)
  const queue = [...store];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const p = queue.shift();
        for (let i = 1; ; i++) {
          try {
            const res = await fetch(`${ORIGIN}/san-pham/${p.slug}/`, { headers: { "user-agent": "Mozilla/5.0 (content import)" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const $ = cheerio.load(await res.text());
            const raw = $("form.variations_form").attr("data-product_variations");
            specs[p.slug] = $(".product-design-thong-so .accordion-item")
              .map((_, it) => ({
                title: $(it).find(".accordion-title span").first().text().replace(/\s+/g, " ").trim(),
                items: $(it)
                  .find("ul.list > li")
                  .map((__, li) => ({ label: $(li).children("span").first().text().replace(/\s+/g, " ").trim(), value: $(li).children("strong").first().text().replace(/\s+/g, " ").trim() }))
                  .get()
                  .filter((x) => x.label),
              }))
              .get()
              .filter((g) => g.title && g.items.length);
            variations[p.slug] = (raw && raw !== "false" ? JSON.parse(raw) : []).map((v) => ({
              attrs: v.attributes,
              img: v.image?.full_src || v.image?.src || null,
              price: v.display_price ?? null,
            }));
            break;
          } catch (e) {
            if (i >= 3) throw new Error(`${p.slug}: ${e.message}`);
            await sleep(1500 * i);
          }
        }
      }
    }),
  );
  writeJson(`${RAW}/variations.json`, variations);
  writeJson(`${RAW}/specs.json`, specs);
  console.log("variations", Object.values(variations).reduce((n, v) => n + v.length, 0));
  console.log("featured media", Object.keys(media).length);
}

// ---------------------------------------------------------------- scrubbing
const norm = (s) => s.normalize("NFC");
const upperAware = (m) => (m === m.toUpperCase() ? SHOP.toUpperCase() : SHOP);

// Text rules. Longest/most specific first.
export function scrubText(input) {
  let s = norm(input);
  s = s.replace(/https?:\/\/(?:www\.)?(?:xemayhoangkim\.vn|xemayhuyhoang\.com)\S*?(?=[\s<"'’”)]|$)/gi, "");
  s = s.replace(/(?:xemayhoangkim|xemayhuyhoang)(?:\.vn|\.com)?/gi, `xe máy ${SHOP}`);
  s = s.replace(/(?:Yamaha\s+)?Ho[aà]ng\s*Kim(?:\s+\d{1,2}\b)?/gi, upperAware);
  s = s.replace(/Huy\s*Ho[aà]ng(?:\s+\d{1,2}\b)?/gi, upperAware);
  // 0937.012.012 / 0937 012 012 / 0937012012 and the typo variants seen on the source, plus 0973.012.012
  s = s.replace(/(?:\+?84[\s.]?|0)937\d?[\s.\-]?0\d{2}[\s.\-]?\d{3}\b|0973[\s.\-]?012[\s.\-]?012/g, HOTLINE);
  return s;
}

const decode = (s) => cheerio.load(`<p>${s}</p>`, {}, false).text();
const plain = (html) => scrubText(decode(String(html).replace(/<[^>]+>/g, " "))).replace(/\s+/g, " ").trim();

const BRAND_RE = /ho[aà]ng\s*kim|hoangkim|huy\s*ho[aà]ng|huyhoang/i;
const CONTACT_LINE =
  /^[\s\u00a0\-–—•*]*(Địa chỉ(?:\s*\d+)?|Hotline|Zalo|Fanpage|Facebook|Website|Messenger|Email|Điện thoại|SĐT|Tổng đài|Giờ làm việc|Thời gian làm việc|Thông tin liên hệ|Trụ sở chính|Chi nhánh(?:\s*\d+)?)\s*[:：]/i;
const BRANCH_HEAD = /^[\s\u00a0]*(CHI NHÁNH|HỆ THỐNG (?:CỬA HÀNG|SHOWROOM)|DANH SÁCH (?:CỬA HÀNG|CHI NHÁNH))/i;
const BRANCH_ITEM = /(Ho[aà]ng\s*Kim|Huy\s*Ho[aà]ng)\s*\d{1,2}\s*[:：\-–]/i;
// street addresses / places of the source company's own stores
const OWN_ADDRESS =
  /L[ũuỹy]{1,2}\s*Bán\s*Bích|Phan\s*Đăng\s*Lưu|Võ\s*Văn\s*Ngân|Mỏ\s*Cày|Thạnh\s*Hòa\s*B\b|Ấp\s*Phước\s*Hậu|0907[\s.]?126[\s.]?526/i;

function isContactBlock(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (BRANCH_ITEM.test(t)) return true;
  if (BRANCH_HEAD.test(t) && t.length < 160) return true;
  if (CONTACT_LINE.test(t) && t.length < 700) return true;
  if (OWN_ADDRESS.test(t) && t.length < 200) return true;
  return false;
}

// long paragraphs that merely mention one of the source stores: drop just those sentences
function dropAddressSentences(htmlBlock) {
  return htmlBlock
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ])/)
    .filter((sent) => !OWN_ADDRESS.test(sent.replace(/<[^>]+>/g, "")))
    .join(" ");
}

// ---------------------------------------------------------------- image registry
const registry = new Map(); // base source URL -> { src, rel }
const failed = fs.existsSync(`${RAW}/failed-images.json`) ? new Set(readJson(`${RAW}/failed-images.json`)) : new Set();
// images whose pixels carry the source company's logo / hotline (found by scripts/detect-branded-images.py)
const branded = new Set(fs.existsSync(`${RAW}/branded-images.json`) ? readJson(`${RAW}/branded-images.json`) : []);
const dropped = { brandImages: 0, foreign: 0, failed: 0, brandedPixels: 0 };

function baseUrl(u) {
  return u.replace(/-\d+x\d+(?=\.\w+$)/, "").replace(/-scaled(?=\.\w+$)/, "");
}

// returns the public URL for a source image, or null when the image must be dropped
function localImage(src, alt = "") {
  let u;
  try {
    u = new URL(src, ORIGIN);
  } catch {
    return null;
  }
  if (!/xemayhoangkim\.vn$/i.test(u.hostname) || !u.pathname.includes("/wp-content/uploads/")) {
    dropped.foreign++;
    return null;
  }
  if (!/\.(jpe?g|png|webp|gif)$/i.test(u.pathname)) return null;
  if (BRAND_RE.test(decodeURIComponent(u.pathname)) || BRAND_RE.test(alt)) {
    dropped.brandImages++; // storefront / logo shots of the source company
    return null;
  }
  const base = baseUrl(`${u.origin}${u.pathname}`);
  if (failed.has(base)) {
    dropped.failed++;
    return null;
  }
  let hit = registry.get(base);
  if (!hit) {
    let rel = decodeURIComponent(base.split("/wp-content/uploads/")[1])
      .toLowerCase()
      .replace(/\.\w+$/, "")
      .replace(/[^a-z0-9/_-]+/g, "-")
      .replace(/-+/g, "-");
    if ([...registry.values()].some((v) => v.rel === rel)) rel += `-${crypto.createHash("md5").update(base).digest("hex").slice(0, 6)}`;
    hit = { src: base, rel: `${rel}.webp` };
    if (branded.has(hit.rel)) hit.branded = true;
    registry.set(base, hit);
  }
  if (hit.branded) {
    dropped.brandedPixels++;
    return null;
  }
  return `${IMG_URL}/${hit.rel}`;
}

// ---------------------------------------------------------------- HTML cleaning
// pageMap: how an internal source URL maps to a local route (or null = unwrap the link)
function makeLinkMapper(postSlugs, productSlugs) {
  const fixed = {
    "/": "/",
    "/xe-may/": "/xe-may",
    "/xe-so/": "/xe-may",
    "/xe-tay-ga/": "/xe-may",
    "/xe-tay-con/": "/xe-may",
    "/xe-the-thao/": "/xe-may",
    "/xe-dien/": "/xe-may",
    "/tin-tuc/": "/tin-tuc",
    "/lien-he/": "/lien-he",
    "/he-thong-cua-hang/": "/he-thong-cua-hang",
    "/gioi-thieu-he-thong-xe-may-hoang-kim/": "/gioi-thieu",
  };
  const keepExternal = /(^|\.)(honda\.com\.vn|yamaha-motor\.com\.vn|yamaha-motor\.com|sym\.com\.vn|suzuki\.com\.vn|yadea\.com\.vn)$/i;
  return (href) => {
    if (!href || href.startsWith("#")) return null;
    if (/^(tel|mailto|sms|javascript):/i.test(href)) return null;
    let u;
    try {
      u = new URL(href, ORIGIN);
    } catch {
      return null;
    }
    if (/xemayhoangkim\.vn$/i.test(u.hostname)) {
      const p = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
      if (fixed[p]) return fixed[p];
      let m;
      if ((m = p.match(/^\/san-pham\/([^/]+)\/$/)) && productSlugs.has(m[1])) return `/xe/${m[1]}`;
      if ((m = p.match(/^\/thuong-hieu\/([^/]+)\/$/)) && BRANDS[m[1]]) return `/xe-may?nhom=${m[1]}`;
      if ((m = p.match(/^\/([^/]+)\/$/)) && postSlugs.has(m[1])) return `/tin-tuc/${postSlugs.get(m[1])}`;
      return null;
    }
    if (u.protocol.startsWith("http") && keepExternal.test(u.hostname)) return u.href;
    return null; // fanpage, zalo, forms, maps, shopee... are the source company's channels
  };
}

function cleanHtml(html, mapLink, { demoteH1 = true } = {}) {
  const $ = cheerio.load(`<div id="__r">${norm(html)}</div>`, {}, false);
  const root = $("#__r");
  root.find("script,style,iframe,form,noscript,object,embed").remove();

  // 1. contact / branch blocks of the source company
  root.find("p,li,div,h2,h3,h4").each((_, el) => {
    if (el.name === "div" && $(el).children().length) return;
    const own = $(el).clone().children("ul,ol").remove().end().text();
    if (isContactBlock(own)) return void $(el).remove();
    if ((el.name === "p" || el.name === "li") && OWN_ADDRESS.test(own)) {
      const kept = dropAddressSentences($(el).html() ?? "");
      if (kept.replace(/<[^>]+>|&nbsp;|\s/g, "")) $(el).html(kept);
      else $(el).remove();
    }
  });
  root.find("ul,ol").each((_, el) => {
    if (!$(el).children("li").length) $(el).remove();
  });

  // 2. images
  root.find("img").each((_, el) => {
    const img = $(el);
    const local = localImage(img.attr("data-src") || img.attr("src") || "", img.attr("alt") || "");
    if (!local) return void img.remove();
    const alt = scrubText(decode(img.attr("alt") || "")).trim();
    const keep = { src: local, alt, loading: "lazy" };
    const w = img.attr("width");
    const h = img.attr("height");
    for (const a of Object.keys(el.attribs)) img.removeAttr(a);
    img.attr(keep);
    if (w && h && /^\d+$/.test(w) && /^\d+$/.test(h)) img.attr({ width: w, height: h });
  });

  // 3. links
  root.find("a").each((_, el) => {
    const a = $(el);
    const mapped = mapLink(a.attr("href"));
    if (!mapped) {
      a.replaceWith(a.contents());
    } else {
      const ext = /^https?:/i.test(mapped);
      for (const attr of Object.keys(el.attribs)) a.removeAttr(attr);
      a.attr("href", mapped);
      if (ext) a.attr({ target: "_blank", rel: "noopener noreferrer" });
    }
  });

  // 4. figures: keep only those that still hold an image; captions are scrubbed text
  root.find("figure").each((_, el) => {
    const fig = $(el);
    if (!fig.find("img").length) return void fig.remove();
    const cap = fig.find("figcaption");
    const capText = cap.text().replace(/\s+/g, " ").trim();
    if (!capText || /nhập chú thích/i.test(capText)) cap.remove();
    // loose caption text sitting directly inside <figure>
    fig.contents().each((__, n) => {
      if (n.type === "text" && /nhập chú thích/i.test(n.data)) $(n).remove();
    });
  });
  root.find("p").each((_, el) => {
    if (/^\[nhập chú thích\]$/i.test($(el).text().trim())) $(el).remove();
  });

  // 5. strip presentation attributes, demote h1, drop empty blocks
  root.find("*").each((_, el) => {
    if (el.name === "img") return;
    const allowed = el.name === "a" ? ["href", "target", "rel"] : el.name === "td" || el.name === "th" ? ["colspan", "rowspan"] : [];
    for (const attr of Object.keys(el.attribs ?? {})) if (!allowed.includes(attr)) $(el).removeAttr(attr);
  });
  if (demoteH1) root.find("h1").each((_, el) => void (el.name = "h2"));
  root.find("span").each((_, el) => void $(el).replaceWith($(el).contents()));
  for (let pass = 0; pass < 3; pass++) {
    root.find("p,strong,b,em,i,u,li,h2,h3,h4,figure,ul,ol,table").each((_, el) => {
      const e = $(el);
      if (!e.find("img").length && !e.text().replace(/[\s ]+/g, "") && !e.find("table,hr").length) e.remove();
    });
  }
  // headings left dangling after contact blocks were removed
  root.find("h2,h3,h4").each((_, el) => {
    const h = $(el);
    const next = h.next();
    if ((!next.length || /^h[1-4]$/.test(next[0]?.name ?? "")) && /liên hệ|địa chỉ|chi nhánh|hệ thống/i.test(h.text())) h.remove();
  });

  const out = scrubText(root.html() ?? "")
    .replace(/(\s*<br\s*\/?>\s*){3,}/g, "<br>")
    .trim();
  return out;
}

// ---------------------------------------------------------------- transform
function excerptOf(post, bodyHtml) {
  let t = plain(post.excerpt.rendered).replace(/\[…\]|\[&hellip;\]|…$/g, "").trim();
  const title = plain(post.title.rendered);
  if (t.toLowerCase().startsWith(title.toLowerCase())) t = t.slice(title.length).replace(/^[\s:–-]+/, "");
  if (t.length < 40) t = plain(bodyHtml);
  if (t.length > 220) t = `${t.slice(0, 220).replace(/\s+\S*$/, "")}…`;
  return t;
}

function transform() {
  const posts = readJson(`${RAW}/posts.json`);
  const store = readJson(`${RAW}/store-products.json`);
  const wp = readJson(`${RAW}/wp-products.json`);
  const media = readJson(`${RAW}/media.json`);
  const stats = { postsIn: posts.length, postsDropped: 0, productsIn: store.length };

  // which posts we keep + their (scrubbed) slugs
  // scripts/keep-posts.json (optional): only keep these posts (by source slug)
  const keepFile = path.resolve("scripts/keep-posts.json");
  const only = fs.existsSync(keepFile) ? new Set(readJson(keepFile)) : null;
  const kept = posts.filter((p) => !p.categories.some((c) => DROP_POST_CATS.has(c)) && (!only || only.has(p.slug)));
  if (only && kept.length !== only.size) console.warn(`keep-posts.json: ${only.size} listed, ${kept.length} found`);
  stats.postsDropped = posts.length - kept.length;
  const postSlugs = new Map();
  const used = new Set();
  for (const p of kept) {
    let s = p.slug.replace(/hoang-kim/g, "hung-phat").replace(/huy-hoang/g, "hung-phat").replace(/xemayhoangkim/g, "xe-may-hung-phat");
    while (used.has(s)) s += "-2";
    used.add(s);
    postSlugs.set(p.slug, s);
  }
  const productSlugs = new Set(store.map((p) => p.slug));
  const mapLink = makeLinkMapper(postSlugs, productSlugs);

  fs.rmSync(`${OUT}/posts`, { recursive: true, force: true });
  fs.rmSync(`${OUT}/products`, { recursive: true, force: true });

  // ---- posts
  const index = [];
  for (const p of kept) {
    const secId = p.categories.find((c) => POST_SECTIONS[c]) ?? 1;
    const section = POST_SECTIONS[secId];
    const html = cleanHtml(p.content.rendered, mapLink);
    const featured = p.featured_media && media[p.featured_media] ? localImage(media[p.featured_media], plain(p.title.rendered)) : null;
    const firstImg = html.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
    const slug = postSlugs.get(p.slug);
    const entry = {
      slug,
      title: plain(p.title.rendered),
      date: p.date.slice(0, 10),
      section: section.slug,
      excerpt: excerptOf(p, html),
      img: featured ?? firstImg,
    };
    index.push(entry);
    writeJson(`${OUT}/posts/${slug}.json`, { ...entry, html });
  }
  // posts written from the shop's own material: scripts/extra-posts.json (by hand) and
  // scripts/facebook-posts.json (from import-facebook.mjs)
  for (const name of ["extra-posts.json", "facebook-posts.json"]) {
    const extraFile = path.resolve("scripts", name);
    if (!fs.existsSync(extraFile)) continue;
    for (const x of readJson(extraFile)) {
      const { html, ...entry } = x;
      index.push(entry);
      writeJson(`${OUT}/posts/${x.slug}.json`, { ...entry, html });
    }
  }
  index.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  writeJson(`${OUT}/posts-index.json`, index);
  writeJson(`${OUT}/news-sections.json`, [
    ...new Map(Object.values(POST_SECTIONS).map((s) => [s.slug, s])).values(),
  ]);

  // ---- products
  const brandOf = new Map(
    wp.map((w) => [w.id, (w.class_list.find((c) => c.startsWith("thuong-hieu-")) ?? "").replace("thuong-hieu-", "")]),
  );
  const variationsFile = `${RAW}/variations.json`;
  const sourceVariations = fs.existsSync(variationsFile) ? readJson(variationsFile) : {};
  const specsFile = `${RAW}/specs.json`;
  const sourceSpecs = fs.existsSync(specsFile) ? readJson(specsFile) : {};
  // On a few product pages the editor pasted a whole description into a specification's label box. The real label
  // is the last words of that text, so recover the longest normal label (seen on other products) it ends with.
  const MAX_LABEL = 200;
  const vocab = new Set();
  for (const spec of Object.values(sourceSpecs)) for (const g of spec) for (const i of g.items) if (i.label.length <= 70) vocab.add(scrubText(i.label));
  const fixLabel = (label) => {
    if (label.length <= MAX_LABEL) return label;
    const hit = [...vocab].filter((v) => label.endsWith(v)).sort((a, b) => b.length - a.length)[0];
    return hit ?? ""; // nothing recognisable: drop the row instead of showing pasted text
  };
  const products = [];
  for (const s of store) {
    const name = plain(s.name);
    const brand = brandOf.get(s.id) || "";
    const price = Number(s.prices.price);
    const range = s.prices.price_range;
    const priceMax = range ? Number(range.max_amount) : price;
    const gallery = s.images.map((i) => localImage(i.src, i.alt || name)).filter(Boolean);
    const types = s.categories.map((c) => c.slug).filter((c) => PRODUCT_TYPES[c]);
    const colors = s.attributes.filter((a) => /màu/i.test(a.name)).flatMap((a) => a.terms.map((t) => decode(t.name)));
    // variants: one per (version, colour) with its own photo and price, like the source product page
    const termName = (taxonomy, slug) => {
      const t = s.attributes.find((a) => a.taxonomy === taxonomy)?.terms.find((x) => x.slug === slug);
      return t ? scrubText(decode(t.name)) : "";
    };
    const variants = (sourceVariations[s.slug] ?? [])
      .map((v) => {
        const color = termName("pa_mau-sac", v.attrs["attribute_pa_mau-sac"]);
        const version = termName("pa_phien-ban", v.attrs["attribute_pa_phien-ban"]);
        const attrs = [];
        if (version) attrs.push({ name: "Phiên bản", value: version });
        if (color) attrs.push({ name: "Màu sắc", value: color });
        return { attrs, img: v.img ? localImage(v.img, `${name} ${version} ${color}`) : null, price: Number(v.price) || price };
      })
      .filter((v) => v.attrs.length);
    // WooCommerce's "any colour" row (no colour set) would be unreachable next to the coloured rows of the same version
    const verOf = (v) => v.attrs.find((a) => a.name === "Phiên bản")?.value ?? "";
    const colOf = (v) => v.attrs.find((a) => a.name === "Màu sắc")?.value;
    for (const v of variants) {
      if (!colOf(v) && variants.some((o) => verOf(o) === verOf(v) && colOf(o))) v.attrs.push({ name: "Màu sắc", value: "Mặc định" });
    }
    const specs = (sourceSpecs[s.slug] ?? [])
      .map((g) => ({ title: scrubText(g.title), items: g.items.map((i) => ({ label: fixLabel(scrubText(i.label)), value: scrubText(i.value) })).filter((i) => i.label) }))
      .filter((g) => g.items.length);
    const shortHtml = cleanHtml(s.short_description, mapLink);
    const html = cleanHtml(s.description, mapLink);
    const entry = {
      slug: s.slug,
      name,
      brand,
      types,
      price,
      priceMax: Math.max(price, priceMax || price),
      img: gallery[0] ?? null,
    };
    products.push(entry);
    writeJson(`${OUT}/products/${s.slug}.json`, { ...entry, gallery, colors, variants, specs, shortHtml, html });
  }
  products.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  writeJson(`${OUT}/products-index.json`, products);
  writeJson(`${OUT}/product-meta.json`, {
    brands: Object.entries(BRANDS).map(([id, name]) => ({ id, name })),
    types: Object.entries(PRODUCT_TYPES).map(([id, name]) => ({ id, name })),
  });

  writeJson(`${RAW}/images-manifest.json`, [...registry.values()].filter((m) => !m.branded));
  console.log(JSON.stringify({ ...stats, postsOut: index.length, productsOut: products.length, images: registry.size, dropped }));
}

// ---------------------------------------------------------------- images
async function images() {
  const sharp = (await import("sharp")).default;
  const manifest = readJson(`${RAW}/images-manifest.json`);
  const todo = manifest.filter((m) => !fs.existsSync(path.join(IMG_DIR, m.rel)));
  console.log(`images: ${manifest.length} total, ${todo.length} to download`);
  const bad = new Set(fs.existsSync(`${RAW}/failed-images.json`) ? readJson(`${RAW}/failed-images.json`) : []);
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const m = todo[next++];
      let ok = false;
      for (let i = 1; i <= 3 && !ok; i++) {
        try {
          const res = await fetch(m.src, { headers: { "user-agent": "Mozilla/5.0 (content import)" } });
          if (res.status === 404 || res.status === 403) break;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          const dest = path.join(IMG_DIR, m.rel);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          await sharp(buf).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 62, effort: 4 }).toFile(dest);
          ok = true;
        } catch (e) {
          if (i === 3) console.warn("fail", m.src, e.message);
          else await sleep(1000 * i);
        }
      }
      if (!ok) bad.add(m.src);
      if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  writeJson(`${RAW}/failed-images.json`, [...bad]);
  console.log(`images done, ${bad.size} failed (re-run "transform" to drop them from the content)`);
}

// ---------------------------------------------------------------- prune
// delete converted images that no post/product references any more
function prune() {
  const used = new Set();
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : fs.readFileSync(path.join(d, e.name), "utf8").match(new RegExp(`${IMG_URL}/[^"'\\s)]+\\.webp`, "g"))?.forEach((u) => used.add(u.slice(IMG_URL.length + 1)))));
  walk(OUT);
  let removed = 0;
  const sweep = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) sweep(f);
      else if (!used.has(path.relative(IMG_DIR, f))) {
        fs.rmSync(f);
        removed++;
      }
    }
    if (!fs.readdirSync(d).length && d !== IMG_DIR) fs.rmdirSync(d);
  };
  sweep(IMG_DIR);
  console.log(`prune: removed ${removed} unused images, kept ${used.size}`);
}

// ---------------------------------------------------------------- verify
function verify() {
  const re = /ho[aà]ng\s*kim|hoangkim|huy\s*ho[aà]ng|huyhoang|0937|xemayhoangkim|wp-content|srcset|https?:\/\/(?!(?:www\.)?(?:honda|yamaha-motor|sym|suzuki|yadea))/i;
  let bad = 0;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : check(path.join(d, e.name))));
  const check = (f) => {
    const txt = fs.readFileSync(f, "utf8");
    const m = txt.match(re);
    if (m) {
      bad++;
      if (bad <= 20) console.log("LEFTOVER", path.relative(".", f), JSON.stringify(txt.slice(Math.max(0, m.index - 50), m.index + 70)));
    }
  };
  walk(OUT);
  // every referenced local image must exist
  let missing = 0;
  const imgRe = new RegExp(`${IMG_URL}/[^"'\\s)]+\\.webp`, "g");
  const seen = new Set();
  const walk2 = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk2(path.join(d, e.name)) : fs.readFileSync(path.join(d, e.name), "utf8").match(imgRe)?.forEach((u) => seen.add(u))));
  walk2(OUT);
  for (const u of seen) if (!fs.existsSync(path.resolve("public") + u)) missing++;
  console.log(`verify: ${bad} files with leftovers, ${missing}/${seen.size} referenced images missing`);
  if (bad || missing) process.exit(1);
}

const cmd = process.argv[2];
const run = { fetch: fetchRaw, transform, images, prune, verify }[cmd];
if (!run) {
  console.error("usage: import-hoangkim.mjs fetch|transform|images|prune|verify");
  process.exit(2);
}
await run();
