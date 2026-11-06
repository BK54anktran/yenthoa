"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { productsOf, type Collection } from "@/lib/collections";
import { getProducts } from "@/lib/repo";
import { createCollection, deleteCollection, moveCollection, saveCollection } from "@/lib/admin-service";
import { clip } from "@/lib/validate";

export type CollectionFormState = { error?: string };

const refresh = () => revalidatePath("/", "layout");

export async function createCollectionAction(_: CollectionFormState, f: FormData): Promise<CollectionFormState> {
  await assertAdmin();
  const r = await createCollection(f);
  if ("error" in r) return { error: r.error };
  refresh();
  redirect(`/admin/bo-suu-tap/${r.id}`);
}

export async function saveCollectionAction(_: CollectionFormState, f: FormData): Promise<CollectionFormState> {
  await assertAdmin();
  const r = await saveCollection(f);
  if ("error" in r) return { error: r.error };
  refresh();
  return {};
}

export async function reorderCollectionsAction(f: FormData): Promise<void> {
  await assertAdmin();
  await moveCollection(clip(f.get("id"), 120), f.get("dir") === "up" ? "up" : "down");
  refresh();
}

export async function deleteCollectionAction(f: FormData): Promise<void> {
  await assertAdmin();
  await deleteCollection(clip(f.get("id"), 120));
  refresh();
  redirect("/admin/bo-suu-tap");
}

// how many products the rules of an automatic collection match right now (for the preview in the editor)
export async function previewCountAction(rules: Pick<Collection, "brands" | "types" | "priceMin" | "priceMax">): Promise<number> {
  await assertAdmin();
  const products = await getProducts();
  return productsOf({ id: "", name: "", description: "", html: "", image: "", backdrop: "", dark: false, mode: "auto", slugs: [], active: true, ...rules }, products).length;
}
