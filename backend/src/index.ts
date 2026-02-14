import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
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
import { userRouter } from "./routes/user";
import { nonRecipeContentRouter } from "./routes/nonRecipeContent";
import { categoriesRouter } from "./routes/categories";
import { countriesRouter } from "./routes/countries";

// Type the Hono app with user/session variables
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
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
  let session = await auth.api.getSession({ headers: c.req.raw.headers });

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

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Email whitelist - restrict access
const EMAIL_WHITELIST = [
  "saif@highticketkreator.com",
  "nicolas.bertin@opti-marche.com",
  "nouhaila.ezzahr@opti-marche.com",
];

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
app.route("/api/user", userRouter);
app.route("/api/non-recipe-content", nonRecipeContentRouter);
app.route("/api/categories", categoriesRouter);
app.route("/api/countries", countriesRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
