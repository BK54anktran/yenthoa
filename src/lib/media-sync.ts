import fs from "node:fs/promises";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import { uploadDir } from "./uploads.ts";

// Makes sure every photo file in the upload folder has a row in `media` (id = the file name without .webp).
// Photos that were uploaded before the media table existed are registered here, once; running it again does nothing.
export async function syncMediaFiles(pool: Pool): Promise<void> {
  const root = uploadDir();
  const subdirs = async (p: string) => (await fs.readdir(p, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
  const rows: [string, string, string][] = [];
  for (const y of await subdirs(root)) {
    for (const m of await subdirs(path.join(root, y))) {
      for (const f of await fs.readdir(path.join(root, y, m), { withFileTypes: true }).catch(() => [])) {
        const mm = /^([0-9a-f]{16})(?:-[0-9a-f]{6,16})?\.webp$/.exec(f.name);
        if (f.isFile() && mm) rows.push([mm[1], mm[1], `${y}/${m}/${f.name}`]);
      }
    }
  }
  if (rows.length) await pool.query("INSERT IGNORE INTO media (id, name, file) VALUES ?", [rows]);
}
