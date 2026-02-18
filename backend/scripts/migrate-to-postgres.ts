/**
 * Migration script: SQLite → PostgreSQL
 * Exports all data from local SQLite and imports into Railway PostgreSQL.
 *
 * Usage: POSTGRES_URL="postgresql://..." bun run scripts/migrate-to-postgres.ts
 */

import Database from "bun:sqlite";
import { join } from "path";

const SQLITE_PATH = join(import.meta.dir, "../prisma/dev.db");
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("ERROR: Set POSTGRES_URL environment variable to your Railway PostgreSQL connection string.");
  console.error('Usage: POSTGRES_URL="postgresql://user:pass@host:port/db" bun run scripts/migrate-to-postgres.ts');
  process.exit(1);
}

// Use pg directly for PostgreSQL (Prisma can't do raw multi-table inserts easily)
const { Client } = await import("pg") as any;

const pg = new Client({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sqlite = new Database(SQLITE_PATH, { readonly: true });

async function run() {
  await pg.connect();
  console.log("Connected to PostgreSQL");
  console.log("Reading from SQLite:", SQLITE_PATH);

  // Order matters for foreign keys: parents first, children after
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
    // Skip Session - users will create new sessions on login
  ];

  // Start transaction
  await pg.query("BEGIN");

  try {
    for (const table of tables) {
      const rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, any>[];
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skipped)`);
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(rows[0]);

      // Quote column names for PostgreSQL
      const quotedColumns = columns.map(c => `"${c}"`).join(", ");

      // Build parameterized insert
      let inserted = 0;
      const batchSize = 50;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: any[] = [];
        const valuePlaceholders: string[] = [];

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const rowPlaceholders: string[] = [];

          for (let k = 0; k < columns.length; k++) {
            const paramIndex = j * columns.length + k + 1;
            rowPlaceholders.push(`$${paramIndex}`);

            let val = row[columns[k]];

            // Convert SQLite integer booleans to JS booleans for PostgreSQL
            if (typeof val === "number" && (val === 0 || val === 1)) {
              // Check if this column is a boolean field
              const booleanFields = [
                "emailVerified", "used", "pinned", "generateDescriptions",
                "reformulateForCopyright", "convertToGrams",
                "is_vegetarian", "is_vegan", "is_gluten_free", "is_lactose_free",
                "is_halal", "is_low_carb", "is_low_fat", "is_high_protein",
                "is_mediterranean", "is_whole30", "is_low_sodium"
              ];
              if (booleanFields.includes(columns[k])) {
                val = val === 1;
              }
            }

            values.push(val);
          }

          valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
        }

        const query = `INSERT INTO "${table}" (${quotedColumns}) VALUES ${valuePlaceholders.join(", ")} ON CONFLICT DO NOTHING`;

        try {
          await pg.query(query, values);
          inserted += batch.length;
        } catch (err: any) {
          console.error(`  ERROR inserting into ${table} (batch ${i}-${i + batch.length}):`, err.message);
          // Try one by one for this batch to find the problematic row
          for (const row of batch) {
            const singleValues = columns.map(c => {
              let val = row[c];
              const booleanFields = [
                "emailVerified", "used", "pinned", "generateDescriptions",
                "reformulateForCopyright", "convertToGrams",
                "is_vegetarian", "is_vegan", "is_gluten_free", "is_lactose_free",
                "is_halal", "is_low_carb", "is_low_fat", "is_high_protein",
                "is_mediterranean", "is_whole30", "is_low_sodium"
              ];
              if (typeof val === "number" && (val === 0 || val === 1) && booleanFields.includes(c)) {
                val = val === 1;
              }
              return val;
            });
            const singlePlaceholders = columns.map((_, k) => `$${k + 1}`);
            const singleQuery = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${singlePlaceholders.join(", ")}) ON CONFLICT DO NOTHING`;
            try {
              await pg.query(singleQuery, singleValues);
              inserted++;
            } catch (rowErr: any) {
              console.error(`    Skipped row in ${table}:`, rowErr.message?.substring(0, 100));
            }
          }
        }
      }

      console.log(`  ${table}: ${inserted}/${rows.length} rows migrated`);
    }

    await pg.query("COMMIT");
    console.log("\nMigration complete!");

    // Verify counts
    console.log("\n--- Verification ---");
    for (const table of tables) {
      const sqliteCount = (sqlite.query(`SELECT COUNT(*) as c FROM "${table}"`).get() as any).c;
      const pgResult = await pg.query(`SELECT COUNT(*) as c FROM "${table}"`);
      const pgCount = parseInt(pgResult.rows[0].c);
      const match = sqliteCount === pgCount ? "OK" : `MISMATCH (SQLite: ${sqliteCount})`;
      console.log(`  ${table}: ${pgCount} rows ${match}`);
    }

  } catch (err) {
    await pg.query("ROLLBACK");
    console.error("Migration failed, rolled back:", err);
    process.exit(1);
  } finally {
    sqlite.close();
    await pg.end();
  }
}

run();
