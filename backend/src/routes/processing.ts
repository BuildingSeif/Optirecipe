import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { StartProcessingSchema, ReExtractPagesSchema } from "../types";
import { extractRecipesFromPDF, pauseProcessingJob, resumeProcessingJob, recoverMissingImages, extractPageRange } from "../services/extraction";
import { progressEmitter } from "../services/progress-emitter";

const processingRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Get all processing jobs for user
processingRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const jobs = await prisma.processingJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      cookbook: {
        select: { id: true, name: true },
      },
    },
  });

  // Parse JSON fields
  const parsedJobs = jobs.map((job) => ({
    ...job,
    errorLog: JSON.parse(job.errorLog),
    processingLog: JSON.parse(job.processingLog),
  }));

  return c.json({ data: parsedJobs });
});

// SSE endpoint for real-time progress
// Supports auth via middleware (Bearer header) OR query param (EventSource fallback)
processingRouter.get("/stream/:id", async (c) => {
  let userId = c.get("user")?.id;

  // Fallback: accept token from query param (EventSource can't set headers)
  if (!userId) {
    const queryToken = c.req.query("token");
    if (queryToken) {
      try {
        const dbSession = await prisma.session.findUnique({
          where: { token: queryToken },
          select: { userId: true, expiresAt: true },
        });
        if (dbSession && new Date(dbSession.expiresAt) > new Date()) {
          userId = dbSession.userId;
        }
      } catch {}
    }
  }

  if (!userId) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  // Verify job belongs to user
  const job = await prisma.processingJob.findFirst({
    where: { id, userId },
  });
  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  // Set SSE headers
  return streamSSE(c, async (stream) => {
    // Send initial state
    await stream.writeSSE({
      data: JSON.stringify({
        type: "connected",
        jobId: id,
        currentPage: job.currentPage,
        totalPages: job.totalPages,
        recipesExtracted: job.recipesExtracted,
        status: job.status,
      }),
      event: "connected",
    });

    // Subscribe to progress events
    const unsubscribe = progressEmitter.subscribe(id, async (event) => {
      try {
        await stream.writeSSE({
          data: JSON.stringify(event.data),
          event: event.type,
        });
      } catch {
        // Stream closed
        unsubscribe();
      }
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ data: "", event: "heartbeat" });
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 15000);

    // Wait for stream to close
    stream.onAbort(() => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep stream open until aborted
    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});

// Get single processing job
processingRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const job = await prisma.processingJob.findFirst({
    where: { id, userId: user.id },
    include: {
      cookbook: {
        select: { id: true, name: true, status: true, totalPages: true },
      },
    },
  });

  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  return c.json({
    data: {
      ...job,
      errorLog: JSON.parse(job.errorLog),
      processingLog: JSON.parse(job.processingLog),
    },
  });
});

// Start processing a cookbook
processingRouter.post("/start", zValidator("json", StartProcessingSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { cookbookId } = c.req.valid("json");

  // Verify cookbook ownership
  const cookbook = await prisma.cookbook.findFirst({
    where: { id: cookbookId, userId: user.id },
  });

  if (!cookbook) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  // Check if there's already an active job for this cookbook
  const existingJob = await prisma.processingJob.findFirst({
    where: {
      cookbookId,
      status: { in: ["pending", "processing"] },
    },
  });

  if (existingJob) {
    return c.json({ error: { message: "Cookbook is already being processed" } }, 400);
  }

  // Create a new processing job
  const job = await prisma.processingJob.create({
    data: {
      cookbookId,
      userId: user.id,
      totalPages: cookbook.totalPages,
      status: "pending",
    },
  });

  // Update cookbook status
  await prisma.cookbook.update({
    where: { id: cookbookId },
    data: { status: "processing" },
  });

  // Start async processing (non-blocking)
  extractRecipesFromPDF(job.id).catch((error) => {
    console.error("Processing error:", error);
  });

  return c.json({ data: job }, 201);
});

// Cancel processing job
processingRouter.post("/:id/cancel", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const job = await prisma.processingJob.findFirst({
    where: { id, userId: user.id },
  });

  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return c.json({ error: { message: "Job is already finished" } }, 400);
  }

  // Update job status
  await prisma.processingJob.update({
    where: { id },
    data: {
      status: "cancelled",
      completedAt: new Date(),
    },
  });

  // Update cookbook status
  await prisma.cookbook.update({
    where: { id: job.cookbookId },
    data: { status: "failed", errorMessage: "Processing cancelled by user" },
  });

  return c.json({ data: { message: "Processing cancelled" } });
});

// Pause processing job
processingRouter.post("/:id/pause", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const job = await prisma.processingJob.findFirst({
    where: { id, userId: user.id },
  });

  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  if (job.status !== "processing") {
    return c.json({ error: { message: "Job is not currently processing" } }, 400);
  }

  // Signal the extraction loop to pause
  pauseProcessingJob(id);

  // Update job status
  await prisma.processingJob.update({
    where: { id },
    data: { status: "paused" },
  });

  return c.json({ data: { message: "Processing paused" } });
});

