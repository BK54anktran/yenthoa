import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { addImage } from "@/lib/media";

// Phần xử lý ảnh gửi lên qua MCP dùng chung cho công cụ tai_anh_len (base64) và đường upload tệp /api/mcp-upload.
// Loại ảnh, nén WebP, bỏ EXIF/GPS do storeImage (lib/uploads.ts) làm trên nội dung thật của tệp.

// bytes -> link /uploads/<mã>; ném lỗi tiếng Việt nếu rỗng, quá lớn hoặc không phải ảnh được nhận
export async function saveImageBytes(data: Buffer, name: string): Promise<string> {
  if (data.length === 0) throw new Error("Dữ liệu ảnh rỗng.");
  if (data.length > MAX_UPLOAD_BYTES) throw new Error("Ảnh quá lớn (tối đa 10 MB).");
  return addImage(data, name.trim() || "anh-tai-len");
}

// đoán định dạng theo chữ ký (magic bytes) để báo lỗi dễ hiểu; không dùng để quyết định nhận ảnh
function sniff(b: Buffer): string {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "JPEG";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "PNG";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "WebP";
  if (b.length >= 6 && b.toString("latin1", 0, 4) === "GIF8") return "GIF";
  if (b.length >= 12 && b.toString("latin1", 4, 12).startsWith("ftyp")) return "HEIF/AVIF";
  return "không nhận ra";
}

// thông báo lỗi kèm kích thước, chữ ký và lỗi gốc của thư viện ảnh (không kèm nội dung ảnh)
export function describeImageError(data: Buffer, e: unknown): string {
  const msg = e instanceof Error ? e.message : "Không tải được ảnh.";
  const root = e instanceof Error && e.cause ? (e.cause instanceof Error ? e.cause.message : String(e.cause)) : "";
  return `${msg} [chẩn đoán: ${data.length} byte; chữ ký ${data.subarray(0, 12).toString("hex")} (${sniff(data)})${root ? `; lỗi gốc: ${root.split("\n")[0]}` : ""}]`;
}

// Hosts a chat app may hand over a file from (tai_anh_tu_file). The signed download address of each app lives on its own
// domain, so this is a setting, not a guess: MCP_FILE_HOSTS="host1.example,host2.example" (sub-domains included).
// Not set: any public https address is accepted (private and internal addresses are always refused, see import-image.ts).
export function fileHostsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.MCP_FILE_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
}
