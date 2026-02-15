/**
 * Seed script for importing SQLite export data into PostgreSQL (or SQLite).
 *
 * Usage:
 *   bun run prisma/seed.ts
 *   bun run prisma/seed.ts /path/to/custom/data-dir
 *
 * Reads JSON export files and inserts them in the correct foreign-key order.
 * On PostgreSQL: uses createMany with skipDuplicates (safe to re-run).
 * On SQLite: uses individual upserts (safe to re-run).
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const IS_POSTGRES = DATABASE_URL.startsWith("postgres");

/** Directory that contains the export_*.json files */
const DATA_DIR = process.argv[2]
  ? resolve(process.argv[2])
  : join(import.meta.dir, "seed-data");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(filename: string): T[] {
  const filepath = join(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    console.log(`  [SKIP] ${filename} not found`);
    return [];
  }
  const raw = readFileSync(filepath, "utf-8").trim();
  if (!raw || raw.length === 0) {
    console.log(`  [SKIP] ${filename} is empty`);
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.log(`  [SKIP] ${filename} is not an array`);
      return [];
    }
    return parsed as T[];
  } catch {
    console.log(`  [SKIP] ${filename} failed to parse`);
    return [];
  }
}

/**
 * SQLite stores booleans as 0/1 integers and timestamps as epoch milliseconds.
 * Convert them to proper JS types for Prisma.
 */
function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (typeof value === "number") return new Date(value);
  return new Date();
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return toDate(value);
}

/**
 * Batch insert helper that works on both PostgreSQL and SQLite.
 * - PostgreSQL: createMany with skipDuplicates
 * - SQLite: individual upserts (createMany doesn't support skipDuplicates)
 *
 * @param modelDelegate - e.g. prisma.user
 * @param data - array of records to insert
 * @param idField - the primary key field name (default: "id")
 */
async function bulkInsert<T extends Record<string, unknown>>(
  modelDelegate: {
    createMany?: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
    upsert: (args: { where: Record<string, unknown>; create: T; update: Record<string, never> }) => Promise<unknown>;
  },
  data: T[],
  idField: string = "id"
): Promise<number> {
  if (data.length === 0) return 0;

  if (IS_POSTGRES) {
    // PostgreSQL supports skipDuplicates
    const result = await (modelDelegate as any).createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  // SQLite fallback: individual upserts with empty update (insert-only semantics)
  let inserted = 0;
  for (const row of data) {
    try {
      await (modelDelegate as any).upsert({
        where: { [idField]: row[idField] },
        create: row,
        update: {}, // no-op update = skip duplicates
      });
      inserted++;
    } catch (err: unknown) {
      // Unique constraint violations on non-id fields: skip
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") || msg.includes("UNIQUE constraint")) {
        // Already exists, skip
      } else {
        throw err;
      }
    }
  }
  return inserted;
}

/**
 * Batch insert for large datasets (splits into chunks first).
 */
