#!/usr/bin/env node
// Load src/content (posts, products) and the shop defaults into MySQL.
//   npm run db:seed            only adds what is missing (safe to re-run)
//   npm run db:seed -- --force overwrite rows with the same slug and reset the banners
import fs from "node:fs";
import path from "node:path";

// Windows editors/PowerShell often save .env.local as UTF-16 or UTF-8 with a BOM, which Node's own
// --env-file parser cannot read. Read it here ourselves so the seed still works, and say what is wrong.
const envFile = path.resolve(".env.local");
function loadEnvFile() {
  if (!fs.existsSync(envFile)) return { found: false };
  const buf = fs.readFileSync(envFile);
  let enc = "utf8";
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    enc = "UTF-16 (PowerShell '>' / echo)";
    text = buf.toString("utf16le");
  } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    enc = "UTF-8 with BOM";
    text = buf.toString("utf8");
  } else {
    text = buf.toString("utf8");
  }
  text = text.replace(/^﻿/, "");
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    keys.push(m[1]);
    process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return { found: true, enc, keys };
}
const env = loadEnvFile();

const { connectionFromEnv, getPool } = await import("../src/lib/db.ts");
if (!connectionFromEnv()) {
  console.error("\nKhông tìm thấy cấu hình database.");
  if (!env.found) {
    console.error(`- Không có file ${envFile}`);
    console.error("  Tạo file tên đúng là .env.local (không có đuôi .txt) trong thư mục này, nội dung một dòng:");
    console.error("  DATABASE_URL=mysql://root:MAT_KHAU@127.0.0.1:3306/xemay_hungphat_db");
    console.error("  (Trong File Explorer, bật 'File name extensions' để chắc file không bị thành .env.local.txt)");
  } else {
    console.error(`- Đã đọc ${envFile} (mã hoá: ${env.enc}). Các biến tìm thấy: ${env.keys.join(", ") || "(không có)"}`);
    console.error("  Cần DATABASE_URL=mysql://USER:MATKHAU@127.0.0.1:3306/xemay_hungphat_db, hoặc DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.");
  }
  process.exit(1);
}
if (env.found && env.enc !== "utf8") {
  console.warn(`Lưu ý: .env.local đang lưu dạng ${env.enc}. Script này đọc được, nhưng "npm run dev" thì không. Hãy lưu lại bằng UTF-8 (không BOM).`);
}

const { seedAll } = await import("../src/lib/seed.ts");
const force = process.argv.includes("--force");
let failed = false;
try {
  const r = await seedAll({ force });
  console.log(`seed ${force ? "(force) " : ""}done:`, JSON.stringify(r));
} catch (e) {
  failed = true;
  const code = e?.code;
  console.error("\nSeed thất bại:", e?.message ?? e);
  if (code === "ECONNREFUSED") console.error("-> MySQL chưa chạy hoặc sai cổng/host trong DATABASE_URL.");
  if (code === "ER_ACCESS_DENIED_ERROR") console.error("-> Sai user hoặc mật khẩu. Mật khẩu có @ : / # thì phải mã hoá trong URL (@ thành %40).");
  if (code === "ER_BAD_DB_ERROR") console.error("-> Database chưa tồn tại. Tạo trước: CREATE DATABASE xemay_hungphat_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
} finally {
  try {
    await getPool().end();
  } catch {
    /* pool was never opened */
  }
}
if (failed) process.exit(1);
