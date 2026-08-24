/**
 * Migration script: Transfer data from local SQLite (dev.db) to remote PostgreSQL (Supabase).
 *
 * Uses Node's built-in `node:sqlite` module (Node >= 22.5) - no extra dependencies.
 *
 * Usage: node --env-file=.env scripts/migrate-sqlite-to-pg.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'dev.db');

// Fallback minimal .env loader in case --env-file was not used
function loadEnvFallback() {
  if (process.env.POSTGRES_URL_NON_POOLING) return;
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}
loadEnvFallback();

const PG_URL = process.env.POSTGRES_URL_NON_POOLING;
if (!PG_URL) {
  console.error('ERROR: POSTGRES_URL_NON_POOLING environment variable is not set.');
  console.error('Run with: node --env-file=.env scripts/migrate-sqlite-to-pg.mjs');
  process.exit(1);
}

// Tables in dependency order (parents before children)
const TABLES = [
  'AppSettings',
  'User',
  'Reward',
  'Subject',
  'Topic',
  'Question',
  'Session',
  'Order',
  'CoinTransaction',
  'Attempt',
  'Mistake',
];

const CHUNK_SIZE = 100;

/**
 * Prisma stores DateTime in SQLite as TEXT like "2026-08-23 17:53:40.123 +00:00" (UTC).
 * Convert to a JS Date so node-postgres serializes it correctly for PostgreSQL.
 */
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let s = String(value).trim();
  // Normalize "YYYY-MM-DD HH:MM:SS[.sss][ +HH:MM]" -> ISO-ish
  s = s.replace(' ', 'T').replace(/\s*([+-]\d{2}:?\d{2})$/, '$1');
  let d = new Date(s);
  if (Number.isNaN(d.getTime())) d = new Date(`${s}Z`); // naive UTC fallback
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getBooleanColumns(pgClient, tableName) {
  const res = await pgClient.query(
    `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'boolean'`,
    [tableName]
  );
  return res.rows.map((r) => r.column_name);
}

async function migrateTable(sqlite, pgClient, tableName) {
  const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
  if (rows.length === 0) {
    console.log(`  SKIP ${tableName}: 0 rows`);
    return { migrated: 0, total: 0 };
  }

  const boolCols = new Set(await getBooleanColumns(pgClient, tableName));
  const dateCols = new Set(
    (await pgClient.query(
      `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1
               AND data_type IN ('timestamp without time zone', 'timestamp with time zone')`,
      [tableName]
    )).rows.map((r) => r.column_name)
  );

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');

  const convert = (row) =>
    columns.map((c) => {
      const raw = row[c];
      if (boolCols.has(c)) {
        if (raw === null || raw === undefined) return null;
        return raw === true || raw === 1 || raw === '1';
      }
      if (dateCols.has(c)) return toDate(raw);
      return raw ?? null;
    });

  let inserted = 0;
  const errors = [];

  async function insertChunk(chunkRows) {
    const placeholders = chunkRows
      .map((_, i) => `(${chunkRows[0].map((__, j) => `$${i * columns.length + j + 1}`).join(', ')})`)
      .join(', ');
    const sql = `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
    const values = chunkRows.flat();
    await pgClient.query(sql, values);
    inserted += chunkRows.length;
  }

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map(convert);
    try {
      await insertChunk(chunk);
    } catch (batchErr) {
      // Fall back to row-by-row to isolate problematic rows
      for (const values of chunk) {
        try {
          const sql = `INSERT INTO "${tableName}" (${colList}) VALUES (${columns
            .map((_, j) => `$${j + 1}`)
            .join(', ')}) ON CONFLICT DO NOTHING`;
          await pgClient.query(sql, values);
          inserted++;
        } catch (err) {
          errors.push({ err: err.message, values });
        }
      }
      if (errors.length && batchErr) {
        console.error(`  ! Batch insert issue in ${tableName}: ${batchErr.message}`);
      }
    }
  }

  for (const e of errors.slice(0, 5)) {
    console.error(`  X ${tableName}: ${e.err} | row: ${JSON.stringify(e.values).substring(0, 200)}`);
  }

  console.log(`  OK   ${tableName}: ${inserted}/${rows.length} rows migrated${errors.length ? ` (${errors.length} failed)` : ''}`);
  return { migrated: inserted, total: rows.length };
}

async function main() {
  console.log('SQLite -> PostgreSQL Migration');
  console.log(`   Source: ${DB_PATH}`);
  console.log(`   Target: ${PG_URL.replace(/:[^:@/]+@/, ':***@')}`);
  console.log('');

  const sqlite = new DatabaseSync(DB_PATH, { readOnly: true });
  const pgClient = new pg.Client({ connectionString: PG_URL });
  await pgClient.connect();
  console.log('Connected to PostgreSQL\n');

  let totalMigrated = 0;
  let totalRows = 0;
  const summary = [];

  for (const table of TABLES) {
    try {
      const { migrated, total } = await migrateTable(sqlite, pgClient, table);
      totalMigrated += migrated;
      totalRows += total;
      summary.push({ table, migrated, total });
    } catch (err) {
      console.error(`  FAILED ${table}:`, err.message);
      summary.push({ table, migrated: 0, total: -1, error: err.message });
    }
  }

  // Verification: compare row counts between SQLite and PostgreSQL
  console.log('\nVerification (SQLite vs PostgreSQL):');
  let allMatch = true;
  for (const { table } of summary) {
    const srcCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
    const dstRes = await pgClient.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    const dstCount = dstRes.rows[0].c;
    const match = srcCount === dstCount;
    if (!match) allMatch = false;
    console.log(`  ${match ? 'MATCH' : 'DIFF'} ${table}: sqlite=${srcCount} pg=${dstCount}`);
  }

  console.log(`\nDone. ${totalMigrated}/${totalRows} rows transferred.`);
  console.log(allMatch ? 'All table counts match.' : 'WARNING: some counts differ - review output above.');

  await pgClient.end();
  sqlite.close();
  process.exit(allMatch ? 0 : 2);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});