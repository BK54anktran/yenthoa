import { recordFailure, tooManyAttempts } from "@/lib/auth";
import { clientOf } from "@/lib/mcp-http";
import { describeImageError, saveImageBytes } from "@/lib/mcp-images";
import { readUploadBody } from "@/lib/mcp-upload-body";
import { logWrite } from "@/lib/mcp-tools";
import { claimUploadLink, isUploadToken, peekUploadLink } from "@/lib/upload-links";

// A one-time page for putting a photo in the image library from a browser (made by the MCP tool tao_link_tai_anh).
// The address is the only secret: it is random, works for one upload and expires after a few minutes (lib/upload-links.ts).
// Opening the page does not use it up, so a chat app that previews links cannot waste it; only a successful upload does.
// No script on the page: a plain form, so a strict Content-Security-Policy can be sent with it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

const page = (status: number, title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f5f5f5;color:#1a1a1a}main{max-width:480px;margin:8vh auto;padding:24px;background:#fff;border-radius:12px;box-shadow:0 2px 12px #0001}h1{font-size:20px;margin:0 0 12px}p{margin:8px 0}.err{color:#b00020}.ok{color:#0a7a2f}input[type=file]{display:block;margin:16px 0;width:100%}button{background:#c81e1e;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;font-weight:600;cursor:pointer}small{color:#666}img{max-width:100%;border-radius:8px;margin-top:12px}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: HEADERS },
  );

const form = (imageName: string, error?: string) =>
  `<h1>Tải ảnh lên website</h1>${error ? `<p class="err">${esc(error)}</p>` : ""}
<p>Ảnh sẽ được lưu với tên <b>${esc(imageName)}</b>. Chọn một ảnh JPG, PNG, WebP, GIF hoặc AVIF (tối đa 10 MB).</p>
<form method="post" enctype="multipart/form-data"><input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required><button type="submit">Tải lên</button></form>
<p><small>Địa chỉ này dùng được một lần và sẽ hết hạn sau vài phút.</small></p>`;

const gone = (status: number) => page(status, "Địa chỉ không dùng được", `<h1>Địa chỉ không dùng được</h1><p>Địa chỉ tải ảnh này đã hết hạn, đã được dùng, hoặc không đúng. Hãy nhờ trợ lý tạo địa chỉ mới.</p>`);

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  const { token } = await params;
  const client = `uplink:${clientOf(request)}`;
  if (tooManyAttempts(client)) return page(429, "Thử quá nhiều lần", "<h1>Thử quá nhiều lần</h1><p>Vui lòng thử lại sau 15 phút.</p>");
  const link = isUploadToken(token) ? await peekUploadLink(token) : null;
  if (!link) {
    recordFailure(client);
    return gone(404);
  }
  return page(200, "Tải ảnh lên", form(link.imageName));
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { token } = await params;
  const client = `uplink:${clientOf(request)}`;
  if (tooManyAttempts(client)) return page(429, "Thử quá nhiều lần", "<h1>Thử quá nhiều lần</h1><p>Vui lòng thử lại sau 15 phút.</p>");
  const link = isUploadToken(token) ? await peekUploadLink(token) : null;
  if (!link) {
    recordFailure(client);
    return gone(410);
  }

  // a form that cannot be read (not an upload, too big) does not use the address up
  const upload = await readUploadBody(request);
  if (!upload.ok) return page(upload.status, "Không tải được", form(link.imageName, upload.error));

  const claimed = await claimUploadLink(token);
  if (!claimed) return gone(410); // another upload took it, or it just expired
  const ctx = { keyName: claimed.keyName, origin: "" };
  try {
    const url = await saveImageBytes(upload.data, claimed.imageName);
    logWrite(ctx, "tai_anh_qua_trang", `link=${url} byte=${upload.data.length}`);
    return page(200, "Đã tải lên", `<h1 class="ok">Đã tải ảnh lên</h1><p>Ảnh <b>${esc(claimed.imageName)}</b> đã vào kho. Quay lại cuộc trò chuyện và báo đã tải xong; bạn có thể đóng trang này.</p><img src="${esc(url)}" alt="">`);
  } catch (e) {
    const message = describeImageError(upload.data, e);
    logWrite(ctx, "tai_anh_qua_trang", `loi=${message}`);
    await claimed.restore().catch(() => undefined); // the photo was refused: the same address can be used again
    return page(e instanceof Error && /quá lớn/.test(e.message) ? 413 : 422, "Không tải được", form(claimed.imageName, e instanceof Error ? e.message : "Không tải được ảnh."));
  }
}