// Resume processing job
processingRouter.post("/:id/resume", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const job = await prisma.processingJob.findFirst({
    where: { id, userId: user.id },
  });

  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  const resumableStatuses = ["paused", "failed", "cancelled"];
  if (!resumableStatuses.includes(job.status)) {
    return c.json({ error: { message: "Job is not paused, failed, or cancelled" } }, 400);
  }

  // For failed/cancelled jobs, require that some progress was made (currentPage > 0)
  if ((job.status === "failed" || job.status === "cancelled") && (job.currentPage ?? 0) === 0) {
    return c.json({ error: { message: "Job has no progress to resume from. Use re-extract instead." } }, 400);
  }

  // Remove from paused set (no-op if not paused, but safe to call)
  resumeProcessingJob(id);

  // Update job status
  await prisma.processingJob.update({
    where: { id },
    data: { status: "processing", completedAt: null },
  });

  // Clear cookbook error message when resuming from failed/cancelled
  if (job.status === "failed" || job.status === "cancelled") {
    await prisma.cookbook.update({
      where: { id: job.cookbookId },
      data: { status: "processing", errorMessage: null },
    });
  }

  // Re-launch extraction from where it left off (currentPage is tracked in DB)
  extractRecipesFromPDF(id).catch((error) => {
    console.error("Resume processing error:", error);
  });

  return c.json({ data: { message: "Processing resumed" } });
});

// Re-extract a completed cookbook (cleans up failed pages, re-runs from scratch)
processingRouter.post("/re-extract", zValidator("json", StartProcessingSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { cookbookId } = c.req.valid("json");

  const cookbook = await prisma.cookbook.findFirst({
    where: { id: cookbookId, userId: user.id },
  });

  if (!cookbook) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  // Block if there's an active job running
  const activeJob = await prisma.processingJob.findFirst({
    where: { cookbookId, status: { in: ["pending", "processing"] } },
  });
  if (activeJob) {
    return c.json({ error: { message: "Cookbook is already being processed" } }, 400);
  }

  console.log(`[Re-extract] Starting re-extraction for cookbook ${cookbookId} (${cookbook.name})`);

  // Delete all existing recipes and non-recipe content for this cookbook
  const deletedRecipes = await prisma.recipe.deleteMany({ where: { cookbookId } });
  const deletedContent = await prisma.nonRecipeContent.deleteMany({ where: { cookbookId } });
  console.log(`[Re-extract] Cleaned up ${deletedRecipes.count} recipes and ${deletedContent.count} non-recipe entries`);

  // Mark old jobs as cancelled
  await prisma.processingJob.updateMany({
    where: { cookbookId, status: { in: ["completed", "failed", "paused", "cancelled"] } },
    data: { status: "cancelled" },
  });

  // Reset cookbook
  await prisma.cookbook.update({
    where: { id: cookbookId },
    data: {
      status: "processing",
      processedPages: 0,
      totalRecipesFound: 0,
      errorMessage: null,
    },
  });

  // Create fresh job
  const job = await prisma.processingJob.create({
    data: {
      cookbookId,
      userId: user.id,
      totalPages: cookbook.totalPages,
      status: "pending",
    },
  });

  console.log(`[Re-extract] Created new job ${job.id}, starting extraction...`);

  // Start async processing
  extractRecipesFromPDF(job.id).catch((error) => {
    console.error("[Re-extract] Processing error:", error);
  });

  return c.json({ data: { job, message: `Re-extraction started. Cleaned ${deletedRecipes.count} old recipes.` } }, 201);
});

// Get queue position for a job
processingRouter.get("/:id/queue-position", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const job = await prisma.processingJob.findFirst({
    where: { id, userId: user.id },
  });

  if (!job) {
    return c.json({ error: { message: "Processing job not found" } }, 404);
  }

  // Count jobs ahead of this one in the queue
  const queuedAhead = await prisma.processingJob.count({
    where: {
      status: { in: ["pending", "processing"] },
      createdAt: { lt: job.createdAt },
    },
  });

  return c.json({
    data: {
      position: job.status === "processing" ? 0 : queuedAhead + 1,
      status: job.status,
      failedPages: job.failedPages,
    },
  });
});

// Re-extract specific page range from a cookbook
processingRouter.post("/re-extract-pages", zValidator("json", ReExtractPagesSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { cookbookId, startPage, endPage } = c.req.valid("json");

  // Validate endPage >= startPage
  if (endPage < startPage) {
    return c.json({ error: { message: "endPage must be greater than or equal to startPage" } }, 400);
  }

  // Verify cookbook ownership
  const cookbook = await prisma.cookbook.findFirst({
    where: { id: cookbookId, userId: user.id },
  });

  if (!cookbook) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  // Block if there's already an active processing job
  const activeJob = await prisma.processingJob.findFirst({
    where: {
      cookbookId,
      status: { in: ["pending", "processing"] },
    },
  });

  if (activeJob) {
    return c.json({ error: { message: "Cookbook is already being processed" } }, 400);
  }

  // Find the most recent completed/failed job for this cookbook to re-use
  const existingJob = await prisma.processingJob.findFirst({
    where: { cookbookId },
    orderBy: { createdAt: "desc" },
  });

  if (!existingJob) {
    return c.json({ error: { message: "No existing processing job found for this cookbook. Use full extraction first." } }, 400);
  }

  console.log(`[Re-extract-pages] Starting page-range re-extraction for cookbook ${cookbookId}, pages ${startPage}-${endPage}`);

  // Start async page-range extraction (non-blocking)
  extractPageRange(existingJob.id, startPage, endPage).catch((error) => {
    console.error("[Re-extract-pages] Processing error:", error);
  });

  return c.json({
    data: {
      jobId: existingJob.id,
      message: `Re-extraction of pages ${startPage}-${endPage} started.`,
    },
  }, 201);
});

// Trigger image recovery for recipes missing images
processingRouter.post("/recover-images", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const count = await recoverMissingImages();
  return c.json({ data: { queued: count, message: count > 0 ? `${count} recette(s) en attente de generation d'image` : "Toutes les recettes ont deja une image" } });
});

export { processingRouter };
