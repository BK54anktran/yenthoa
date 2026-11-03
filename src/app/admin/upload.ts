"use server";

import { assertAdmin } from "@/lib/auth";
import { addImage } from "@/lib/media";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

export type UploadResult = { url?: string; error?: string };

export async function uploadImageAction(f: FormData): Promise<UploadResult> {
  await assertAdmin();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn ảnh." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Ảnh quá lớn (tối đa 10 MB)." };
  try {
    return { url: await addImage(Buffer.from(await file.arrayBuffer()), file.name) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không đọc được ảnh." };
  }
}

// downloads a photo that lives on another website into the image manager and returns its /uploads/<id> link
export async function importImageAction(url: string): Promise<UploadResult> {
  await assertAdmin();
  try {
    const { fetchImage } = await import("@/lib/import-image");
    const { data, name } = await fetchImage(String(url ?? "").trim().slice(0, 2000));
    return { url: await addImage(data, name) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được ảnh." };
  }
}
