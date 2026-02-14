import { Hono } from "hono";
import { prisma } from "../prisma";

const categoriesRouter = new Hono();

// GET /api/categories - returns all categories with their sub-categories
categoriesRouter.get("/", async (c) => {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      subCategories: {
        orderBy: { order: "asc" },
      },
    },
  });

  return c.json({ data: categories });
});

export { categoriesRouter };
