import dns from "node:dns/promises";
import net from "node:net";
import { MAX_UPLOAD_BYTES } from "./uploads.ts";

// Downloads a photo from another website for the image manager. The server fetches the address the admin gives, so it must
// never reach machines of our own network: every address a host name leads to (also after each redirect) has to be public.
const MAX_REDIRECTS = 4;

// true when `ip` is a normal address on the internet (not loopback, private, link-local, multicast, ...)
export function isPublicIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && Number(ip.split(".")[2]) === 0))) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x); // IPv4 written as IPv6
    if (mapped) return isPublicIp(mapped[1]);
    if (x === "::" || x === "::1") return false;
    if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff")) return false; // unique local, link-local, multicast
    return true;
  }
  return false;
}

async function assertPublic(host: string): Promise<void> {
  // a switch for automated tests against a local server; never set it on a real server
  if (process.env.IMPORT_ALLOW_PRIVATE === "1") return;
  const h = host.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(h) ? [h] : (await dns.lookup(h, { all: true })).map((a) => a.address);
  if (addrs.length === 0 || !addrs.every(isPublicIp)) throw new Error("Địa chỉ này không được phép tải ảnh.");
}

export async function fetchImage(rawUrl: string): Promise<{ data: Buffer; name: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Link ảnh không hợp lệ.");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Chỉ tải được link http hoặc https.");
    if (url.username || url.password) throw new Error("Link ảnh không hợp lệ.");
    await assertPublic(url.hostname);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { accept: "image/*", "user-agent": "YenThoa-ImageImport/1.0" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Trang ảnh chuyển hướng sai.");
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new Error(`Không tải được ảnh (mã lỗi ${res.status}).`);
    if (!(res.headers.get("content-type") ?? "").toLowerCase().startsWith("image/")) throw new Error("Link này không phải là ảnh.");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) throw new Error("Ảnh quá lớn (tối đa 10 MB).");
    // read at most the limit, whatever the server says
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Không đọc được ảnh.");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new Error("Ảnh quá lớn (tối đa 10 MB).");
      }
      chunks.push(value);
    }
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
    return { data: Buffer.concat(chunks), name: last || "anh" };
  }
  throw new Error("Link ảnh chuyển hướng quá nhiều lần.");
}
