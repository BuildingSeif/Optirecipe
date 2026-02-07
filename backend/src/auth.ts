import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { createVibecodeSDK } from "@vibecodeapp/backend-sdk";
import { prisma } from "./prisma";
import { env } from "./env";

// Initialize Vibecode SDK for email sending
const vibecode = createVibecodeSDK();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BACKEND_URL,
  trustedOrigins: [
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.dev.vibecode.run",
    "https://*.vibecode.run",
    "https://*.vibecodeapp.com",
    env.BACKEND_URL,
  ],
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[Auth] Sending OTP to ${email}, type: ${type}`);

        try {
          await vibecode.email.sendOTP({
            to: email,
            code: String(otp),
            fromName: "OptiRecipe",
            lang: "fr",
          });
          console.log(`[Auth] OTP sent successfully to ${email}`);
        } catch (error) {
          console.error(`[Auth] Failed to send OTP to ${email}:`, error);
          throw error;
        }
      },
    }),
  ],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    disableCSRFCheck: true,
    // Cross-origin cookie settings for iframe web preview
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },
});
