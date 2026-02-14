import { Hono } from "hono";
import { z } from "zod";
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

// ==================== Query / Body Schemas ====================

const CookbookListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  sort: z.enum(["newest", "oldest", "name"]).optional().default("newest"),
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const BulkPinSchema = z.object({
  ids: z.array(z.string()).min(1),
  pinned: z.boolean(),
});

// ==================== List cookbooks (with search, filter, sort) ====================

cookbooksRouter.get(
  "/",
  zValidator("query", CookbookListQuerySchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { search, status, sort } = c.req.valid("query");

    // Build where clause
    const where: Record<string, unknown> = { userId: user.id };

    if (search) {
      where.name = { contains: search };
    }

    if (status) {
      where.status = status;
    }

    // Build orderBy
    let orderBy: Record<string, string>;
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const cookbooks = await prisma.cookbook.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    return c.json({ data: cookbooks });
  }
);

// ==================== Bulk delete ====================

cookbooksRouter.post(
  "/bulk/delete",
  zValidator("json", BulkDeleteSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { ids } = c.req.valid("json");

    const result = await prisma.cookbook.deleteMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });

    return c.json({ data: { deleted: result.count } });
  }
);

// ==================== Bulk pin / unpin ====================

cookbooksRouter.post(
  "/bulk/pin",
  zValidator("json", BulkPinSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { ids, pinned } = c.req.valid("json");

    const result = await prisma.cookbook.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      data: { pinned },
    });

    return c.json({ data: { updated: result.count } });
  }
);

// ==================== Get single cookbook ====================

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

// ==================== Create cookbook ====================

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

// ==================== Update cookbook ====================

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

// ==================== Delete cookbook ====================

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
