import crypto from "node:crypto";
import { exec, query } from "@/lib/db";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/auth";

// Keys for the MCP endpoint. A key looks like "ytk_<43 random characters>". It is shown in full once, when it is made;
// the database keeps only its SHA-256 hash and its first characters (to tell keys apart in the list).
const PREFIX = "ytk_";
export const hashKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex");

export type ApiKeyRow = { id: number; name: string; key_prefix: string; active: number; created_at: string; last_used_at: string | null };

export async function createApiKey(name: string): Promise<{ id: number; key: string }> {
  const key = PREFIX + crypto.randomBytes(32).toString("base64url");
  const r = await exec("INSERT INTO api_keys (name, key_prefix, key_hash) VALUES (?, ?, ?)", [name, key.slice(0, 8), hashKey(key)]);
  return { id: r.insertId, key };
}

export const listApiKeys = () => query<ApiKeyRow>("SELECT id, name, key_prefix, active, created_at, last_used_at FROM api_keys ORDER BY id DESC");

// deleting a key stops it working at once
export async function deleteApiKey(id: number): Promise<boolean> {
  return (await exec("DELETE FROM api_keys WHERE id = ?", [id])).affectedRows > 0;
}

// turns a key off or on without deleting it (a key that is off is refused like a deleted one, until it is turned on again)
export async function toggleApiKey(id: number): Promise<boolean> {
  return (await exec("UPDATE api_keys SET active = 1 - active WHERE id = ?", [id])).affectedRows > 0;
}

// the key sent by a client -> which key it is. Wrong keys are counted per client address (same limit as the admin login);
// a key that exists but is switched off is not a guess, so it is refused without counting against the address.
export type KeyCheck = { ok: true; id: number; name: string } | { ok: false; reason: "wrong" | "off" };
export async function verifyApiKey(key: string, client: string): Promise<KeyCheck> {
  if (tooManyAttempts(`key:${client}`)) return { ok: false, reason: "wrong" };
  const hash = hashKey(key);
  const [row] = key.startsWith(PREFIX) && key.length <= 200 ? await query<{ id: number; name: string; key_hash: string; active: number }>("SELECT id, name, key_hash, active FROM api_keys WHERE key_hash = ?", [hash]) : [];
  const found = !!row && row.key_hash.length === hash.length && crypto.timingSafeEqual(Buffer.from(row.key_hash), Buffer.from(hash));
  if (!found) {
    recordFailure(`key:${client}`);
    return { ok: false, reason: "wrong" };
  }
  if (!row.active) return { ok: false, reason: "off" };
  clearFailures(`key:${client}`);
  await exec("UPDATE api_keys SET last_used_at = NOW() WHERE id = ?", [row.id]);
  return { ok: true, id: row.id, name: row.name };
}

export const tooManyKeyAttempts = (client: string) => tooManyAttempts(`key:${client}`);
