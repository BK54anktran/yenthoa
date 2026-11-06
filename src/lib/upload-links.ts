import crypto from "node:crypto";
import { exec, query } from "@/lib/db";

// One-time upload pages. An AI that cannot run commands and cannot attach a file asks for a link (tao_link_tai_anh); the person
// opens it in a browser and picks the photo there. The address is the only secret: it is random, it works for one upload, and it
// stops working after a few minutes. The database keeps only a hash of it, so a leaked backup cannot be used.
export const UPLOAD_LINK_MINUTES = 10;
export const MAX_UPLOAD_LINK_MINUTES = 30;
const PREFIX = "ytu_";

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
// "ytu_" and 32 characters of base64url: anything else is refused before the database is asked
export const isUploadToken = (s: string) => /^ytu_[A-Za-z0-9_-]{32}$/.test(s);

export type UploadLink = { keyName: string; imageName: string };

export async function createUploadLink(keyName: string, imageName: string, minutes = UPLOAD_LINK_MINUTES): Promise<{ token: string; minutes: number }> {
  const m = Math.min(Math.max(Math.round(minutes) || UPLOAD_LINK_MINUTES, 1), MAX_UPLOAD_LINK_MINUTES);
  const token = PREFIX + crypto.randomBytes(24).toString("base64url");
  await exec("DELETE FROM upload_links WHERE expires_at < NOW()");
  await exec("INSERT INTO upload_links (token_hash, key_name, image_name, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))", [hashToken(token), keyName.slice(0, 100), imageName.slice(0, 200), m]);
  return { token, minutes: m };
}

// is the address still good (opening the page does not use it up)
export async function peekUploadLink(token: string): Promise<UploadLink | null> {
  if (!isUploadToken(token)) return null;
  const [row] = await query<{ key_name: string; image_name: string }>("SELECT key_name, image_name FROM upload_links WHERE token_hash = ? AND expires_at > NOW()", [hashToken(token)]);
  return row ? { keyName: row.key_name, imageName: row.image_name } : null;
}

// takes the address for one upload; of two uploads at the same moment only one gets it (the DELETE reports who removed the row)
export async function claimUploadLink(token: string): Promise<(UploadLink & { restore: () => Promise<void> }) | null> {
  const link = await peekUploadLink(token);
  if (!link) return null;
  const hash = hashToken(token);
  const [row] = await query<{ left_s: number }>("SELECT GREATEST(TIMESTAMPDIFF(SECOND, NOW(), expires_at), 1) AS left_s FROM upload_links WHERE token_hash = ?", [hash]);
  const r = await exec("DELETE FROM upload_links WHERE token_hash = ? AND expires_at > NOW()", [hash]);
  if (r.affectedRows !== 1) return null;
  // a photo that was refused (not an image, too big) does not use the address up: the person can pick another file
  const left = row?.left_s ?? 60;
  return {
    ...link,
    restore: async () => {
      await exec("INSERT IGNORE INTO upload_links (token_hash, key_name, image_name, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))", [hash, link.keyName, link.imageName, left]);
    },
  };
}
