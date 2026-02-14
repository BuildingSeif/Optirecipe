import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";
import {
  CreateRecipeSchema,
  UpdateRecipeSchema,
  RecipeFiltersSchema,
  type Ingredient,
  type Instruction,
} from "../types";

const recipesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Helper to parse JSON fields from DB
function parseRecipe(recipe: any) {
  return {
    ...recipe,
    ingredients: JSON.parse(recipe.ingredients || "[]") as Ingredient[],
    instructions: JSON.parse(recipe.instructions || "[]") as Instruction[],
    dietTags: JSON.parse(recipe.dietTags || "[]") as string[],
  };
}

// Get all recipes with filtering
recipesRouter.get("/", zValidator("query", RecipeFiltersSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const filters = c.req.valid("query");
  const { page, limit, sortBy, sortOrder, search, status, category, cookbookId, season, type } = filters;

  const where: any = { userId: user.id };

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (status) where.status = status;
  if (category) where.category = category;
  if (cookbookId) where.cookbookId = cookbookId;
  if (season) where.season = season;
  if (type) where.type = type;

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        cookbook: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.recipe.count({ where }),
  ]);

  return c.json({
    data: {
      recipes: recipes.map(parseRecipe),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// Get single recipe
recipesRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: user.id },
    include: {
      cookbook: {
        select: { id: true, name: true },
      },
    },
  });

  if (!recipe) {
    return c.json({ error: { message: "Recipe not found" } }, 404);
  }

  return c.json({ data: parseRecipe(recipe) });
});

// Create recipe
recipesRouter.post("/", zValidator("json", CreateRecipeSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const data = c.req.valid("json");

  const recipe = await prisma.recipe.create({
    data: {
      ...data,
      userId: user.id,
      ingredients: JSON.stringify(data.ingredients),
      instructions: JSON.stringify(data.instructions),
      dietTags: JSON.stringify(data.dietTags),
    },
  });

  return c.json({ data: parseRecipe(recipe) }, 201);
});

// Update recipe
recipesRouter.patch("/:id", zValidator("json", UpdateRecipeSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();
  const data = c.req.valid("json");

  // Check ownership
  const existing = await prisma.recipe.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: { message: "Recipe not found" } }, 404);
  }

  // Build update data, only including fields that are provided
  const updateData: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (key === "ingredients" || key === "instructions" || key === "dietTags") {
        updateData[key] = JSON.stringify(value);
      } else {
        updateData[key] = value;
      }
    }
  }

  // If status is being changed to approved/rejected, record reviewer
  if (data.status === "approved" || data.status === "rejected") {
    updateData.reviewedById = user.id;
    updateData.reviewedAt = new Date();
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: updateData,
  });

  return c.json({ data: parseRecipe(recipe) });
});

// Bulk update recipes (approve/reject)
const BulkUpdateSchema = z.object({
  ids: z.array(z.string()),
  status: z.enum(["approved", "rejected", "pending", "needs_review"]),
  reviewNotes: z.string().optional(),
});

recipesRouter.patch("/bulk/status", zValidator("json", BulkUpdateSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { ids, status, reviewNotes } = c.req.valid("json");

  // Update all recipes that belong to the user
  const result = await prisma.recipe.updateMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
    data: {
      status,
      reviewNotes: reviewNotes || null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  return c.json({ data: { updated: result.count } });
});

// Delete recipe
recipesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { id } = c.req.param();

  const existing = await prisma.recipe.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: { message: "Recipe not found" } }, 404);
  }

  await prisma.recipe.delete({ where: { id } });

  return c.body(null, 204);
});

export { recipesRouter };
