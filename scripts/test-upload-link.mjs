// Kiểm thử tao_link_tai_anh (trang upload dùng một lần /tai-anh/<token>) và tai_anh_tu_file trên một server đang chạy.
// Dùng:  BASE_URL=http://127.0.0.1:3000 MCP_KEY=<key MCP> npm run test:upload-link
// Phần thử tai_anh_tu_file cần server chạy với  IMPORT_ALLOW_PRIVATE=1 NODE_TLS_REJECT_UNAUTHORIZED=0  (chỉ để thử, đừng đặt trên server thật);
// thiếu thì phần đó bị bỏ qua. Ảnh tạo trong lúc thử được xoá lại bằng xoa_hinh_anh. Không in key hay địa chỉ có token.
import https from "node:https";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

// each request comes from its own made-up address (the server counts wrong guesses per address), unless a test fixes one
let n = 0;
const go = (url, init = {}, ip = `10.${(process.pid >> 8) & 255}.${(Date.now() >> 6) & 255}.${++n % 250 + 1}`) => fetch(url, { ...init, headers: { ...(init.headers ?? {}), "x-forwarded-for": ip } });

const png = await sharp({ create: { width: 300, height: 150, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 50 } } }).png().toBuffer();
const form = (buf, type = "image/png", name = "a.png") => {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type }), name);
  return fd;
};

