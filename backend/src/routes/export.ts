import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import {
  ExportOptionsSchema,
  type ChefExport,
  type ChefExportRecipe,
  type Ingredient,
  type Instruction,
} from "../types";

const exportRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Export recipes
exportRouter.post("/", zValidator("json", ExportOptionsSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { format, recipeIds, includeAll } = c.req.valid("json");

  // Build query
  const where: any = { userId: user.id };

  if (includeAll) {
    where.status = "approved";
  } else if (recipeIds && recipeIds.length > 0) {
    where.id = { in: recipeIds };
    where.status = "approved";
  } else {
    return c.json({ error: { message: "Please select recipes or choose to export all approved recipes" } }, 400);
  }

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { title: "asc" },
  });

  if (recipes.length === 0) {
    return c.json({ error: { message: "No approved recipes to export" } }, 400);
  }

  // Build export in 1000CHEFS format
  const exportRecipes: ChefExportRecipe[] = recipes.map((recipe) => {
    const ingredients = JSON.parse(recipe.ingredients || "[]") as Ingredient[];
    const instructions = JSON.parse(recipe.instructions || "[]") as Instruction[];
    const dietTags = JSON.parse(recipe.dietTags || "[]") as string[];

    return {
      title: recipe.title,
      description: recipe.description,
      category: recipe.category,
      sub_category: recipe.subCategory,
      ingredients: ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      instructions: instructions.map((inst) => ({
        step: inst.step,
        text: inst.text,
      })),
      servings: recipe.servings,
      prep_time_minutes: recipe.prepTimeMinutes,
      cook_time_minutes: recipe.cookTimeMinutes,
      metadata: {
        region: recipe.region,
        country: recipe.country,
        season: recipe.season,
        diet_tags: dietTags,
        meal_type: recipe.mealType,
      },
      tips: recipe.tips,
    };
  });

  const exportData: ChefExport = {
    export_date: new Date().toISOString(),
    recipe_count: exportRecipes.length,
    recipes: exportRecipes,
  };

  // Record export in history
  await prisma.exportHistory.create({
    data: {
      userId: user.id,
      recipeCount: exportRecipes.length,
      format,
    },
  });

  if (format === "json") {
    return c.json({ data: exportData });
  }

  // CSV format
  if (format === "csv") {
    const csvRows: string[] = [];

    // Header
    csvRows.push([
      "title",
      "description",
      "category",
      "sub_category",
      "servings",
      "prep_time_minutes",
      "cook_time_minutes",
      "region",
      "country",
      "season",
      "diet_tags",
      "meal_type",
      "ingredients",
      "instructions",
      "tips",
    ].join(","));

    // Data rows
    for (const recipe of exportRecipes) {
      const row = [
        `"${(recipe.title || "").replace(/"/g, '""')}"`,
        `"${(recipe.description || "").replace(/"/g, '""')}"`,
        `"${recipe.category || ""}"`,
        `"${recipe.sub_category || ""}"`,
        recipe.servings,
        recipe.prep_time_minutes || "",
        recipe.cook_time_minutes || "",
        `"${recipe.metadata.region || ""}"`,
        `"${recipe.metadata.country || ""}"`,
        `"${recipe.metadata.season || ""}"`,
        `"${recipe.metadata.diet_tags.join("; ")}"`,
        `"${recipe.metadata.meal_type || ""}"`,
        `"${recipe.ingredients.map((i) => `${i.quantity}${i.unit} ${i.name}`).join("; ").replace(/"/g, '""')}"`,
        `"${recipe.instructions.map((i) => `${i.step}. ${i.text}`).join(" ").replace(/"/g, '""')}"`,
        `"${(recipe.tips || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");

    return c.text(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recipes-export-${new Date().toISOString().split("T")[0]}.csv"`,
    });
  }

  return c.json({ error: { message: "Invalid format" } }, 400);
});

// Get export history
exportRouter.get("/history", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const history = await prisma.exportHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return c.json({ data: history });
});

export { exportRouter };
