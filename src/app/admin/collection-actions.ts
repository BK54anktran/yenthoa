"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { exec } from "@/lib/db";
import { COLLECTIONS_KEY, MAX_COLLECTIONS, productsOf, type Collection } from "@/lib/collections";
import { getCollections, getProducts, getTaxonomy } from "@/lib/repo";
import { cleanHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";
import { clip, imgUrl } from "@/lib/validate";

export type CollectionFormState = { error?: string };

const refresh = () => revalidatePath("/", "layout");
const save = (list: Collection[]) =>
  exec("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [COLLECTIONS_KEY, JSON.stringify(list)]);

export async function createCollectionAction(_: CollectionFormState, f: FormData): Promise<CollectionFormState> {
  await assertAdmin();
  const name = clip(f.get("name"), 80);
  if (!name) return { error: "Cần nhập tên bộ sưu tập." };
  const all = await getCollections();
  if (all.length >= MAX_COLLECTIONS) return { error: `Tối đa ${MAX_COLLECTIONS} bộ sưu tập.` };
  const base = slugify(name) || "bo-suu-tap";
  let id = base;
  for (let n = 2; all.some((c) => c.id === id); n++) id = `${base}-${n}`.slice(0, 120);
  await save([...all, { id, name, description: "", html: "", image: "", backdrop: "", dark: false, mode: "manual", slugs: [], brands: [], types: [], priceMin: 0, priceMax: 0, active: true }]);
  refresh();
  redirect(`/admin/bo-suu-tap/${id}`);
}

export async function saveCollectionAction(_: CollectionFormState, f: FormData): Promise<CollectionFormState> {
  await assertAdmin();
  const id = clip(f.get("id"), 120);
  const all = await getCollections();
  if (!all.some((c) => c.id === id)) return { error: "Không tìm thấy bộ sưu tập này." };
  let raw: Partial<Collection>;
  try {
    raw = JSON.parse(String(f.get("collection") ?? ""));
  } catch {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const name = clip(raw.name, 80);
  if (!name) return { error: "Cần nhập tên bộ sưu tập." };
  const image = clip(raw.image, 500);
  if (imgUrl(image) === null) return { error: "Ảnh phải bắt đầu bằng / hoặc https://" };
  const backdrop = clip(raw.backdrop, 500);
  if (imgUrl(backdrop) === null) return { error: "Ảnh nền phải bắt đầu bằng / hoặc https://" };
  const backdropMobile = clip(raw.backdropMobile, 500);
  if (imgUrl(backdropMobile) === null) return { error: "Ảnh nền trên điện thoại phải bắt đầu bằng / hoặc https://" };
  const tax = await getTaxonomy();
  const mode = raw.mode === "auto" ? "auto" : "manual";
  const slugs = [...new Set((Array.isArray(raw.slugs) ? raw.slugs : []).map((x) => clip(x, 191)).filter(Boolean))].slice(0, 200);
  const brands = (Array.isArray(raw.brands) ? raw.brands : []).map((x) => clip(x, 60)).filter((b) => tax.brands.some((x) => x.id === b));
  const types = (Array.isArray(raw.types) ? raw.types : []).map((x) => clip(x, 60)).filter((t) => tax.types.some((x) => x.id === t));
  const money = (v: unknown) => Math.max(0, Math.round(Number(String(v ?? "0").replace(/[^\d.]/g, "")) || 0));
  const priceMin = money(raw.priceMin);
  const priceMax = money(raw.priceMax);
  if (priceMax && priceMin > priceMax) return { error: "Giá từ phải nhỏ hơn hoặc bằng giá đến." };
  if (mode === "manual" && slugs.length === 0 && raw.active !== false) return { error: "Bộ sưu tập chọn tay cần ít nhất một xe (hoặc tắt hiển thị)." };
  const next: Collection = { id, name, description: cleanHtml(String(raw.description ?? "").slice(0, 5000)), html: cleanHtml(String(raw.html ?? "").slice(0, 200_000)), image, backdrop, backdropMobile, dark: !!raw.dark, mode, slugs, brands, types, priceMin, priceMax, active: raw.active !== false };
  await save(all.map((c) => (c.id === id ? next : c)));
  refresh();
  return {};
}

export async function reorderCollectionsAction(f: FormData): Promise<void> {
  await assertAdmin();
  const id = clip(f.get("id"), 120);
  const dir = f.get("dir") === "up" ? -1 : 1;
  const all = await getCollections();
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await save(all);
  refresh();
}

export async function deleteCollectionAction(f: FormData): Promise<void> {
  await assertAdmin();
  const id = clip(f.get("id"), 120);
  await save((await getCollections()).filter((c) => c.id !== id));
  refresh();
  redirect("/admin/bo-suu-tap");
}

// how many products the rules of an automatic collection match right now (for the preview in the editor)
export async function previewCountAction(rules: Pick<Collection, "brands" | "types" | "priceMin" | "priceMax">): Promise<number> {
  await assertAdmin();
  const products = await getProducts();
  return productsOf({ id: "", name: "", description: "", html: "", image: "", backdrop: "", dark: false, mode: "auto", slugs: [], active: true, ...rules }, products).length;
}
