import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { env } from "./env";

const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgres");

export const auth = betterAuth({
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
    crossSubDomainCookies: {
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
