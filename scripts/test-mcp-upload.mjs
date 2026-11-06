// Kiểm thử đường upload tệp ảnh cho MCP (POST /api/mcp-upload) trên một server đang chạy.
// Dùng:  BASE_URL=http://127.0.0.1:3000 MCP_KEY=<key MCP> npm run test:upload
// Ảnh tải lên trong lúc thử được xoá lại bằng công cụ MCP xoa_hinh_anh. Không in key.
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const key = process.env.MCP_KEY ?? "";
if (!base || !key) {
  console.error("Thiếu BASE_URL hoặc MCP_KEY.");
  process.exit(2);
}

let failed = 0;
const check = (label, cond, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "ĐẠT " : "LỖI "} ${label}${extra ? "  " + extra : ""}`);
};
const up = (parts, headers = { authorization: `Bearer ${key}` }) => {
  const fd = new FormData();
  for (const [k, v, fileName] of parts) fd.append(k, v, ...(fileName ? [fileName] : []));
  return fetch(`${base}/api/mcp-upload`, { method: "POST", headers, body: fd });
};
const blob = (buf, type) => new Blob([buf], { type });
const made = [];
const ok = async (label, res, status) => {
  const text = await res.text();
  let j = {};
  try { j = JSON.parse(text); } catch { /* không phải JSON */ }
  check(label, res.status === status, `(${res.status}) ${text.slice(0, 110).replace(/\s+/g, " ")}`);
  if (j.id) made.push(j.id);
  return j;
};

const jpeg = await sharp({ create: { width: 1200, height: 400, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } } }).jpeg({ quality: 85 }).toBuffer();
const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#c81e1e" } }).png().toBuffer();
const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
const stray = Buffer.concat([jpeg.subarray(0, sof), Buffer.from([0, 0, 0]), jpeg.subarray(sof)]);

console.log("== Xác thực");
await ok("không có key", await up([["file", blob(jpeg, "image/jpeg"), "a.jpg"]], {}), 401);
await ok("key sai", await up([["file", blob(jpeg, "image/jpeg"), "a.jpg"]], { authorization: "Bearer ytk_saisaisaisaisaisaisaisaisaisaisaisaisai" }), 401);
await ok("GET không được phép", await fetch(`${base}/api/mcp-upload`, { headers: { authorization: `Bearer ${key}` } }), 405);

console.log("== Ảnh hợp lệ");
const a = await ok("JPEG đúng", await up([["file", blob(jpeg, "image/jpeg"), "a.jpg"], ["name", "thu-jpeg"]]), 200);
check("trả link /uploads/<mã>", /^\/uploads\/[0-9a-f]{16}$/.test(a.link ?? ""));
const img = a.link ? await fetch(base + a.link) : null;
check("mở được link ảnh, là WebP", !!img && img.status === 200 && (img.headers.get("content-type") ?? "").includes("webp"), img ? `(${img.status} ${img.headers.get("content-type")})` : "");
await ok("JPEG có 3 byte thừa", await up([["file", blob(stray, "image/jpeg"), "b.jpg"]]), 200);
await ok("PNG", await up([["file", blob(png, "image/png"), "c.png"]]), 200);
await ok("PNG đặt tên .txt và Content-Type sai (tin nội dung, không tin tên)", await up([["file", blob(png, "text/plain"), "c.txt"]]), 200);

console.log("== Từ chối");
await ok("JPEG bị cắt cụt", await up([["file", blob(jpeg.subarray(0, Math.floor(jpeg.length * 0.6)), "image/jpeg"), "d.jpg"]]), 422);
await ok("văn bản đặt tên .jpg", await up([["file", blob(Buffer.from("day khong phai la anh ".repeat(20)), "image/jpeg"), "e.jpg"]]), 422);
await ok("SVG", await up([["file", blob(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), "image/svg+xml"), "f.svg"]]), 422);
await ok("tệp rỗng", await up([["file", blob(Buffer.alloc(0), "image/jpeg"), "g.jpg"]]), 422);
await ok("quá 10 MB (vượt giới hạn ảnh, chưa vượt giới hạn gói)", await up([["file", blob(Buffer.concat([jpeg, Buffer.alloc(10 * 1024 * 1024)]), "image/jpeg"), "h.jpg"]]), 413);
await ok("quá lớn (20 MB, bị chặn ở tầng route)", await up([["file", blob(Buffer.alloc(20 * 1024 * 1024, 1), "image/jpeg"), "i.jpg"]]), 413);
await ok("hai tệp", await up([["file", blob(jpeg, "image/jpeg"), "a.jpg"], ["file", blob(png, "image/png"), "b.png"]]), 400);
await ok("sai tên trường (anh thay vì file)", await up([["anh", blob(jpeg, "image/jpeg"), "a.jpg"]]), 400);
await ok("không phải multipart", await fetch(`${base}/api/mcp-upload`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" }), 415);

console.log("== Công cụ MCP lay_lenh_tai_anh_len");
const client = new Client({ name: "test-upload", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
const r = await client.callTool({ name: "lay_lenh_tai_anh_len", arguments: {} });
const t = JSON.parse(r.content[0].text);
check("trả địa chỉ upload", typeof t.dia_chi === "string" && t.dia_chi.endsWith("/api/mcp-upload"), `(${t.dia_chi})`);
check("lệnh curl dùng biến môi trường, không chứa key", t.lenh.includes("$YENTHOA_MCP_KEY") && !t.lenh.includes(key));

console.log("== Dọn ảnh thử");
for (const id of made) {
  const d = await client.callTool({ name: "xoa_hinh_anh", arguments: { id, confirm: true } });
  if (d.isError) check(`xoá ảnh thử ${id}`, false, d.content[0].text.slice(0, 80));
}
console.log(`đã xoá ${made.length} ảnh thử`);
await client.close();

console.log(failed ? `\n${failed} ca LỖI` : "\nTất cả ca đạt");
process.exit(failed ? 1 : 0);
