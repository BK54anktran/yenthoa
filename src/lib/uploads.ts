import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Uploaded images live outside public/ (Next only serves files that existed at build time) in a
// directory that is a Docker volume in production. They are served by app/uploads/[...path]/route.ts.
export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "data/uploads");
export const UPLOAD_URL = "/uploads";
export { MAX_UPLOAD_BYTES } from "./image-rules.ts"; // one limit for the browser and the server

// the URL parts are short, lower-case and contain no dots-only or separator tricks
const SEGMENT = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9]+)?$/;

// maps a request path to a file inside the upload directory, or null if it is not a plain file path in it
export function resolveUpload(parts: string[]): string | null {
  if (parts.length === 0 || parts.length > 4 || !parts.every((p) => SEGMENT.test(p))) return null;
  const root = uploadDir();
  const file = path.resolve(root, ...parts);
  return file.startsWith(root + path.sep) ? file : null;
}

// writes the photo into the upload folder under a new random name; returns the id and the path inside the folder
export async function storeImage(input: Buffer, existingId?: string): Promise<{ id: string; rel: string }> {
  const sharp = (await import("sharp")).default;
  let cause: unknown;
  const meta = await sharp(input, { failOn: "error", limitInputPixels: 80_000_000 })
    .metadata()
    .catch((e: unknown) => {
      cause = e;
      return null;
    });
  if (!meta?.format || !["jpeg", "png", "webp", "gif", "avif"].includes(meta.format)) throw new Error("Chỉ nhận ảnh JPG, PNG, WebP, GIF hoặc AVIF.", { cause: cause ?? meta?.format });
  // re-encoding drops EXIF/GPS and anything that is not pixels; rotate() applies the camera orientation first.
  // failOn "error": a recoverable libvips warning (e.g. a few stray bytes in a JPEG) does not reject the photo, a truncated one still does
  const out = await sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
  const now = new Date();
  const id = existingId ?? crypto.randomBytes(8).toString("hex");
  // a replaced photo keeps its id but gets a new file name, so nothing cached under the old name is shown
  const stem = existingId ? `${id}-${crypto.randomBytes(4).toString("hex")}` : id;
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${stem}.webp`;
  const file = path.join(uploadDir(), ...rel.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, out);
  return { id, rel };
}
