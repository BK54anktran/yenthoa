"use server";

import { redirect } from "next/navigation";
import {
  assertAdmin, authConfigured, checkCredentials, clearFailures, clientKey, endSession, recordFailure, startSession, tooManyAttempts,
} from "@/lib/auth";
import { seedAll } from "@/lib/seed";
import {
  deletePost, deleteProduct, refreshSite, saveHome, savePost, saveProduct, saveShop, saveTaxonomy, text, togglePost, toggleProduct,
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

export async function saveHomeAction(_: FormState, f: FormData): Promise<FormState> {
  await assertAdmin();
  const r = await saveHome(f);
  if ("error" in r) return { error: r.error };
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
