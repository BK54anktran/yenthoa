// The rules every picture field in the admin follows (the HTML editor, every image box, the product gallery, the image manager).
// Pure functions and constants, safe in the browser. The server side of the same rules: uploads.ts (10 MB, JPG/PNG/WebP/GIF/AVIF,
// re-encoded to WebP without EXIF), import-image.ts (downloading from other websites, with the SSRF guard) and media-ref.ts
// (the database keeps only /uploads/<id>).
//
//  1. A picture is stored as /uploads/<id>. Replacing that picture in the image manager changes every place that shows it.
//  2. A copied picture file (Ctrl+V) or a file dropped on a field is uploaded first, then used.
//  3. A link to a picture on another website is downloaded into the image manager and replaced by /uploads/<id>.
//     If the download fails the link is kept as written and the error is shown.
//  4. A link to this website's own picture is used as it is (a full address is cut to /uploads/<id>), never downloaded again.
//  5. The same limits and the same messages everywhere.

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// /uploads/<16 hex>, the old /uploads/YYYY/MM/<id>.webp form and a replaced picture's -<random> suffix, optionally with this site's address in front
export const UPLOAD_LINK = /^(?:https?:\/\/[^\s/]+)?(\/uploads\/(?:\d{4}\/\d{2}\/)?[0-9a-f]{16}(?:-[0-9a-f]{6,16})?(?:\.webp)?)$/i;
// a link that ends like a picture file
export const IMAGE_URL = /^https?:\/\/\S+\.(?:jpe?g|png|webp|gif|avif)(?:\?\S*)?$/i;

// a link to a photo on any website
export const isWebLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

// what a pasted line is: this website's picture (its /uploads/<id>), a picture on another website, or neither
export function classifyImageLink(line: string, own: string): { kind: "own"; path: string } | { kind: "external"; url: string } | null {
  const text = line.trim();
  const m = UPLOAD_LINK.exec(text);
  if (m) return { kind: "own", path: m[1] };
  try {
    const u = new URL(text);
    if (own && u.origin === own && u.pathname.startsWith("/uploads/")) return { kind: "own", path: u.pathname };
  } catch {
    return null;
  }
  return IMAGE_URL.test(text) || isWebLink(text) ? { kind: "external", url: text } : null;
}

// a picture file that can go to the server: the same checks (and words) as the server gives
export function checkImageFile(f: File): string | null {
  if (f.size === 0) return "Ảnh trống.";
  if (f.size > MAX_UPLOAD_BYTES) return `Ảnh quá lớn (tối đa ${MAX_UPLOAD_MB} MB).`;
  if (!f.type.startsWith("image/")) return "Chỉ nhận ảnh JPG, PNG, WebP, GIF hoặc AVIF.";
  return null;
}
