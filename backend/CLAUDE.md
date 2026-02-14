<stack>
  Bun runtime, Hono web framework, Zod validation.
</stack>

<structure>
  src/index.ts     — App entry, middleware, route mounting
  src/routes/      — Route modules (create as needed)
</structure>

<routes>
  Create routes in src/routes/ and mount them in src/index.ts.

  Example route file (src/routes/todos.ts):
  ```typescript
  import { Hono } from "hono";
  import { zValidator } from "@hono/zod-validator";
  import { z } from "zod";

  const todosRouter = new Hono();

  todosRouter.get("/", (c) => {
    return c.json({ todos: [] });
  });

  todosRouter.post(
    "/",
    zValidator("json", z.object({ title: z.string() })),
    (c) => {
      const { title } = c.req.valid("json");
      return c.json({ todo: { id: "1", title } });
    }
  );

  export { todosRouter };
  ```

  Mount in src/index.ts:
  ```typescript
  import { todosRouter } from "./routes/todos";
  app.route("/api/todos", todosRouter);
  ```

  IMPORTANT: Make sure all endpoints and routes are prefixed with `/api/`
</routes>

<shared_types>
  Define all API contracts in src/types.ts as Zod schemas.
  This file is the single source of truth — both backend and frontend import from here.
</shared_types>

<curl_testing>
  ALWAYS test APIs with cURL after implementing.
  Use $BACKEND_URL environment variable, never localhost.
  Verify response matches the Zod schema before telling frontend it's ready.
</curl_testing>

<database>
  SQLite database with Prisma ORM. Schema at prisma/schema.prisma.
  Push changes with: bunx prisma db push
</database>

<locked_auth_system>
  CRITICAL: The OTP login system is LOCKED and WORKING. DO NOT modify these files:
  - src/routes/otp.ts: OTP request + verify endpoints
  - src/services/email.ts: sendOTPEmail via Resend
  - src/auth.ts: Better Auth config
  - src/index.ts: OTP router mount at /api/otp + auth middleware
  - prisma/schema.prisma: OtpCode table

  Whitelisted emails (case-insensitive, DO NOT change without explicit request):
  - saif@highticketkreator.com
  - nicolas.bertin@opti-marche.com
  - nouhaila.ezzahr@opti-marche.com

  DO NOT switch to password login, DO NOT remove OTP routes, DO NOT change email whitelist.
</locked_auth_system>

<locked_extraction_pipeline>
  CRITICAL: The PDF extraction pipeline is LOCKED and HARDENED. DO NOT modify core logic in:
  - src/services/extraction.ts: The main extraction engine

  Key architecture decisions (DO NOT change):
  - MuPDF for PDF rendering (NOT pdfjs-dist, NOT canvas — they crash in Bun)
  - JPEG base64 images sent to OpenAI Vision (NOT raw PDF)
  - doc.destroy() in finally blocks prevents memory leaks
  - 402 errors fail fast (no retries — credit exhaustion)
  - 429 errors retry with exponential backoff
  - Error pages go to errorLog, NOT stored as NonRecipeContent
  - Image generation uses throttled queue (2 concurrent, 1s between batches)
  - Batch size: 5 pages concurrently via Promise.allSettled
  - Re-extract endpoint at POST /api/processing/re-extract

  DO NOT remove doc.destroy() calls.
  DO NOT make image generation fire-and-forget (must use queue).
  DO NOT retry 402 errors.
  DO NOT store error pages as NonRecipeContent.
  DO NOT change the extraction prompt without explicit user request.
</locked_extraction_pipeline>