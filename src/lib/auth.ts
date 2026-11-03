import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// Single admin account configured through environment variables (nothing is stored in the repo):
//   ADMIN_USER            default "admin"
//   ADMIN_PASSWORD_HASH   output of `npm run admin:hash -- "<password>"`
//   SESSION_SECRET        random string, at least 32 characters
// The session is an HMAC-signed httpOnly cookie. Every admin page AND every server action calls
// requireAdmin()/assertAdmin() itself: proxy.ts only does a cheap redirect.

export const COOKIE = "hp_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

const secret = () => {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return s;
};

export const authConfigured = () => !!process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET ?? "").length >= 32;

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

// stored hash format: "scrypt:<salt hex>:<hash hex>" (no "$": it gets expanded inside .env files)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split(":");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function checkCredentials(user: string, password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return false;
  const userOk = crypto.timingSafeEqual(
    crypto.createHash("sha256").update(user).digest(),
    crypto.createHash("sha256").update(process.env.ADMIN_USER ?? "admin").digest(),
  );
  const passOk = verifyPassword(password, hash); // always evaluated, so timing does not reveal the user name
  return userOk && passOk;
}

function makeToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function validToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number }).exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  if (!authConfigured()) return false;
  return validToken((await cookies()).get(COOKIE)?.value);
}

// for pages / layouts
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

// for server actions and route handlers: throws instead of redirecting
export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

export async function startSession(): Promise<void> {
  const h = await headers();
  const https = h.get("x-forwarded-proto") === "https" || process.env.COOKIE_SECURE === "true";
  (await cookies()).set(COOKIE, makeToken(), { httpOnly: true, sameSite: "lax", secure: https, path: "/", maxAge: MAX_AGE });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// --- login rate limit: 5 failures per 15 minutes per client address (in memory, per process)
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60 * 1000;

export async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}
export function tooManyAttempts(key: string): boolean {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW) return false;
  return a.n >= 5;
}
export function recordFailure(key: string): void {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW) attempts.set(key, { n: 1, first: Date.now() });
  else a.n++;
}
export function clearFailures(key: string): void {
  attempts.delete(key);
}
