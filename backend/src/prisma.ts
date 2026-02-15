import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgres");

async function initDatabase(client: PrismaClient) {
  try {
    if (isPostgres) {
      // PostgreSQL doesn't need SQLite pragmas
      console.log("[Prisma] PostgreSQL database connected");
    } else {
      // SQLite optimizations
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await client.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
      console.log("[Prisma] SQLite pragmas initialized successfully");
    }
  } catch (error) {
    console.error("[Prisma] Database initialization error:", error);
  }
}

await initDatabase(prisma);

export { prisma };
