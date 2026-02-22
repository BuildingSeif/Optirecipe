// Vibecode proxy - only available in Vibecode sandbox environment
try { require("@vibecodeapp/proxy"); } catch { /* Not in Vibecode - running on Railway or local */ }
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/bun";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import "./env";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { cookbooksRouter } from "./routes/cookbooks";
import { recipesRouter } from "./routes/recipes";
import { processingRouter } from "./routes/processing";
import { exportRouter } from "./routes/export";
import { statsRouter } from "./routes/stats";
import { uploadRouter } from "./routes/upload";
import { imagesRouter } from "./routes/images";
import { ingredientImagesRouter } from "./routes/ingredient-images";
import { userRouter } from "./routes/user";
import { nonRecipeContentRouter } from "./routes/nonRecipeContent";
import { categoriesRouter } from "./routes/categories";
import { countriesRouter } from "./routes/countries";
import { otpRouter } from "./routes/otp";
import { extractRecipesFromPDF, recoverMissingImages, gracefulShutdown } from "./services/extraction";

// Type the Hono app with user/session variables
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Global error handler - catches unhandled errors and returns proper JSON instead of raw 500
app.onError((err, c) => {
  console.error("[Server] Unhandled error:", err);
  return c.json(
    { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
    500
  );
});

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.share\.sandbox\.dev$/,
  /^https:\/\/[a-z0-9-]+\.vibecodecloud\.com$/,
  /^https:\/\/[a-z0-9.-]+\.vibecode[a-z]*\.[a-z]+$/,
  /^https:\/\/[a-z0-9-]+\.railway\.app$/,
  /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
    exposeHeaders: ["Content-Length", "Content-Type"],
  })
);

// Logging
app.use("*", logger());

// Body limit for upload routes - 550MB to allow for overhead
app.use("/api/upload/*", bodyLimit({
  maxSize: 550 * 1024 * 1024, // 550MB
  onError: (c) => {
    return c.json({ error: { message: "Le fichier depasse la limite de 500 MB" } }, 413);
  },
}));

// Auth middleware - populates user/session for all routes
app.use("*", async (c, next) => {
  // Try cookie-based auth first (Better Auth default)
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch (e) {
    // If getSession throws (e.g. database issue), continue as unauthenticated
    // rather than crashing every request with 500
    console.error("[Auth] getSession failed, continuing as unauthenticated:", e);
  }

  // Fallback: Bearer token from Authorization header (for cross-origin iframe)
  if (!session) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const dbSession = await prisma.session.findUnique({
          where: { token },
          include: { user: true },
        });
        if (dbSession && new Date(dbSession.expiresAt) > new Date()) {
          session = {
            user: dbSession.user as typeof auth.$Infer.Session.user,
            session: dbSession as unknown as typeof auth.$Infer.Session.session,
          };
        }
      } catch {
        // Token lookup failed, continue as unauthenticated
      }
    }
  }

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Serve uploaded files (for Railway local storage fallback)
const isRailwayEnv = !!process.env.RAILWAY_STATIC_URL || !!process.env.RAILWAY_ENVIRONMENT;
const UPLOADS_DIR = process.env.UPLOADS_DIR || (isRailwayEnv ? "/data/uploads" : "/app/uploads");
app.get("/uploads/:filename", async (c) => {
  const filename = c.req.param("filename");
  // Sanitize filename to prevent directory traversal
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = join(UPLOADS_DIR, safeName);

  if (!existsSync(filePath)) {
    return c.json({ error: { message: "File not found" } }, 404);
  }

  const buffer = await readFile(filePath);
  const ext = safeName.split(".").pop()?.toLowerCase();
  const contentType = ext === "pdf" ? "application/pdf" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "application/octet-stream";

  return new Response(buffer, {
    headers: { "Content-Type": contentType },
  });
});

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Email whitelist - restrict access
const EMAIL_WHITELIST = [
  "saif@highticketkreator.com",
  "nicolas.bertin@opti-marche.com",
  "nouhaila.ezzahr@opti-marche.com",
];

// Mount OTP routes (public, no auth required)
app.route("/api/otp", otpRouter);

// Intercept sign-in and sign-up to check whitelist
app.post("/api/auth/sign-in/email", async (c) => {
  const clonedRequest = c.req.raw.clone();
  const body = (await clonedRequest.json()) as { email?: string };
  const email = (body.email || "").toLowerCase().trim();
  if (!EMAIL_WHITELIST.includes(email)) {
    return c.json(
      { error: { message: "Acces non autorise. Contactez l'administrateur." } },
      403
    );
  }
  return auth.handler(c.req.raw);
});

