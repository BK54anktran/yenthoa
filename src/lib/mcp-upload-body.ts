import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

// Reading a multipart upload that holds exactly one photo, for /api/mcp-upload (a key in a header) and /tai-anh/<token> (a one-time page).
// ảnh tối đa 10 MB, cộng phần đóng gói multipart
export const MAX_BODY = MAX_UPLOAD_BYTES + 512 * 1024;

// reads the body but gives up as soon as it passes the limit (Content-Length can be missing or wrong)
async function readLimited(request: Request): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

export type UploadBody = { ok: true; data: Buffer; fileName: string; fields: FormData } | { ok: false; status: number; error: string };

// the single file of a form, in the field "file"; every refusal comes with its HTTP status and a Vietnamese message
export async function readUploadBody(request: Request): Promise<UploadBody> {
  const tooBig: UploadBody = { ok: false, status: 413, error: "Ảnh quá lớn (tối đa 10 MB)." };
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) return tooBig;
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) return { ok: false, status: 415, error: 'Gửi dạng multipart/form-data, ví dụ: curl -F "file=@anh.jpg".' };
  const body = await readLimited(request);
  if (!body) return tooBig;
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(body), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return { ok: false, status: 400, error: "Không đọc được dữ liệu gửi lên." };
  }
  const files = [...form.entries()].filter(([, v]) => typeof v !== "string");
  if (files.length !== 1 || files[0][0] !== "file") return { ok: false, status: 400, error: 'Chỉ nhận đúng một tệp, đặt tên trường là "file".' };
  const file = files[0][1] as File;
  return { ok: true, data: Buffer.from(await file.arrayBuffer()), fileName: file.name, fields: form };
}
