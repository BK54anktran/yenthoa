import { authenticate, bearerKey, json, notAllowed } from "@/lib/mcp-http";
import { describeImageError, saveImageBytes } from "@/lib/mcp-images";
import { logWrite } from "@/lib/mcp-tools";
import { readUploadBody } from "@/lib/mcp-upload-body";

// Đưa một tệp ảnh lên kho Hình ảnh mà không phải gõ base64 (cho AI có Bash: curl -F "file=@anh.jpg").
// Chỉ nhận key MCP trong header  Authorization: Bearer <key>  (không dùng phiên đăng nhập admin).
// Loại ảnh được xác định bằng nội dung tệp (storeImage), không tin phần mở rộng hay Content-Type; SVG không nằm trong danh sách nhận.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const who = await authenticate(request, bearerKey(request));
  if (!who.ok) return who.response;

  const upload = await readUploadBody(request);
  if (!upload.ok) return json(upload.status, { error: upload.error });
  const nameField = upload.fields.get("name");
  const name = typeof nameField === "string" && nameField.trim() ? nameField : upload.fileName.replace(/\.[a-z0-9]{2,5}$/i, "");
  const data = upload.data;
  try {
    const link = await saveImageBytes(data, name.slice(0, 200));
    logWrite({ keyName: who.name, origin: "" }, "tai_anh_len_tep", `link=${link} byte=${data.length}`);
    return json(200, { link, id: link.replace("/uploads/", "") });
  } catch (e) {
    const message = describeImageError(data, e);
    logWrite({ keyName: who.name, origin: "" }, "tai_anh_len_tep", `loi=${message}`);
    return json(e instanceof Error && /quá lớn/.test(e.message) ? 413 : 422, { error: message });
  }
}
export const GET = notAllowed;
export const DELETE = notAllowed;