app.post("/api/auth/sign-up/email", async (c) => {
  const clonedRequest = c.req.raw.clone();
  const body = (await clonedRequest.json()) as { email?: string };
  const email = (body.email || "").toLowerCase().trim();
  if (!EMAIL_WHITELIST.includes(email)) {
    return c.json(
      { error: { message: "Acces non autorise. Contactez l'administrateur." } },
      403
    );
  }
  return auth.handler(c.req.raw);
});

// Mount auth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Get current user
app.get("/api/me", (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  return c.json({ data: user });
});

// Mount API routes
app.route("/api/cookbooks", cookbooksRouter);
app.route("/api/recipes", recipesRouter);
app.route("/api/processing", processingRouter);
app.route("/api/export", exportRouter);
app.route("/api/stats", statsRouter);
app.route("/api/upload", uploadRouter);
app.route("/api/images", imagesRouter);
app.route("/api/ingredient-images", ingredientImagesRouter);
app.route("/api/user", userRouter);
app.route("/api/non-recipe-content", nonRecipeContentRouter);
app.route("/api/categories", categoriesRouter);
app.route("/api/countries", countriesRouter);

// Serve frontend static files on Railway (built webapp bundled into /app/public)
// Hono's Bun serveStatic prepends "./" so we need a relative path from WORKDIR (/app)
const STATIC_DIR = "/app/public";
const STATIC_DIR_RELATIVE = "./public";
if (existsSync(STATIC_DIR)) {
  console.log("[Static] Serving frontend from /app/public");

  // Serve static assets (JS, CSS, images, etc.)
  app.use("/*", serveStatic({ root: STATIC_DIR_RELATIVE }));

  // SPA fallback: serve index.html for any non-API, non-file route
  app.get("*", async (c) => {
    const reqPath = c.req.path;
    if (reqPath.startsWith("/api/") || reqPath === "/health" || reqPath.startsWith("/uploads/")) {
      return c.notFound();
    }
    const html = await readFile(join(STATIC_DIR, "index.html"), "utf-8");
    return c.html(html);
  });
} else {
  console.log("[Static] No frontend build found at /app/public, API-only mode");
}

// Recover orphaned processing jobs on startup
// If the server crashed/restarted, jobs stuck in "processing" need to be detected
async function recoverOrphanedJobs() {
  try {
    const orphanedJobs = await prisma.processingJob.findMany({
      where: { status: { in: ["processing", "pending"] } },
      include: { cookbook: true },
    });

    if (orphanedJobs.length === 0) return;

    console.log(`[Recovery] Found ${orphanedJobs.length} orphaned job(s), recovering...`);

    for (const job of orphanedJobs) {
      // If the job had made progress, resume from where it left off
      const hasProgress = (job.currentPage ?? 0) > 0;

      if (hasProgress) {
        console.log(`[Recovery] Resuming job ${job.id} for "${job.cookbook.name}" from page ${job.currentPage}`);
        // Re-launch extraction from where it left off
        extractRecipesFromPDF(job.id).catch((error) => {
          console.error(`[Recovery] Failed to resume job ${job.id}:`, error);
        });
      } else {
        // No progress was made - mark as failed so user can retry
        console.log(`[Recovery] Marking job ${job.id} for "${job.cookbook.name}" as failed (no progress)`);
        await prisma.processingJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorLog: JSON.stringify(["Le serveur a redemarre pendant le traitement. Veuillez relancer l'extraction."]),
          },
        });
        await prisma.cookbook.update({
          where: { id: job.cookbookId },
          data: {
            status: "failed",
            errorMessage: "Le serveur a redemarre pendant le traitement. Veuillez relancer l'extraction.",
          },
        });
      }
    }
  } catch (error) {
    console.error("[Recovery] Error recovering orphaned jobs:", error);
  }
}

// Run recovery after a short delay to let the server fully start
setTimeout(recoverOrphanedJobs, 3000);

// Recover missing recipe images after startup (delayed to not compete with extraction recovery)
setTimeout(recoverMissingImages, 10000);

const port = Number(process.env.PORT) || 3000;

// Graceful shutdown handler
const shutdownHandler = async () => {
  console.log("[Server] Shutdown signal received");
  await gracefulShutdown();
  process.exit(0);
};
process.on("SIGTERM", shutdownHandler);
process.on("SIGINT", shutdownHandler);

export default {
  port,
  fetch: app.fetch,
};
