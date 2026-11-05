"use server";

import { assertAdmin } from "@/lib/auth";
import { addImage } from "@/lib/media";
import { DOCUMENT_MAX_BYTES, documentToHtml } from "@/lib/import-document";
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

// reads a Word or PDF file and returns the HTML to put in an HTML field
export async function importDocumentAction(f: FormData): Promise<{ html?: string; warnings?: string[]; error?: string }> {
  await assertAdmin();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn tệp." };
  if (file.size > DOCUMENT_MAX_BYTES) return { error: "Tệp quá lớn (tối đa 10 MB)." };
  try {
    const { html, warnings } = await documentToHtml(Buffer.from(await file.arrayBuffer()), file.name);
    return html.trim() ? { html, warnings } : { error: warnings[0] ?? "Tệp không có nội dung." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không đọc được tệp." };
  }
}
