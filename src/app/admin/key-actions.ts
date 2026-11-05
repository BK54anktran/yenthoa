"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { createApiKey, deleteApiKey, toggleApiKey } from "@/lib/api-keys";

export type KeyState = { error?: string; created?: { name: string; key: string } };

export async function createKeyAction(_: KeyState, f: FormData): Promise<KeyState> {
  await assertAdmin();
  const name = String(f.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Cần nhập tên gợi nhớ cho key." };
  const { key } = await createApiKey(name);
  revalidatePath("/admin/ket-noi");
  return { created: { name, key } };
}

export async function deleteKeyAction(f: FormData) {
  await assertAdmin();
  await deleteApiKey(Number(f.get("id")));
  revalidatePath("/admin/ket-noi");
}

export async function toggleKeyAction(f: FormData) {
  await assertAdmin();
  await toggleApiKey(Number(f.get("id")));
  revalidatePath("/admin/ket-noi");
}
