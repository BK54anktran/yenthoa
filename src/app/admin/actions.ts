"use server";

import { redirect } from "next/navigation";
import {
  assertAdmin, authConfigured, checkCredentials, clearFailures, clientKey, endSession, recordFailure, startSession, tooManyAttempts,
} from "@/lib/auth";
import { transaction } from "@/lib/db";
import { type HeroSlide } from "@/lib/defaults";
import { getAllTemplates, getCollections, getTaxonomy } from "@/lib/repo";
import { cleanValues } from "@/lib/template";
import { SETTING_KEY, MAX_CARDS, MAX_FACTS, type CornerCard, type FactItem, type HomeSection } from "@/lib/home-sections";
import { cleanHtml } from "@/lib/sanitize";
import { seedAll } from "@/lib/seed";
import { slugify } from "@/lib/slug";
import {
  clip, deletePost, deleteProduct, imgUrl, linkUrl, parseJson, refreshSite, savePost, saveProduct, saveShop, saveTaxonomy, text, togglePost, toggleProduct,
} from "@/lib/admin-service";

export type FormState = { error?: string };

// ---------------------------------------------------------------- session
export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  if (!authConfigured()) return { error: "Chưa cấu hình ADMIN_PASSWORD_HASH và SESSION_SECRET trên máy chủ." };
  const key = await clientKey();
  if (tooManyAttempts(key)) return { error: "Nhập sai quá nhiều lần. Thử lại sau 15 phút." };
  if (!checkCredentials(text(f, "user", 100), String(f.get("password") ?? "").slice(0, 200))) {
    recordFailure(key);
    return { error: "Sai tên đăng nhập hoặc mật khẩu." };
  }
  clearFailures(key);
  await startSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- posts
export async function savePostAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const r = await savePost(f);
  if ("error" in r) return { error: r.error };
  refreshSite();
  redirect("/admin/bai-viet");
}

export async function deletePostAction(f: FormData) {
  await assertAdmin();
  await deletePost(Number(f.get("id")));
  refreshSite();
}

export async function togglePostAction(f: FormData) {
  await assertAdmin();
  await togglePost(Number(f.get("id")));
  refreshSite();
}

// ---------------------------------------------------------------- products
export async function saveProductAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const r = await saveProduct(f);
  if ("error" in r) return { error: r.error };
  refreshSite();
  redirect("/admin/san-pham");
}

export async function deleteProductAction(f: FormData) {
  await assertAdmin();
  await deleteProduct(Number(f.get("id")));
  refreshSite();
}

export async function toggleProductAction(f: FormData) {
  await assertAdmin();
  await toggleProduct(Number(f.get("id")));
  refreshSite();
}

// ---------------------------------------------------------------- shop info + banners
export async function saveShopAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const r = await saveShop(f);
  if ("error" in r) return { error: r.error };
  refreshSite();
  return {};
}