async function bulkInsertBatched<T extends Record<string, unknown>>(
  modelDelegate: {
    createMany?: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
    upsert: (args: { where: Record<string, unknown>; create: T; update: Record<string, never> }) => Promise<unknown>;
  },
  data: T[],
  batchSize: number = 500,
  idField: string = "id"
): Promise<number> {
  let total = 0;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const count = await bulkInsert(modelDelegate, batch, idField);
    total += count;
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(data.length / batchSize);
    if (totalBatches > 1) {
      console.log(`    Batch ${batchNum}/${totalBatches}: ${count} rows`);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Type definitions matching the JSON export shapes
// ---------------------------------------------------------------------------

interface RawUser {
  id: string;
  name: string;
  email: string;
  emailVerified: number | boolean;
  image: string | null;
  role: string;
  createdAt: number | string;
  updatedAt: number | string;
}

interface RawAccount {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: number | string | null;
  refreshTokenExpiresAt: number | string | null;
  scope: string | null;
  password: string | null;
  createdAt: number | string;
  updatedAt: number | string;
}

interface RawCategory {
  id: string;
  name: string;
  order: number;
  createdAt: number | string;
}

interface RawSubCategory {
  id: string;
  name: string;
  categoryId: string;
  order: number;
  createdAt: number | string;
}

interface RawCountry {
  id: string;
  name: string;
  code: string;
  order: number;
  createdAt: number | string;
}

interface RawRegion {
  id: string;
  name: string;
  countryId: string;
  order: number;
  createdAt: number | string;
}

interface RawCookbook {
  id: string;
  userId: string;
  name: string;
  filePath: string;
  fileUrl: string | null;
  fileSize: number | null;
  totalPages: number | null;
  status: string;
  processedPages: number;
  totalRecipesFound: number;
  errorMessage: string | null;
  pinned: number | boolean;
  generateDescriptions: number | boolean;
  reformulateForCopyright: number | boolean;
  convertToGrams: number | boolean;
  type: string;
  createdAt: number | string;
  updatedAt: number | string;
}

interface RawRecipe {
  id: string;
  cookbookId: string | null;
  userId: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  sourcePage: number | null;
  sourceType: string;
  category: string | null;
  subCategory: string | null;
  ingredients: string;
  instructions: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  difficulty: string | null;
  type: string;
  is_vegetarian: number | boolean;
  is_vegan: number | boolean;
  is_gluten_free: number | boolean;
  is_lactose_free: number | boolean;
  is_halal: number | boolean;
  is_low_carb: number | boolean;
  is_low_fat: number | boolean;
  is_high_protein: number | boolean;
  is_mediterranean: number | boolean;
  is_whole30: number | boolean;
  is_low_sodium: number | boolean;
  calories: number | null;
  proteins: number | null;
  carbs: number | null;
  fats: number | null;
  region: string | null;
  country: string;
  season: string | null;
  dietTags: string;
  mealType: string | null;
  tips: string | null;
  imageUrl: string | null;
  estimatedCostPerServing: number | null;
  status: string;
  reviewNotes: string | null;
  reviewedById: string | null;
  reviewedAt: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
}

interface RawIngredientImage {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number | string;
}

interface RawIngredientConversion {
  id: string;
  ingredientName: string;
  standardUnitWeightGrams: number;
  unitName: string;
  notes: string | null;
  createdAt: number | string;
}

// ---------------------------------------------------------------------------
// Seed functions (one per table, in foreign-key order)
// ---------------------------------------------------------------------------

async function seedUsers() {
  const raw = readJson<RawUser>("export_users.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} users...`);
  const data = raw.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: toBool(u.emailVerified),
    image: u.image,
    role: u.role,
    createdAt: toDate(u.createdAt),
    updatedAt: toDate(u.updatedAt),
  }));

  const count = await bulkInsert(prisma.user as any, data);
  console.log(`  -> Inserted ${count} users`);
}

/**
 * Some cookbooks/recipes reference userIds not present in the users export.
 * Create stub User rows so foreign keys are satisfied.
 */
