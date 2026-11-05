import fs from "node:fs/promises";
import path from "node:path";
import { exec, getPool, invalidateMedia, query } from "./db.ts";
import { idsIn } from "./media-ref.ts";
import { syncMediaFiles } from "./media-sync.ts";
import { storeImage, uploadDir, UPLOAD_URL } from "./uploads.ts";

// The image manager. A photo is a row in `media` (id, name, current file); pages refer to it by id (see media-ref.ts).
export type MediaItem = { id: string; name: string; file: string; url: string; size: number; time: number };
export type MediaPlace = { label: string; href: string };

export const isMediaId = (s: string) => /^[0-9a-f]{16}$/.test(s);
export const refOf = (id: string) => `${UPLOAD_URL}/${id}`; // what other places store: the id only
const fileOf = (rel: string) => path.join(uploadDir(), ...rel.split("/"));

export async function listMedia(): Promise<MediaItem[]> {
  await syncMediaFiles(getPool());
  const rows = await query<{ id: string; name: string; file: string }>("SELECT id, name, file FROM media");
  const out: MediaItem[] = [];
  for (const r of rows) {
    const st = await fs.stat(fileOf(r.file)).catch(() => null);
    if (st) out.push({ id: r.id, name: r.name || r.id, file: r.file, url: `${UPLOAD_URL}/${r.file}`, size: st.size, time: st.mtimeMs });
  }
  return out.sort((a, b) => b.time - a.time);
}

// where each photo is called from: id -> distinct places (a page that uses it twice still counts once).
// Reads the raw stored text, because that is where the ids are.
export async function findUsage(): Promise<Map<string, MediaPlace[]>> {
  const usage = new Map<string, MediaPlace[]>();
  const pool = getPool();
  const rows = async <T>(sql: string) => (await pool.query(sql))[0] as T[];
  const add = (place: MediaPlace, ...texts: unknown[]) => {
    const seen = new Set<string>();
    for (const t of texts) for (const id of idsIn(typeof t === "string" ? t : JSON.stringify(t ?? ""))) seen.add(id);
    for (const id of seen) usage.set(id, [...(usage.get(id) ?? []), place]);
  };

  for (const r of await rows<{ id: number; title: string; img: string | null; html: string }>("SELECT id, title, img, html FROM posts")) {
    add({ label: `Bài viết: ${r.title}`, href: `/admin/bai-viet/${r.id}` }, r.img, r.html);
  }
  for (const r of await rows<{ id: number; name: string; img: string | null; gallery: unknown; variants: unknown; short_html: string; html: string }>("SELECT id, name, img, gallery, variants, short_html, html FROM products")) {
    add({ label: `Xe: ${r.name}`, href: `/admin/san-pham/${r.id}` }, r.img, r.gallery, r.variants, r.short_html, r.html);
  }
  for (const r of await rows<{ title: string; img: string; img_mobile: string | null }>("SELECT title, img, img_mobile FROM hero_slides")) add({ label: `Banner đầu trang${r.title ? `: ${r.title}` : ""}`, href: "/admin/trang-chu" }, r.img, r.img_mobile);
  for (const r of await rows<{ k: string; v: unknown }>("SELECT k, v FROM settings")) {
    if (r.k === "shop") add({ label: "Thông tin cửa hàng", href: "/admin/cai-dat" }, r.v);
    else if (r.k === "home_sections") {
      for (const s of (Array.isArray(r.v) ? r.v : []) as { name?: string }[]) add({ label: `Trang chủ: ${s.name ?? "mục"}`, href: "/admin/trang-chu" }, s);
    } else if (r.k === "templates") {
      for (const t of (Array.isArray(r.v) ? r.v : []) as { id?: string; name?: string }[]) add({ label: `Mẫu: ${t.name ?? t.id}`, href: `/admin/mau/${t.id}` }, t);
    } else if (r.k === "collections") {
      for (const c of (Array.isArray(r.v) ? r.v : []) as { id?: string; name?: string }[]) add({ label: `Bộ sưu tập: ${c.name ?? c.id}`, href: `/admin/bo-suu-tap/${c.id}` }, c);
    }
  }
  return usage;
}

const baseName = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/\s+/g, " ").trim().slice(0, 200);

// a new photo: the file, its row, and the reference other places should store
export async function addImage(input: Buffer, fileName: string): Promise<string> {
  const { id, rel } = await storeImage(input);
  await exec("INSERT INTO media (id, name, file) VALUES (?, ?, ?)", [id, baseName(fileName) || id, rel]);
  invalidateMedia();
  return refOf(id);
}

// the same id now shows a different picture: new file, row updated, old file removed. Pages need no change.
export async function replaceImage(id: string, input: Buffer): Promise<void> {
  const [row] = await query<{ file: string }>("SELECT file FROM media WHERE id = ?", [id]);
  if (!row) throw new Error("Không tìm thấy ảnh này.");
  const { rel } = await storeImage(input, id);
  await exec("UPDATE media SET file = ? WHERE id = ?", [rel, id]);
  invalidateMedia();
  await fs.rm(fileOf(row.file), { force: true });
}

export async function renameImage(id: string, name: string): Promise<void> {
  await exec("UPDATE media SET name = ? WHERE id = ?", [name.trim().slice(0, 200), id]);
}

export async function deleteImage(id: string): Promise<void> {
  const [row] = await query<{ file: string }>("SELECT file FROM media WHERE id = ?", [id]);
  if (!row) return;
  await exec("DELETE FROM media WHERE id = ?", [id]);
  invalidateMedia();
  await fs.rm(fileOf(row.file), { force: true });
}
