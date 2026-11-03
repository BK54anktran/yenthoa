// Chụp các đường dẫn ở cả hai cỡ: điện thoại 390x844 và desktop 1280x800 → $OUT/<tên>-390x844.png ...
// Đường dẫn bắt đầu bằng /admin thì tự đăng nhập trước. Ví dụ: node shot.mjs / /xe /admin
import fs from "node:fs";
import { createRequire } from "node:module";

// Playwright có sẵn ở máy cloud (cài global); ESM không đọc NODE_PATH nên nạp bằng require.
const { chromium } = createRequire(import.meta.url)("playwright");

const base = process.env.BASE || "http://127.0.0.1:3000";
const out = process.env.OUT || "/tmp/yenthoa/shots";
const pw = process.env.ADMIN_PW || "";
const paths = process.argv.slice(2);
const sizes = [[390, 844], [1280, 800]];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (paths.some((p) => p.startsWith("/admin"))) {
    await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="user"]', "admin");
    await page.fill('input[name="password"]', pw);
    await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }), page.click("button")]);
  }
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    const name = (p.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "home") + `-${w}x${h}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: true });
    console.log(`${out}/${name}`);
  }
  await ctx.close();
}
await browser.close();
