// Kiểm thử phần tải tệp của tai_anh_tu_file (fetchImage với tuỳ chọn) bằng một máy chủ cục bộ; không cần cơ sở dữ liệu.
//   npm run test:file-fetch
import http from "node:http";
import sharp from "sharp";
import { fetchImage, hostAllowed } from "../src/lib/import-image.ts";

let failed = 0;
const check = (label, cond, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "ĐẠT " : "LỖI "} ${label}${extra ? "  " + extra : ""}`);
};
const rejects = async (label, p, pattern) => {
  try {
    await p;
    check(label, false, "(không báo lỗi)");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    check(label, pattern.test(m), `(${m})`);
  }
};

const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#c81e1e" } }).png().toBuffer();
const big = Buffer.alloc(11 * 1024 * 1024, 1);

const server = http.createServer((req, res) => {
  const u = req.url ?? "";
  if (u === "/octet") return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(png);
  if (u === "/png") return void res.writeHead(200, { "content-type": "image/png" }).end(png);
  if (u === "/big") return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(big);
  if (u === "/bad") return void res.writeHead(404).end("no");
  if (u.startsWith("/r/")) {
    const n = Number(u.slice(3));
    return void res.writeHead(302, { location: n > 0 ? `/r/${n - 1}` : "/octet" }).end();
  }
  if (u === "/to-other") return void res.writeHead(302, { location: `http://localhost:${port}/octet` }).end();
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

console.log("== hostAllowed");
check("đúng tên miền", hostAllowed("files.example.com", ["files.example.com"]));
check("tên miền con", hostAllowed("a.files.example.com", ["example.com"]));
check("*.example.com", hostAllowed("x.example.com", ["*.example.com"]));
check("không khớp đuôi giả (badexample.com)", !hostAllowed("badexample.com", ["example.com"]));
check("không khớp example.com.evil.net", !hostAllowed("example.com.evil.net", ["example.com"]));
check("không phân biệt hoa thường", hostAllowed("FILES.Example.COM", ["example.com"]));
check("danh sách rỗng/chuỗi trống không cho phép gì", !hostAllowed("example.com", ["", " "]));

console.log("== Chặn địa chỉ nội bộ (không bật IMPORT_ALLOW_PRIVATE)");
delete process.env.IMPORT_ALLOW_PRIVATE;
await rejects("127.0.0.1 bị từ chối", fetchImage(`${base}/octet`, { anyContentType: true }), /không được phép/);
await rejects("169.254.169.254 (metadata đám mây) bị từ chối", fetchImage("http://169.254.169.254/latest/meta-data/", { anyContentType: true }), /không được phép/);
await rejects("[::1] bị từ chối", fetchImage("http://[::1]/x", { anyContentType: true }), /không được phép/);

console.log("== Tuỳ chọn (cho phép máy chủ cục bộ để thử)");
process.env.IMPORT_ALLOW_PRIVATE = "1";
const a = await fetchImage(`${base}/octet`, { anyContentType: true });
check("application/octet-stream được nhận khi anyContentType", a.data.equals(png));
await rejects("application/octet-stream bị từ chối khi không bật anyContentType", fetchImage(`${base}/octet`), /không phải là ảnh/);
check("image/png vẫn nhận như cũ", (await fetchImage(`${base}/png`)).data.equals(png));
await rejects("httpsOnly từ chối http", fetchImage(`${base}/octet`, { anyContentType: true, httpsOnly: true }), /https/);
await rejects("danh sách tên miền: host không có trong danh sách", fetchImage(`${base}/octet`, { anyContentType: true, allowedHosts: ["files.example.com"] }), /danh sách được phép/);
check("danh sách tên miền: host có trong danh sách", (await fetchImage(`${base}/octet`, { anyContentType: true, allowedHosts: ["127.0.0.1"] })).data.length === png.length);
await rejects("chuyển hướng sang host ngoài danh sách bị chặn", fetchImage(`${base}/to-other`, { anyContentType: true, allowedHosts: ["127.0.0.1"] }), /danh sách được phép/);
check("chuyển hướng 3 lần vẫn tải được", (await fetchImage(`${base}/r/3`, { anyContentType: true })).data.equals(png));
await rejects("chuyển hướng quá nhiều lần", fetchImage(`${base}/r/9`, { anyContentType: true }), /quá nhiều lần/);
await rejects("tệp quá 10 MB", fetchImage(`${base}/big`, { anyContentType: true }), /quá lớn/);
await rejects("máy chủ trả 404", fetchImage(`${base}/bad`, { anyContentType: true }), /404/);
await rejects("link có tài khoản:mật khẩu", fetchImage(`http://u:p@127.0.0.1:${port}/octet`, { anyContentType: true }), /không hợp lệ/);
await rejects("giao thức file://", fetchImage("file:///etc/passwd", { anyContentType: true }), /http hoặc https/);

server.close();
console.log(failed ? `\n${failed} lỗi` : "\nTất cả đạt");
process.exit(failed ? 1 : 0);