async function seedMissingUsers() {
  const cookbooks = readJson<RawCookbook>("export_cookbooks.json");
  const recipes = readJson<RawRecipe>("export_recipes.json");

  const referencedIds = new Set<string>();
  for (const cb of cookbooks) referencedIds.add(cb.userId);
  for (const r of recipes) referencedIds.add(r.userId);

  // Check which ones already exist
  const existingUsers = await prisma.user.findMany({
    select: { id: true },
  });
  const existingIds = new Set(existingUsers.map((u) => u.id));

  const missingIds = [...referencedIds].filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return;

  console.log(`  Creating ${missingIds.length} stub users for missing references...`);
  const stubs = missingIds.map((id) => ({
    id,
    name: `Imported User (${id.substring(0, 8)})`,
    email: `imported-${id.substring(0, 8)}@placeholder.local`,
    emailVerified: false,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const count = await bulkInsert(prisma.user as any, stubs);
  console.log(`  -> Inserted ${count} stub users`);
}

async function seedAccounts() {
  const raw = readJson<RawAccount>("export_accounts.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} accounts...`);
  const data = raw.map((a) => ({
    id: a.id,
    accountId: a.accountId,
    providerId: a.providerId,
    userId: a.userId,
    accessToken: a.accessToken,
    refreshToken: a.refreshToken,
    idToken: a.idToken,
    accessTokenExpiresAt: toDateOrNull(a.accessTokenExpiresAt),
    refreshTokenExpiresAt: toDateOrNull(a.refreshTokenExpiresAt),
    scope: a.scope,
    password: a.password,
    createdAt: toDate(a.createdAt),
    updatedAt: toDate(a.updatedAt),
  }));

  const count = await bulkInsert(prisma.account as any, data);
  console.log(`  -> Inserted ${count} accounts`);
}

async function seedCategories() {
  const raw = readJson<RawCategory>("export_categories.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} categories...`);
  const data = raw.map((c) => ({
    id: c.id,
    name: c.name,
    order: c.order,
    createdAt: toDate(c.createdAt),
  }));

  const count = await bulkInsert(prisma.category as any, data);
  console.log(`  -> Inserted ${count} categories`);
}

async function seedSubCategories() {
  const raw = readJson<RawSubCategory>("export_subcategories.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} subcategories...`);
  const data = raw.map((sc) => ({
    id: sc.id,
    name: sc.name,
    categoryId: sc.categoryId,
    order: sc.order,
    createdAt: toDate(sc.createdAt),
  }));

  const count = await bulkInsert(prisma.subCategory as any, data);
  console.log(`  -> Inserted ${count} subcategories`);
}

async function seedCountries() {
  const raw = readJson<RawCountry>("export_countries.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} countries...`);
  const data = raw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    order: c.order,
    createdAt: toDate(c.createdAt),
  }));

  const count = await bulkInsert(prisma.country as any, data);
  console.log(`  -> Inserted ${count} countries`);
}

async function seedRegions() {
  const raw = readJson<RawRegion>("export_regions.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} regions...`);
  const data = raw.map((r) => ({
    id: r.id,
    name: r.name,
    countryId: r.countryId,
    order: r.order,
    createdAt: toDate(r.createdAt),
  }));

  const count = await bulkInsert(prisma.region as any, data);
  console.log(`  -> Inserted ${count} regions`);
}

async function seedCookbooks() {
  const raw = readJson<RawCookbook>("export_cookbooks.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} cookbooks...`);
  const data = raw.map((cb) => ({
    id: cb.id,
    userId: cb.userId,
    name: cb.name,
    filePath: cb.filePath,
    fileUrl: cb.fileUrl,
    fileSize: cb.fileSize,
    totalPages: cb.totalPages,
    status: cb.status,
    processedPages: cb.processedPages,
    totalRecipesFound: cb.totalRecipesFound,
    errorMessage: cb.errorMessage,
    pinned: toBool(cb.pinned),
    generateDescriptions: toBool(cb.generateDescriptions),
    reformulateForCopyright: toBool(cb.reformulateForCopyright),
    convertToGrams: toBool(cb.convertToGrams),
    type: cb.type,
    createdAt: toDate(cb.createdAt),
    updatedAt: toDate(cb.updatedAt),
  }));

  const count = await bulkInsert(prisma.cookbook as any, data);
  console.log(`  -> Inserted ${count} cookbooks`);
}

async function seedRecipes() {
  const raw = readJson<RawRecipe>("export_recipes.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} recipes (in batches of 500)...`);
  const data = raw.map((r) => ({
    id: r.id,
    cookbookId: r.cookbookId,
    userId: r.userId,
    title: r.title,
    originalTitle: r.originalTitle,
    description: r.description,
    sourcePage: r.sourcePage,
    sourceType: r.sourceType,
    category: r.category,
    subCategory: r.subCategory,
    ingredients: r.ingredients,
    instructions: r.instructions,
    prepTimeMinutes: r.prepTimeMinutes,
    cookTimeMinutes: r.cookTimeMinutes,
    servings: r.servings,
    difficulty: r.difficulty,
    type: r.type,
    is_vegetarian: toBool(r.is_vegetarian),
    is_vegan: toBool(r.is_vegan),
    is_gluten_free: toBool(r.is_gluten_free),
    is_lactose_free: toBool(r.is_lactose_free),
    is_halal: toBool(r.is_halal),
    is_low_carb: toBool(r.is_low_carb),
    is_low_fat: toBool(r.is_low_fat),
    is_high_protein: toBool(r.is_high_protein),
    is_mediterranean: toBool(r.is_mediterranean),
    is_whole30: toBool(r.is_whole30),
    is_low_sodium: toBool(r.is_low_sodium),
    calories: r.calories,
    proteins: r.proteins,
    carbs: r.carbs,
    fats: r.fats,
    region: r.region,
    country: r.country,
    season: r.season,
    dietTags: r.dietTags,
    mealType: r.mealType,
    tips: r.tips,
    imageUrl: r.imageUrl,
    estimatedCostPerServing: r.estimatedCostPerServing,
    status: r.status,
    reviewNotes: r.reviewNotes,
    reviewedById: r.reviewedById,
    reviewedAt: toDateOrNull(r.reviewedAt),
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  }));

  const total = await bulkInsertBatched(prisma.recipe as any, data, 500);
  console.log(`  -> Total inserted: ${total} recipes`);
}

async function seedIngredientImages() {
  const raw = readJson<RawIngredientImage>("export_ingredient_images.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} ingredient images...`);
  const data = raw.map((img) => ({
    id: img.id,
    name: img.name,
    imageUrl: img.imageUrl,
    createdAt: toDate(img.createdAt),
  }));

  const count = await bulkInsert(prisma.ingredientImage as any, data);
  console.log(`  -> Inserted ${count} ingredient images`);
}

async function seedIngredientConversions() {
  const raw = readJson<RawIngredientConversion>("export_ingredient_conversions.json");
  if (raw.length === 0) return;

  console.log(`  Seeding ${raw.length} ingredient conversions...`);
  const data = raw.map((ic) => ({
    id: ic.id,
    ingredientName: ic.ingredientName,
    standardUnitWeightGrams: ic.standardUnitWeightGrams,
    unitName: ic.unitName,
    notes: ic.notes,
    createdAt: toDate(ic.createdAt),
  }));

  const count = await bulkInsert(prisma.ingredientConversion as any, data);
  console.log(`  -> Inserted ${count} ingredient conversions`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Database Seed Script ===");
  console.log(`Database: ${IS_POSTGRES ? "PostgreSQL" : "SQLite"}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log("");

  if (!existsSync(DATA_DIR)) {
    console.error(`ERROR: Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const startTime = Date.now();

  // 1. Independent tables (no foreign keys)
  console.log("[1/10] Users");
  await seedUsers();

  // 1b. Create stub users for any missing references
  console.log("[1b]   Checking for missing user references...");
  await seedMissingUsers();

  // 2. Accounts (depends on User)
  console.log("[2/10] Accounts");
  await seedAccounts();

  // 3. Categories (independent)
  console.log("[3/10] Categories");
  await seedCategories();

  // 4. SubCategories (depends on Category)
  console.log("[4/10] SubCategories");
  await seedSubCategories();

  // 5. Countries (independent)
  console.log("[5/10] Countries");
  await seedCountries();

  // 6. Regions (depends on Country)
  console.log("[6/10] Regions");
  await seedRegions();

  // 7. Cookbooks (depends on User)
  console.log("[7/10] Cookbooks");
  await seedCookbooks();

  // 8. Recipes (depends on User, Cookbook)
  console.log("[8/10] Recipes");
  await seedRecipes();

  // 9. IngredientImages (independent)
  console.log("[9/10] Ingredient Images");
  await seedIngredientImages();

  // 10. IngredientConversions (independent)
  console.log("[10/10] Ingredient Conversions");
  await seedIngredientConversions();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`=== Seed completed in ${elapsed}s ===`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
