import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { NonRecipeContentFiltersSchema } from "../types";

const nonRecipeContentRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// List non-recipe content with filters
nonRecipeContentRouter.get(
  "/",
  zValidator("query", NonRecipeContentFiltersSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { cookbookId, type, page, limit } = c.req.valid("query");

    const where: {
      userId: string;
      cookbookId?: string;
      type?: string;
    } = { userId: user.id };

    if (cookbookId) where.cookbookId = cookbookId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.nonRecipeContent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          cookbook: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.nonRecipeContent.count({ where }),
    ]);

    return c.json({
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }
);

// Get unique content types with counts
nonRecipeContentRouter.get("/types", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const grouped = await prisma.nonRecipeContent.groupBy({
    by: ["type"],
    _count: true,
    where: { userId: user.id },
  });

  const types = grouped.map((g) => ({
    type: g.type,
    count: g._count,
  }));

  return c.json({ data: types });
});

// Get single content item
nonRecipeContentRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const item = await prisma.nonRecipeContent.findFirst({
    where: { id, userId: user.id },
    include: {
      cookbook: {
        select: { id: true, name: true },
      },
    },
  });

  if (!item) {
    return c.json({ error: { message: "Content not found" } }, 404);
  }

  return c.json({ data: item });
});

// Delete single content item
nonRecipeContentRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const existing = await prisma.nonRecipeContent.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: { message: "Content not found" } }, 404);
  }

  await prisma.nonRecipeContent.delete({ where: { id } });

  return c.body(null, 204);
});

export { nonRecipeContentRouter };
