#!/usr/bin/env node
// Print the values for the admin login (put them in .env.local or the server environment):
//   npm run admin:hash -- "your password"
import crypto from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('usage: npm run admin:hash -- "<password, at least 10 characters>"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const value = `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
console.log(`ADMIN_USER=admin`);
console.log(`ADMIN_PASSWORD_HASH=${value}`);
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString("hex")}`);
