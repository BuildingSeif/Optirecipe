/**
 * Migration script: SQLite → PostgreSQL
 * Handles SQLite Unix-millisecond timestamps → PostgreSQL timestamp conversion.
 * Handles SQLite 0/1 → PostgreSQL boolean conversion.
 *
 * Usage: POSTGRES_URL="postgresql://..." bun run scripts/migrate-to-postgres.ts
 */

import Database from "bun:sqlite";
import { join } from "path";

const SQLITE_PATH = join(import.meta.dir, "../prisma/dev.db");
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("ERROR: Set POSTGRES_URL environment variable.");
  process.exit(1);
}

const { Client } = await import("pg") as any;
const pg = new Client({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sqlite = new Database(SQLITE_PATH, { readonly: true });

// All timestamp columns per table
const TIMESTAMP_COLUMNS: Record<string, Set<string>> = {
  User: new Set(["createdAt", "updatedAt"]),
  Account: new Set(["createdAt", "updatedAt", "accessTokenExpiresAt", "refreshTokenExpiresAt"]),
  Session: new Set(["createdAt", "updatedAt", "expiresAt"]),
  Verification: new Set(["createdAt", "updatedAt", "expiresAt"]),
  OtpCode: new Set(["createdAt", "expiresAt"]),
  Category: new Set(["createdAt"]),
  SubCategory: new Set(["createdAt"]),
  Country: new Set(["createdAt"]),
  Region: new Set(["createdAt"]),
  Cookbook: new Set(["createdAt", "updatedAt"]),
  ProcessingJob: new Set(["createdAt", "startedAt", "completedAt"]),
  Recipe: new Set(["createdAt", "updatedAt", "reviewedAt"]),
  NonRecipeContent: new Set(["createdAt"]),
  IngredientConversion: new Set(["createdAt"]),
  IngredientImage: new Set(["createdAt"]),
  ExportHistory: new Set(["createdAt"]),
};

const BOOLEAN_COLUMNS = new Set([
  "emailVerified", "used", "pinned", "generateDescriptions",
  "reformulateForCopyright", "convertToGrams",
  "is_vegetarian", "is_vegan", "is_gluten_free", "is_lactose_free",
  "is_halal", "is_low_carb", "is_low_fat", "is_high_protein",
  "is_mediterranean", "is_whole30", "is_low_sodium"
]);

function convertValue(table: string, column: string, val: any): any {
  if (val === null || val === undefined) return null;

  // Convert Unix millisecond timestamps to ISO date strings
  const tsColumns = TIMESTAMP_COLUMNS[table];
  if (tsColumns?.has(column)) {
    if (typeof val === "number") {
      // Unix milliseconds
      return new Date(val).toISOString();
    }
    if (typeof val === "string" && /^\d{10,13}$/.test(val)) {
      const ms = val.length <= 10 ? parseInt(val) * 1000 : parseInt(val);
      return new Date(ms).toISOString();
    }
    // Already a date string, return as-is
    return val;
  }

  // Convert SQLite 0/1 booleans
  if (BOOLEAN_COLUMNS.has(column) && typeof val === "number") {
    return val === 1;
  }

  return val;
}

async function run() {
  await pg.connect();
  console.log("Connected to PostgreSQL");
  console.log("Reading from SQLite:", SQLITE_PATH);

  const tables = [
    "User",
    "Account",
    "Verification",
    "Category",
    "Country",
    "SubCategory",
    "Region",
    "Cookbook",
    "ProcessingJob",
    "Recipe",
    "NonRecipeContent",
    "IngredientConversion",
    "IngredientImage",
    "ExportHistory",
    "OtpCode",
  ];

  let totalMigrated = 0;
  let totalFailed = 0;

  for (const table of tables) {
    const rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, any>[];
    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows (skipped)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const quotedColumns = columns.map(c => `"${c}"`).join(", ");
    let inserted = 0;
    let failed = 0;

    for (const row of rows) {
      const values = columns.map(c => convertValue(table, c, row[c]));
      const placeholders = columns.map((_, k) => `$${k + 1}`).join(", ");
      const query = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      try {
        await pg.query(query, values);
        inserted++;
      } catch (err: any) {
        failed++;
        if (failed <= 3) {
          console.error(`    Error in ${table} (${row.id || "?"}):`, err.message?.substring(0, 150));
        }
      }
    }

    console.log(`  ${table}: ${inserted} migrated, ${failed} failed (of ${rows.length})`);
    totalMigrated += inserted;
    totalFailed += failed;
  }

  console.log(`\nTotal: ${totalMigrated} rows migrated, ${totalFailed} failed`);

  // Verify
  console.log("\n--- Verification ---");
  for (const table of tables) {
    const sqliteCount = (sqlite.query(`SELECT COUNT(*) as c FROM "${table}"`).get() as any).c;
    try {
      const pgResult = await pg.query(`SELECT COUNT(*) as c FROM "${table}"`);
      const pgCount = parseInt(pgResult.rows[0].c);
      const status = pgCount >= sqliteCount ? "OK" : `MISSING ${sqliteCount - pgCount}`;
      console.log(`  ${table}: SQLite=${sqliteCount} PostgreSQL=${pgCount} ${status}`);
    } catch {
      console.log(`  ${table}: SQLite=${sqliteCount} PostgreSQL=ERROR`);
    }
  }

  sqlite.close();
  await pg.end();
  console.log("\nDone!");
}

run();
