import { Hono } from "hono";
import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { sendOTPEmail } from "../services/email";

const otpRouter = new Hono();

// Email whitelist (case-insensitive)
const EMAIL_WHITELIST = [
  "saif@highticketkreator.com",
  "nicolas.bertin@opti-marche.com",
  "nouhaila.ezzahr@opti-marche.com",
];

// ==================== POST /request-otp ====================
otpRouter.post("/request-otp", async (c) => {
  try {
    const body = await c.req.json<{ email?: string }>();
    const email = (body.email || "").trim().toLowerCase();

    console.log("[OTP] request-otp called with email:", email);

    // Check whitelist (case-insensitive)
    if (!EMAIL_WHITELIST.includes(email)) {
      console.log("[OTP] Email not in whitelist:", email);
      return c.json(
        { error: { message: "Acces non autorise. Contactez l'administrateur." } },
        403
      );
    }

    console.log("[OTP] Email is whitelisted, generating OTP code...");

    // Generate a random 6-digit OTP code
    const code = String(randomInt(100000, 999999));
    console.log("[OTP] Generated code for", email, ":", code);

    // Delete any existing unused OTP codes for this email
    const deleteResult = await prisma.otpCode.deleteMany({
      where: { email, used: false },
    });
    console.log("[OTP] Deleted", deleteResult.count, "existing unused OTP codes for", email);

    // Store OTP with 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const otpRecord = await prisma.otpCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });
    console.log("[OTP] Stored OTP record:", otpRecord.id, "expires at:", expiresAt.toISOString());

    // Send email via Resend
    console.log("[OTP] Sending OTP email to:", email);
    try {
      await sendOTPEmail(email, code);
      console.log("[OTP] OTP email sent successfully to:", email);
    } catch (emailError) {
      console.error("[OTP] Failed to send OTP email:", emailError);
      return c.json(
        { error: { message: "Erreur d'envoi. Veuillez reessayer." } },
        500
      );
    }

    console.log("[OTP] request-otp completed successfully for:", email);
    return c.json({ data: { message: "Code envoye! Verifiez votre boite mail." } });
  } catch (err) {
    console.error("[OTP] Unexpected error in request-otp:", err);
    return c.json(
      { error: { message: "Erreur d'envoi. Veuillez reessayer." } },
      500
    );
  }
});

// ==================== POST /verify-otp ====================
otpRouter.post("/verify-otp", async (c) => {
  try {
    const body = await c.req.json<{ email?: string; code?: string }>();
    const email = (body.email || "").trim().toLowerCase();
    const code = (body.code || "").trim();

    console.log("[OTP] verify-otp called with email:", email, "code:", code);

    // Look up OTP in the database (match email + code, not used, not expired)
    const now = new Date();
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gt: now },
      },
    });

    console.log("[OTP] OTP lookup result:", otpRecord ? `Found (id: ${otpRecord.id})` : "Not found or expired");

    if (!otpRecord) {
      console.log("[OTP] Invalid or expired OTP for:", email);
      return c.json(
        { error: { message: "Code invalide ou expire. Veuillez reessayer." } },
        401
      );
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });
    console.log("[OTP] Marked OTP as used:", otpRecord.id);

    // Find or create the user
    let dbUser = await prisma.user.findUnique({
      where: { email },
    });
    console.log("[OTP] Existing user lookup:", dbUser ? `Found (id: ${dbUser.id})` : "Not found");

    if (!dbUser) {
      const userId = randomUUID();
      const name = email.split("@")[0] || email;
      console.log("[OTP] Creating new user with id:", userId, "name:", name);

      dbUser = await prisma.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
        },
      });
      console.log("[OTP] Created new user:", dbUser.id);

      // Also create an Account record
      const accountId = randomUUID();
      const account = await prisma.account.create({
        data: {
          id: accountId,
          accountId: dbUser.id,
          providerId: "otp",
          userId: dbUser.id,
        },
      });
      console.log("[OTP] Created account record:", account.id, "providerId: otp");
    } else {
      console.log("[OTP] Using existing user:", dbUser.id);
    }

    // Create a new Session (30 days expiry)
    const sessionId = randomUUID();
    const sessionToken = randomUUID();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        userId: dbUser.id,
      },
    });
    console.log("[OTP] Created session:", session.id, "token:", session.token, "expires:", sessionExpiresAt.toISOString());

    console.log("[OTP] verify-otp completed successfully for:", email);

    return c.json({
      user: dbUser,
      token: session.token,
    });
  } catch (err) {
    console.error("[OTP] Unexpected error in verify-otp:", err);
    return c.json(
      { error: { message: "Code invalide ou expire. Veuillez reessayer." } },
      500
    );
  }
});

export { otpRouter };
