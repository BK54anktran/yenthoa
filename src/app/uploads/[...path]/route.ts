import fs from "node:fs/promises";
import { query } from "@/lib/db";
import { resolveUpload } from "@/lib/uploads";

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;

  // "/uploads/<id>": the stable address of a photo. It leads to the file the id points to now.
  if (parts.length === 1) {
    const id = parts[0].replace(/\.webp$/, "");  // also accepts <id>.webp
    if (!/^[0-9a-f]{16}$/.test(id)) return new Response("Not found", { status: 404 });
    try {
      const [row] = await query<{ file: string }>("SELECT file FROM media WHERE id = ?", [id]);
      if (!row) return new Response("Not found", { status: 404 });
      return new Response(null, { status: 307, headers: { location: `/uploads/${row.file}`, "cache-control": "public, max-age=60" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  const file = resolveUpload(parts);
  if (!file || !file.endsWith(".webp")) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable", // a file is never rewritten: a replaced photo gets a new file name
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