type Slide = HeroSlide & { link: string; dim: boolean; imgMobile: string; fit: "cover" | "natural"; active: boolean };
function parseSlides(f: FormData): { error: string } | { slides: Slide[] } {
  const raw = parseJson<(Partial<HeroSlide> & { active?: boolean })[]>(f, "slides");
  if (!Array.isArray(raw) || raw.length > 10) return { error: "Tối đa 10 banner đầu trang." };
  const slides: Slide[] = [];
  for (const s of raw) {
    const title = clip(s.title, 200);
    const img = clip(s.img, 500);
    // a banner that was added and never filled in (no picture, no text) is left out instead of stopping the save
    if (!img && !title && !clip(s.sub, 300) && !clip(s.eyebrow, 200) && !clip(s.imgMobile, 500)) continue;
    if (!img || imgUrl(img) === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: ảnh phải bắt đầu bằng / hoặc https://` };
    const imgMobile = clip(s.imgMobile, 500);
    if (imgUrl(imgMobile) === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: ảnh trên điện thoại phải bắt đầu bằng / hoặc https://` };
    const link = linkUrl(clip(s.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
    if (link === null) return { error: `Banner ${title ? `"${title}"` : `thứ ${slides.length + 1}`}: đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
    slides.push({ eyebrow: clip(s.eyebrow, 200), title, sub: clip(s.sub, 300), img, imgMobile, fit: s.fit === "natural" ? "natural" : "cover", link, dim: s.dim !== false, active: s.active !== false });
  }
  return { slides };
}

async function parseSections(f: FormData): Promise<{ error: string } | { sections: HomeSection[] }> {
  const raw = parseJson<Partial<HomeSection>[]>(f, "sections");
  if (!Array.isArray(raw) || raw.length > 30) return { error: "Tối đa 30 mục." };
  const tax = await getTaxonomy();
  const sections: HomeSection[] = [];
  const used = new Set<string>();
  for (const r of raw) {
    // a block that was added and never filled in at all is left out instead of stopping the save
    if (!clip(r.name, 80) && ((r.kind === "banner" && !clip(r.image, 500) && !clip(r.link, 500)) || (r.kind === "showcase" && !clip(r.brand, 60) && !clip(r.collection, 120) && !(Array.isArray(r.slugs) && r.slugs.length)))) continue;
    const name = clip(r.name, 80) || (r.kind === "html" ? "Khối HTML" : "");
    if (!name) return { error: "Mỗi mục cần có tên." };
    const banner = r.kind === "banner";
    const slidesBlock = r.kind === "slides";
    let id = slugify(clip(r.id, 60)) || slugify(name) || "muc";
    for (let n = 2; used.has(id); n++) id = `${slugify(clip(r.id, 50)) || "muc"}-${n}`;
    used.add(id);
    if (slidesBlock) {
      if (sections.some((x) => x.kind === "slides")) return { error: "Chỉ được có một mục Banner đầu trang." };
      const cardsMode = r.cardsMode === "custom" || r.cardsMode === "off" ? r.cardsMode : "auto";
      const rawCards = Array.isArray(r.cards) ? r.cards : [];
      if (rawCards.length > MAX_CARDS) return { error: `Tối đa ${MAX_CARDS} thẻ ở góc banner.` };
      const cards: CornerCard[] = [];
      for (const c of rawCards) {
        const title = clip(c?.title, 80);
        const img = clip(c?.img, 500);
        if (!title) return { error: "Mỗi thẻ ở góc banner cần có tiêu đề." };
        if (!img || imgUrl(img) === null) return { error: `Thẻ "${title}": cần chọn ảnh (đường dẫn bắt đầu bằng / hoặc https://).` };
        const link = linkUrl(clip(c?.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
        if (link === null || link === "") return { error: `Thẻ "${title}": cần đường dẫn bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
        cards.push({ title, img, link });
      }
      if (cardsMode === "custom" && cards.length === 0) return { error: "Chọn kiểu thẻ tự tạo thì cần ít nhất một thẻ (hoặc đổi sang tự động / ẩn)." };
      sections.push({ id, kind: "slides", image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, cardsMode, cards });
      continue;
    }
    if (r.kind === "template") {
      const tpl = (await getAllTemplates()).find((x) => x.id === r.templateId);
      if (!tpl) return { error: `Mục "${clip(r.name, 80) || "mẫu"}": mẫu không còn tồn tại.` };
      const cv = cleanValues(tpl.fields, r.values, { html: cleanHtml, image: (s) => imgUrl(s), link: (s) => linkUrl(s) });
      if ("error" in cv) return { error: `Mục "${name || tpl.name}": ${cv.error}` };
      sections.push({ id, kind: "template", image: "", link: "", name: name || tpl.name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, templateId: tpl.id, values: cv.values });
      continue;
    }
    if (r.kind === "facts") {
      if (sections.some((x) => x.kind === "facts")) return { error: "Chỉ được có một mục Dải số liệu." };
      const rawItems = Array.isArray(r.factItems) ? r.factItems : [];
      if (rawItems.length > MAX_FACTS) return { error: `Tối đa ${MAX_FACTS} số liệu.` };
      const factItems: FactItem[] = [];
      for (const x of rawItems) {
        const auto = x?.auto === "products" || x?.auto === "brands" || x?.auto === "branches" ? x.auto : "";
        const label = clip(x?.label, 40);
        const value = clip(x?.value, 12);
        if (!label) return { error: "Mỗi số liệu cần có chữ mô tả (ví dụ \"hãng xe\")." };
        if (!auto && !value) return { error: `Số liệu "${label}": chọn cách tự đếm hoặc nhập số.` };
        factItems.push({ label, value: auto ? "" : value, auto });
      }
      sections.push({ id, kind: "facts", image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false, factItems, factCall: clip(r.factCall, 80) });
      continue;
    }
    if (r.kind === "html") {
      const html = cleanHtml(String(r.html ?? "").slice(0, 100_000));
      sections.push({ id, kind: "html", html, image: "", link: "", name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    if (r.kind === "collections") {
      if (sections.some((x) => x.kind === "collections")) return { error: "Chỉ được có một mục Bộ sưu tập." };
      // empty = show every collection; otherwise only the picked ones, in this order
      const known = new Set((await getCollections()).map((c) => c.id));
      const picked = [...new Set((Array.isArray(r.slugs) ? r.slugs : []).map((x) => clip(x, 120)))].filter((x) => known.has(x));
      sections.push({ id, kind: "collections", display: r.display === "cards" ? "cards" : "showcase", image: "", link: "", name, collection: "", brand: "", slugs: picked, backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    if (banner) {
      const image = clip(r.image, 500);
      if (!image || imgUrl(image) === null) return { error: `Banner "${name}": cần chọn ảnh (đường dẫn bắt đầu bằng / hoặc https://).` };
      const link = linkUrl(clip(r.link, 500).replace(/[\u0000-\u001f\s]/g, ""));
      if (link === null) return { error: `Banner "${name}": đường dẫn phải bắt đầu bằng /, #, http://, https://, tel: hoặc mailto:` };
      sections.push({ id, kind: "banner", image, link, name, collection: "", brand: "", slugs: [], backdrop: "", dark: false, active: r.active !== false });
      continue;
    }
    const collection = clip(r.collection, 120);
    if (collection && !(await getCollections()).some((c) => c.id === collection)) return { error: `Mục "${name}": bộ sưu tập không còn tồn tại.` };
    const brand = clip(r.brand, 60);
    if (brand && !tax.brands.some((b) => b.id === brand)) return { error: `Mục "${name}": hãng không hợp lệ.` };
    const slugs = [...new Set((Array.isArray(r.slugs) ? r.slugs : []).map((x) => clip(x, 120)).filter(Boolean))].slice(0, 80);
    if (!collection && !brand && slugs.length === 0) return { error: `Mục "${name}": chọn hãng, bộ sưu tập hoặc thêm ít nhất một xe vào danh sách.` };
    const backdrop = clip(r.backdrop, 500);
    if (imgUrl(backdrop) === null) return { error: `Mục "${name}": ảnh nền phải bắt đầu bằng / hoặc https://` };
    const backdropMobile = clip(r.backdropMobile, 500);
    if (imgUrl(backdropMobile) === null) return { error: `Mục "${name}": ảnh nền trên điện thoại phải bắt đầu bằng / hoặc https://` };
    sections.push({ id, kind: "showcase", image: "", link: "", name, collection, brand, slugs, backdrop, backdropMobile, dark: !!r.dark, active: r.active !== false });
  }
  return { sections };
}

export async function saveHomeAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const s = parseSlides(f);
  if ("error" in s) return { error: s.error };
  const c = await parseSections(f);
  if ("error" in c) return { error: c.error };
  await transaction(async (run) => {
    await run("DELETE FROM hero_slides");
    for (const [i, x] of s.slides.entries()) {
      await run("INSERT INTO hero_slides (eyebrow, title, sub, img, img_mobile, fit, link, dim, sort, active) VALUES (?,?,?,?,?,?,?,?,?,?)", [x.eyebrow, x.title, x.sub, x.img, x.imgMobile || null, x.fit, x.link, x.dim ? 1 : 0, i, x.active ? 1 : 0]);
    }
    await run("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [SETTING_KEY, JSON.stringify(c.sections)]);
  });
  refreshSite();
  return {};
}

export async function saveTaxonomyAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const r = await saveTaxonomy(f);
  if ("error" in r) return { error: r.error };
  refreshSite();
  return {};
}

// ---------------------------------------------------------------- first run
// loads the bundled posts, products, banners and shop info; never overwrites existing rows
export async function seedAction(): Promise<void> {
  await assertAdmin();
  await seedAll({ force: false });
  refreshSite();
  redirect("/admin");
}
