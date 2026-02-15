import { PrismaClient } from "@prisma/client";

// Prisma client with Country and Region models
const prisma = new PrismaClient();

// IMPORTANT: SQLite optimizations for better performance
async function initSqlitePragmas(client: PrismaClient) {
  try {
    await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await client.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
    await client.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
    await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    console.log("[Prisma] SQLite pragmas initialized successfully");
  } catch (error) {
    console.error("[Prisma] Failed to initialize SQLite pragmas:", error);
  }
}

// Await the initialization before exporting
await initSqlitePragmas(prisma);

export { prisma };