const client = new Client({ name: "test-upload-link", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content[0].text;
  let data = null;
  try { data = JSON.parse(text); } catch { /* lỗi dạng chữ */ }
  return { error: !!r.isError, text, data };
};
const made = [];
const findByName = async (q) => (await call("tim_hinh_anh", { q })).data?.hinh_anh ?? [];

console.log("== Khai báo công cụ");
const tools = (await client.listTools()).tools;
const fileTool = tools.find((t) => t.name === "tai_anh_tu_file");
check("có công cụ tai_anh_tu_file", !!fileTool);
check('khai báo _meta "openai/fileParams": ["file"]', JSON.stringify(fileTool?._meta?.["openai/fileParams"]) === '["file"]', JSON.stringify(fileTool?._meta ?? null));
const fp = fileTool?.inputSchema?.properties?.file;
check("tham số file có download_url và file_id bắt buộc", Array.isArray(fp?.required) && fp.required.includes("download_url") && fp.required.includes("file_id"));
check("mime_type và file_name không bắt buộc", fp && !fp.required.includes("mime_type") && !fp.required.includes("file_name") && "mime_type" in fp.properties && "file_name" in fp.properties);
check("có công cụ tao_link_tai_anh", tools.some((t) => t.name === "tao_link_tai_anh"));
check("giữ nguyên tai_anh_len, tai_anh_tu_link, lay_lenh_tai_anh_len", ["tai_anh_len", "tai_anh_tu_link", "lay_lenh_tai_anh_len"].every((n) => tools.some((t) => t.name === n)));

console.log("== Trang upload dùng một lần");
const ten = `thu-link-${Date.now().toString(36)}`;
const made1 = await call("tao_link_tai_anh", { name: ten });
const url = made1.data?.dia_chi ?? "";
check("tao_link_tai_anh trả địa chỉ /tai-anh/ytu_...", /\/tai-anh\/ytu_[A-Za-z0-9_-]{32}$/.test(url));
check("trả tên ảnh và hạn", made1.data?.ten_anh === ten && made1.data?.het_han_sau_phut === 10);
const g1 = await go(url);
const html = await g1.text();
check("mở trang: 200, có form chọn tệp", g1.status === 200 && /<input type="file" name="file"/.test(html) && html.includes(ten));
check("trang không bị công cụ tìm kiếm lưu, không cache, CSP chặt", (g1.headers.get("x-robots-tag") ?? "").includes("noindex") && g1.headers.get("cache-control") === "no-store" && /default-src 'none'/.test(g1.headers.get("content-security-policy") ?? ""));
check("trang không có thẻ script", !/<script/i.test(html));
check("mở lại trang lần hai vẫn được (mở trang không tiêu hao)", (await go(url)).status === 200);

const bad = await go(`${base}/tai-anh/ytu_${"A".repeat(32)}`);
check("địa chỉ sai: 404", bad.status === 404);
check("địa chỉ sai định dạng: 404", (await go(`${base}/tai-anh/abc`)).status === 404);
check("POST vào địa chỉ sai: 410", (await go(`${base}/tai-anh/ytu_${"B".repeat(32)}`, { method: "POST", body: form(png) })).status === 410);

const notImg = await go(url, { method: "POST", body: form(Buffer.from("day khong phai la anh ".repeat(20)), "image/png", "x.png") });
check("tệp không phải ảnh: 422, báo lỗi", notImg.status === 422 && (await notImg.text()).includes("Chỉ nhận ảnh"));
check("sau khi bị từ chối, địa chỉ vẫn dùng được", (await go(url)).status === 200);
const notMultipart = await go(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
check("không phải multipart: 415, địa chỉ vẫn còn", notMultipart.status === 415 && (await go(url)).status === 200);
const tooBig = await go(url, { method: "POST", body: form(Buffer.alloc(20 * 1024 * 1024, 1), "image/png", "big.png") });
check("tệp 20 MB: 413, địa chỉ vẫn còn", tooBig.status === 413 && (await go(url)).status === 200);

const okRes = await go(url, { method: "POST", body: form(png) });
const okHtml = await okRes.text();
check("tải ảnh thật: 200, báo đã tải", okRes.status === 200 && okHtml.includes("Đã tải ảnh lên"));
const found = await findByName(ten);
check("tim_hinh_anh tìm thấy ảnh theo tên đã đặt", found.length === 1, `(${found.length})`);
if (found[0]) made.push(found[0].link.replace("/uploads/", ""));
const shown = found[0] ? await go(base + found[0].link) : null;
check("ảnh mở được, là WebP", !!shown && shown.status === 200 && (shown.headers.get("content-type") ?? "").includes("webp"));
check("dùng lần hai: 410", (await go(url, { method: "POST", body: form(png) })).status === 410);
check("mở trang sau khi dùng: 404", (await go(url)).status === 404);

console.log("== Hai lần tải cùng lúc: chỉ một lần được");
const m2 = await call("tao_link_tai_anh", { name: `${ten}-song-song` });
const rs = await Promise.all([go(m2.data.dia_chi, { method: "POST", body: form(png) }), go(m2.data.dia_chi, { method: "POST", body: form(png) })]);
const codes = rs.map((r) => r.status).sort();
check("một lần 200, một lần 410", codes[0] === 200 && codes[1] === 410, `(${codes.join(",")})`);
for (const i of await findByName(`${ten}-song-song`)) made.push(i.link.replace("/uploads/", ""));
check("kho chỉ có một ảnh từ hai lần tải", (await findByName(`${ten}-song-song`)).length === 1);

console.log("== Giới hạn đoán sai địa chỉ");
const same = "10.99.99.99";
const codes5 = [];
for (let i = 0; i < 6; i++) codes5.push((await go(`${base}/tai-anh/ytu_${String.fromCharCode(67 + i).repeat(32)}`, {}, same)).status);
check("5 lần sai liên tiếp là 404, lần thứ 6 bị chặn 429", codes5.slice(0, 5).every((c) => c === 404) && codes5[5] === 429, `(${codes5.join(",")})`);
const m3 = await call("tao_link_tai_anh", { name: `${ten}-chan` });
check("địa chỉ đang bị chặn cũng không mở được link đúng", (await go(m3.data.dia_chi, {}, same)).status === 429);
check("máy khác vẫn mở được link đúng", (await go(m3.data.dia_chi)).status === 200);

console.log("== tao_link_tai_anh: tham số");
const dflt = await call("tao_link_tai_anh", {});
check("không đặt tên: tự đặt tên tai-len-xxxxxx", /^tai-len-[0-9a-f]{6}$/.test(dflt.data?.ten_anh ?? ""));
const long = await call("tao_link_tai_anh", { phut: 31 });
check("phut = 31 bị từ chối", long.error);
const short = await call("tao_link_tai_anh", { phut: 2 });
check("phut = 2 được", short.data?.het_han_sau_phut === 2);

if (process.env.SKIP_FILE_TOOL === "1") {
  console.log("== tai_anh_tu_file: bỏ qua (SKIP_FILE_TOOL=1)");
} else {
  console.log("== tai_anh_tu_file");
  const http = await call("tai_anh_tu_file", { file: { download_url: "http://example.com/a.png", file_id: "file_1" } });
  check("link http bị từ chối (chỉ nhận https)", http.error && /https/.test(http.text), `(${http.text.slice(0, 80)})`);
  const missing = await call("tai_anh_tu_file", { file: { download_url: "https://example.com/a.png" } });
  check("thiếu file_id bị từ chối", missing.error);

  // máy chủ https cục bộ với chứng chỉ tự ký, trả ảnh dưới dạng application/octet-stream như link tạm của ứng dụng chat
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", `${dir}/k.pem`, "-out", `${dir}/c.pem`, "-days", "1", "-subj", "/CN=127.0.0.1"], { stdio: "ignore" });
  const srv = https.createServer({ key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) }, (req, res) => {
    if (req.url === "/ok") return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(png);
    if (req.url === "/text") return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(Buffer.from("khong phai anh ".repeat(30)));
    res.writeHead(403).end("expired");
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const addr = `https://127.0.0.1:${srv.address().port}`;
  const tenFile = `thu-file-${Date.now().toString(36)}`;
  const r = await call("tai_anh_tu_file", { file: { download_url: `${addr}/ok`, file_id: "file_abc", mime_type: "image/png", file_name: "banner.png" }, name: tenFile });
  if (r.error && /không được phép|Địa chỉ này/.test(r.text)) {
    console.log("BỎ QUA  server không bật IMPORT_ALLOW_PRIVATE=1 nên không thử được tải từ máy chủ cục bộ");
  } else {
    check("tải tệp octet-stream thành công", !r.error && !!r.data?.image_id, `(${r.text.slice(0, 100)})`);
    check("trả image_id, url, size, mime_type", /^[0-9a-f]{16}$/.test(r.data?.image_id ?? "") && /^https?:\/\/.+\/uploads\/[0-9a-f]{16}$/.test(r.data?.url ?? "") && r.data?.size > 0 && r.data?.mime_type === "image/webp", JSON.stringify(r.data));
    if (r.data?.image_id) made.push(r.data.image_id);
    const f2 = await findByName(tenFile);
    check("ảnh vào kho đúng tên đã đặt", f2.length === 1);
    const r2 = await call("tai_anh_tu_file", { file: { download_url: `${addr}/ok`, file_id: "file_def", file_name: "Banner Mua Xuan.png" } });
    if (r2.data?.image_id) made.push(r2.data.image_id);
    const named = r2.data?.image_id ? (await call("xem_hinh_anh", { id: r2.data.image_id })).data?.ten : "";
    check("không đặt name thì lấy tên tệp", named === "Banner Mua Xuan", `(${named})`);
    const t = await call("tai_anh_tu_file", { file: { download_url: `${addr}/text`, file_id: "file_txt" } });
    check("tệp không phải ảnh bị từ chối kèm chẩn đoán", t.error && /Chỉ nhận ảnh/.test(t.text) && /chẩn đoán/.test(t.text), `(${t.text.slice(0, 90)})`);
    const ex = await call("tai_anh_tu_file", { file: { download_url: `${addr}/het-han`, file_id: "file_old" } });
    check("link hết hạn (403) báo nhờ người dùng gửi lại ảnh", ex.error && /gửi lại ảnh/.test(ex.text), `(${ex.text.slice(0, 90)})`);
  }
  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("== Dọn ảnh thử");
for (const id of new Set(made)) {
  const d = await call("xoa_hinh_anh", { id, confirm: true });
  if (d.error) check(`xoá ảnh thử ${id}`, false, d.text.slice(0, 80));
}
console.log(`đã xoá ${new Set(made).size} ảnh thử`);
await client.close();
console.log(failed ? `\n${failed} lỗi` : "\nTất cả đạt");
process.exit(failed ? 1 : 0);
