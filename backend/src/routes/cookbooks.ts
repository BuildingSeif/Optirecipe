import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { CreateCookbookSchema, UpdateCookbookSchema } from "../types";

const cookbooksRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Get all cookbooks for current user
cookbooksRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const cookbooks = await prisma.cookbook.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { recipes: true },
      },
    },
  });

  return c.json({ data: cookbooks });
});

// Get single cookbook
cookbooksRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const cookbook = await prisma.cookbook.findFirst({
    where: { id, userId: user.id },
    include: {
      recipes: {
        orderBy: { sourcePage: "asc" },
      },
      processingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!cookbook) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  return c.json({ data: cookbook });
});

// Create cookbook
cookbooksRouter.post("/", zValidator("json", CreateCookbookSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const data = c.req.valid("json");

  const cookbook = await prisma.cookbook.create({
    data: {
      ...data,
      userId: user.id,
    },
  });

  return c.json({ data: cookbook }, 201);
});

// Update cookbook
cookbooksRouter.patch("/:id", zValidator("json", UpdateCookbookSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();
  const data = c.req.valid("json");

  // Check ownership
  const existing = await prisma.cookbook.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  const cookbook = await prisma.cookbook.update({
    where: { id },
    data,
  });

  return c.json({ data: cookbook });
});

// Delete cookbook
cookbooksRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  // Check ownership
  const existing = await prisma.cookbook.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: { message: "Cookbook not found" } }, 404);
  }

  await prisma.cookbook.delete({ where: { id } });

  return c.body(null, 204);
});

export { cookbooksRouter };
