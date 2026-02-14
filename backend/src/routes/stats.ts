import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";
import type { DashboardStats } from "../types";

const statsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Get dashboard stats
statsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const [
    totalCookbooks,
    totalRecipes,
    pendingRecipes,
    approvedRecipes,
    rejectedRecipes,
    processingJobs,
    processingCookbooks,
    completedCookbooks,
    failedCookbooks,
  ] = await Promise.all([
    prisma.cookbook.count({ where: { userId: user.id } }),
    prisma.recipe.count({ where: { userId: user.id } }),
    prisma.recipe.count({ where: { userId: user.id, status: "pending" } }),
    prisma.recipe.count({ where: { userId: user.id, status: "approved" } }),
    prisma.recipe.count({ where: { userId: user.id, status: "rejected" } }),
    prisma.processingJob.count({
      where: { userId: user.id, status: { in: ["pending", "processing"] } },
    }),
    prisma.cookbook.count({ where: { userId: user.id, status: "processing" } }),
    prisma.cookbook.count({ where: { userId: user.id, status: "completed" } }),
    prisma.cookbook.count({ where: { userId: user.id, status: "failed" } }),
  ]);

  const stats: DashboardStats = {
    totalCookbooks,
    totalRecipes,
    pendingRecipes,
    approvedRecipes,
    rejectedRecipes,
    processingJobs,
    processingCookbooks,
    completedCookbooks,
    failedCookbooks,
  };

  return c.json({ data: stats });
});

// Get recent activity
statsRouter.get("/recent", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const [recentJobs, recentRecipes, recentCookbooks] = await Promise.all([
    prisma.processingJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        cookbook: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        cookbook: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.cookbook.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        _count: { select: { recipes: true } },
      },
    }),
  ]);

  // Parse JSON fields for jobs
  const parsedJobs = recentJobs.map((job) => ({
    ...job,
    errorLog: JSON.parse(job.errorLog),
    processingLog: JSON.parse(job.processingLog),
  }));

  // Parse JSON fields for recipes
  const parsedRecipes = recentRecipes.map((recipe) => ({
    ...recipe,
    ingredients: JSON.parse(recipe.ingredients || "[]"),
    instructions: JSON.parse(recipe.instructions || "[]"),
    dietTags: JSON.parse(recipe.dietTags || "[]"),
  }));

  return c.json({
    data: {
      recentJobs: parsedJobs,
      recentRecipes: parsedRecipes,
      recentCookbooks,
    },
  });
});

export { statsRouter };
