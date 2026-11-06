import mysql from "mysql2/promise";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { canonText, mapStrings, resolveText, type MediaMap } from "./media-ref.ts";
import { syncMediaFiles } from "./media-sync.ts";

// One pool per process (kept on globalThis so dev hot reloads don't open a new pool each time).
// Nothing here runs at import time, so `next build` works without a database.
const g = globalThis as unknown as { __hpPool?: Pool; __hpSchema?: Promise<void>; __hpMedia?: { map: MediaMap; at: number } };

type Conn = { uri: string } | { host: string; port: number; user: string; password: string; database: string };

// Connection settings from the environment. `DATABASE_URL=mysql://user:pass@host:3306/db` is used when it
// is a mysql:// URL. Managed hosts (Vibe Host) also set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
// (or the same names with a MYSQL_ prefix), which are used when DATABASE_URL is absent or in another format
// such as jdbc:mysql://...
export function connectionFromEnv(env: NodeJS.ProcessEnv = process.env): Conn | null {
  if (env.DATABASE_URL && /^mysql:\/\//i.test(env.DATABASE_URL)) return { uri: env.DATABASE_URL };
  const pick = (a: string, b: string) => env[a] || env[b];
  const host = pick("DB_HOST", "MYSQL_HOST");
  const database = pick("DB_NAME", "MYSQL_DATABASE");
  const user = pick("DB_USER", "MYSQL_USER");
  if (!host || !database || !user) return null;
  return { host, port: Number(pick("DB_PORT", "MYSQL_PORT")) || 3306, user, password: pick("DB_PASSWORD", "MYSQL_PASSWORD") ?? "", database };
}

export const hasDatabaseConfig = () => connectionFromEnv() !== null;

export function getPool(): Pool {
  if (!g.__hpPool) {
    const conn = connectionFromEnv();
    if (!conn) throw new Error("Database is not configured (set DATABASE_URL, or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)");
    g.__hpPool = mysql.createPool({
      ...conn,
      charset: "utf8mb4",
      connectionLimit: 8,
      waitForConnections: true,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
  }
  return g.__hpPool;
}

const T = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

// utf8mb4 everywhere: the posts contain emoji, which 3-byte "utf8" rejects.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(64) NOT NULL PRIMARY KEY,
    v JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(191) NOT NULL,
    title VARCHAR(300) NOT NULL,
    date DATE NOT NULL,
    section VARCHAR(40) NOT NULL DEFAULT 'tin-tuc',
    excerpt TEXT NOT NULL,
    img VARCHAR(500) NULL,
    html MEDIUMTEXT NOT NULL,
    published TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_posts_slug (slug),
    KEY ix_posts_list (published, date, id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(191) NOT NULL,
    code VARCHAR(40) NULL,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(60) NOT NULL DEFAULT '',
    types JSON NOT NULL,
    price BIGINT UNSIGNED NOT NULL DEFAULT 0,
    price_max BIGINT UNSIGNED NOT NULL DEFAULT 0,
    img VARCHAR(500) NULL,
    gallery JSON NOT NULL,
    colors JSON NOT NULL,
    variants JSON NULL,
    specs JSON NULL,
    short_html MEDIUMTEXT NOT NULL,
    html MEDIUMTEXT NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_products_slug (slug),
    KEY ix_products_list (active, name)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS media (
    id CHAR(16) NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL DEFAULT '',
    file VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_media_created (created_at, id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS hero_slides (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    eyebrow VARCHAR(200) NOT NULL DEFAULT '',
    title VARCHAR(200) NOT NULL,
    sub VARCHAR(300) NOT NULL DEFAULT '',
    img VARCHAR(500) NOT NULL,
    img_mobile VARCHAR(500) NULL,
    fit VARCHAR(10) NOT NULL DEFAULT 'cover',
    link VARCHAR(500) NULL,
    dim TINYINT(1) NOT NULL DEFAULT 1,
    sort INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    KEY ix_slides (active, sort)
  ) ${T}`,
  // keys that let an AI client (the MCP endpoint) work on the site; only a hash of the key is stored
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    UNIQUE KEY uq_api_keys_hash (key_hash)
  ) ${T}`,
  // one-time pages for putting a photo in the image library from a browser (the MCP tool tao_link_tai_anh); only a hash of the token is stored
  `CREATE TABLE IF NOT EXISTS upload_links (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL,
    image_name VARCHAR(200) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_upload_links_expires (expires_at)
  ) ${T}`,
];

async function ensureColumn(pool: Pool, table: string, column: string, ddl: string): Promise<void> {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );
  if (!(rows as { n: number }[])[0].n) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
}

// creates the tables on first use (idempotent), once per process
export function ensureSchema(): Promise<void> {
  if (!g.__hpSchema) {
    g.__hpSchema = (async () => {
      const pool = getPool();
      for (const sql of SCHEMA) await pool.query(sql);
      // databases created before a column existed get it on first use
      await ensureColumn(pool, "products", "code", "VARCHAR(40) NULL AFTER slug");
      // every product has a code: the ones without get SP + their number (SP0007), editable in the admin
      await pool.query("UPDATE products SET code = CONCAT('SP', LPAD(id, 4, '0')) WHERE code IS NULL OR code = ''");
      await ensureColumn(pool, "products", "variants", "JSON NULL AFTER colors");
      await ensureColumn(pool, "products", "specs", "JSON NULL AFTER variants");
      await ensureColumn(pool, "hero_slides", "link", "VARCHAR(500) NULL AFTER img");
      await ensureColumn(pool, "hero_slides", "img_mobile", "VARCHAR(500) NULL AFTER img");
      await ensureColumn(pool, "hero_slides", "fit", "VARCHAR(10) NOT NULL DEFAULT 'cover' AFTER img_mobile");
      await ensureColumn(pool, "hero_slides", "dim", "TINYINT(1) NOT NULL DEFAULT 1 AFTER link");
      await ensureColumn(pool, "api_keys", "active", "TINYINT(1) NOT NULL DEFAULT 1 AFTER key_hash");
      await syncMediaFiles(pool).catch((e) => console.error("syncMediaFiles:", e instanceof Error ? e.message : e));
    })().catch((e) => {
      g.__hpSchema = undefined; // retry on the next request
      throw e;
    });
  }
  return g.__hpSchema;
}

// id -> file of every photo, kept for a minute (and dropped at once when a photo is added, replaced or deleted)
export const invalidateMedia = () => {
  g.__hpMedia = undefined;
};
async function mediaMap(): Promise<MediaMap> {
  if (g.__hpMedia && Date.now() - g.__hpMedia.at < 60_000) return g.__hpMedia.map;
  const load = async () => (await getPool().query("SELECT id, file FROM media"))[0] as { id: string; file: string }[];
  let rows: { id: string; file: string }[] = [];
  try {
    try {
      rows = await load();
    } catch (e) {
      // a server that started before the table existed (hot reload keeps its "schema done" flag): create what is missing and retry
      if ((e as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw e;
      g.__hpSchema = undefined;
      await ensureSchema();
      rows = await load();
    }
  } catch (e) {
    // never take the pages down for this: they just show the stored addresses as they are
    console.error("media map unavailable:", e instanceof Error ? e.message : e);
    return new Map();
  }
  const map: MediaMap = new Map(rows.map((r) => [r.id, r.file]));
  g.__hpMedia = { map, at: Date.now() };
  return map;
}

// reads give the address of the file a photo id points to now; writes store the id only (see media-ref.ts)
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const [rows] = await getPool().query(sql, params.map((p) => (typeof p === "string" ? canonText(p) : p)));
  const map = await mediaMap();
  return (map.size ? mapStrings(rows, (s) => resolveText(s, map)) : rows) as T[];
}

const canonParams = (params: unknown[]) => params.map((p) => (typeof p === "string" ? canonText(p) : p));

export async function exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  await ensureSchema();
  const [res] = await getPool().query(sql, canonParams(params));
  return res as ResultSetHeader;
}

// runs fn on one connection inside a transaction
export async function transaction<T>(fn: (run: (sql: string, params?: unknown[]) => Promise<ResultSetHeader>) => Promise<T>): Promise<T> {
  await ensureSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(async (sql, params = []) => (await conn.query(sql, canonParams(params)))[0] as ResultSetHeader);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
