import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("dev.db");
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  )
  .all();

for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
  console.log(`=== ${t.name} (${count.c} rows) ===`);
  console.log(cols.map((c) => `${c.name}:${c.type}`).join(", "));
}
