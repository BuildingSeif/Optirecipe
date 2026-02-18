import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { env } from "./env";

const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgres");
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
const baseURL = process.env.BACKEND_URL || (isRailway ? "https://optirecipe-production.up.railway.app" : "http://localhost:3000");

export const auth = betterAuth({
  baseURL,
  database: prismaAdapter(prisma, { provider: isPostgres ? "postgresql" : "sqlite" }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.dev.vibecode.run",
    "https://*.vibecode.run",
    "https://*.vibecodeapp.com",
    "https://*.railway.app",
    "https://*.up.railway.app",
  ],
  advanced: {
    // Only enable crossSubDomainCookies in Vibecode (not needed on Railway — uses Bearer tokens)
    crossSubDomainCookies: isRailway ? undefined : {
      enabled: true,
    },
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },
});
