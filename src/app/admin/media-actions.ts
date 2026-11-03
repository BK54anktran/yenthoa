"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { deleteImage, isMediaId, renameImage, replaceImage } from "@/lib/media";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

export type MediaResult = { error?: string };

const refresh = () => {
  revalidatePath("/", "layout");
  revalidatePath("/admin/hinh-anh");
};

export async function deleteImageAction(f: FormData): Promise<void> {
  await assertAdmin();
  const id = String(f.get("id") ?? "");
  if (!isMediaId(id)) return;
  await deleteImage(id);
  refresh();
}

// the same id, a different picture: every place that uses the photo shows the new one, nothing else is edited
export async function replaceImageAction(f: FormData): Promise<MediaResult> {
  await assertAdmin();
  const id = String(f.get("id") ?? "");
  if (!isMediaId(id)) return { error: "Mã ảnh không hợp lệ." };
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn ảnh." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Ảnh quá lớn (tối đa 10 MB)." };
  try {
    await replaceImage(id, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không đọc được ảnh." };
  }
  refresh();
  return {};
}

export async function renameImageAction(f: FormData): Promise<MediaResult> {
  await assertAdmin();
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name") ?? "").trim();
  if (!isMediaId(id)) return { error: "Mã ảnh không hợp lệ." };
  if (!name) return { error: "Cần nhập tên." };
  await renameImage(id, name);
  revalidatePath("/admin/hinh-anh");
  return {};
}
