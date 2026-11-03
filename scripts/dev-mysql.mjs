#!/usr/bin/env node
// Throw-away MySQL 8.4 for local development (no Docker needed). Data is lost when it stops.
//   npm run db:dev      then, in another terminal:  npm run db:seed && npm run dev
import { createDB } from "mysql-memory-server";

const PORT = 3307;
const db = await createDB({ version: "8.4.x", dbName: "yenthoa_db", port: PORT, logLevel: "ERROR" });
console.log(`MySQL ready. Put this in .env.local:\n\nDATABASE_URL=mysql://${db.username}@127.0.0.1:${db.port}/${db.dbName}\n`);
const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
