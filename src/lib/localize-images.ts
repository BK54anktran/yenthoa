import { addImage } from "@/lib/media";
import { fetchImage } from "@/lib/import-image";
import { UPLOAD_LINK } from "@/lib/image-rules";

// Photos that live on another website are downloaded into the image manager and the link becomes /uploads/<id>,
// the same as the admin's HTML field and image boxes do when you paste such a link by hand.
// A photo that cannot be downloaded keeps its link and is reported, never silently dropped.
// one save can pull this many photos at most, so a single call cannot keep the server busy for minutes
const MAX_PER_CALL = 30;
const EXTERNAL_IMG = /(<img\b[^>]*?\ssrc\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi;

export type Localizer = {
  html: (v: string) => Promise<string>; // every <img src="https://..."> inside an HTML text
  url: (v: string) => Promise<string>; // one image link (cover, gallery, a variant's photo)
  imported: () => number;
  failed: () => string[];
};

export function makeLocalizer(): Localizer {
  const done = new Map<string, string>(); // external address -> /uploads/<id>, so one photo used twice is fetched once
  const failed: string[] = [];
  const one = async (raw: string): Promise<string> => {
    const url = raw.trim();
    const own = UPLOAD_LINK.exec(url)?.[1];
    if (own) return own; // a full link to a photo already on this site
    if (!/^https?:\/\//i.test(url)) return raw; // a path of our own, or empty
    const known = done.get(url);
    if (known) return known;
    if (done.size + failed.length >= MAX_PER_CALL) {
      failed.push(`${url.length > 80 ? `${url.slice(0, 77)}...` : url}: vượt giới hạn ${MAX_PER_CALL} ảnh mỗi lần lưu, hãy lưu tiếp lần nữa`);
      return raw;
    }
    try {
      const { data, name } = await fetchImage(url.slice(0, 2000));
      const local = await addImage(data, name);
      done.set(url, local);
      return local;
    } catch (e) {
      failed.push(`${url.length > 80 ? `${url.slice(0, 77)}...` : url}: ${e instanceof Error ? e.message : "không tải được"}`);
      return raw;
    }
  };
  return {
    url: one,
    html: async (v) => {
      const urls = [...new Set([...v.matchAll(EXTERNAL_IMG)].map((m) => m[3]))];
      let out = v;
      for (const u of urls) {
        const local = await one(u);
        if (local !== u) out = out.split(u).join(local);
      }
      return out;
    },
    imported: () => done.size,
    failed: () => failed,
  };
}
