import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import {
  ExportOptionsSchema,
  type OptiRecipeExport,
  type OptiRecipeExportRecipe,
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

  const { format, recipeIds, includeAll, status, type, cookbookId, category } = c.req.valid("json");

  // Build query
  const where: any = { userId: user.id };

  if (includeAll) {
    // When includeAll, apply optional filters
    if (status) {
      where.status = status;
    } else {
      where.status = "approved";
    }
  } else if (recipeIds && recipeIds.length > 0) {
    where.id = { in: recipeIds };
    if (status) {
      where.status = status;
    } else {
      where.status = "approved";
    }
  } else {
    return c.json({ error: { message: "Please select recipes or choose to export all approved recipes" } }, 400);
  }

  // Apply additional filters
  if (type) where.type = type;
  if (cookbookId) where.cookbookId = cookbookId;
  if (category) where.category = category;

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { title: "asc" },
    include: {
      cookbook: {
        select: { id: true, name: true },
      },
    },
  });

  if (recipes.length === 0) {
    return c.json({ error: { message: "No recipes found matching the filters" } }, 400);
  }

  // Build filters_applied for export_info
  const filtersApplied: Record<string, string> = {};
  if (status) filtersApplied.status = status;
  else if (includeAll) filtersApplied.status = "approved";
  if (type) filtersApplied.type = type;
  if (cookbookId) {
    const cookbook = recipes[0]?.cookbook;
    filtersApplied.cookbook = cookbook ? (cookbook as { id: string; name: string }).name : cookbookId;
  }
  if (category) filtersApplied.category = category;

  // Build export in OptiRecipe format
  const exportRecipes: OptiRecipeExportRecipe[] = recipes.map((recipe) => {
    const ingredients = JSON.parse(recipe.ingredients || "[]") as Ingredient[];
    const instructions = JSON.parse(recipe.instructions || "[]") as Instruction[];

    return {
      title: recipe.title,
      original_title: recipe.originalTitle,
      description: recipe.description,
      image_url: recipe.imageUrl,
      servings: recipe.servings,
      prep_time_minutes: recipe.prepTimeMinutes,
      cook_time_minutes: recipe.cookTimeMinutes,
      difficulty: recipe.difficulty,
      type: recipe.type,
      category: recipe.category,
      sub_category: recipe.subCategory,
      country: recipe.country,
      region: recipe.region,
      dietary: {
        vegetarian: recipe.is_vegetarian,
        vegan: recipe.is_vegan,
        gluten_free: recipe.is_gluten_free,
        lactose_free: recipe.is_lactose_free,
        halal: recipe.is_halal,
      },
      nutrition: {
        calories: recipe.calories,
        proteins: recipe.proteins,
        carbs: recipe.carbs,
        fats: recipe.fats,
      },
      ingredients: ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        original_text: ing.original_text ?? null,
      })),
      instructions: instructions.map((inst) => ({
        step: inst.step,
        text: inst.text,
        time_minutes: inst.time_minutes ?? null,
        temperature_celsius: inst.temperature_celsius ?? null,
        temperature_fahrenheit: inst.temperature_fahrenheit ?? null,
      })),
    };
  });

  // Compute stats
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const dietaryStats = { vegetarian: 0, vegan: 0, gluten_free: 0, lactose_free: 0, halal: 0 };

  for (const r of recipes) {
    // By category
    const cat = r.category || "Non classee";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    // By type
    const t = r.type || "both";
    byType[t] = (byType[t] || 0) + 1;
    // By difficulty
    const d = r.difficulty || "non defini";
    byDifficulty[d] = (byDifficulty[d] || 0) + 1;
    // Dietary
    if (r.is_vegetarian) dietaryStats.vegetarian++;
    if (r.is_vegan) dietaryStats.vegan++;
    if (r.is_gluten_free) dietaryStats.gluten_free++;
    if (r.is_lactose_free) dietaryStats.lactose_free++;
    if (r.is_halal) dietaryStats.halal++;
  }

  const exportData: OptiRecipeExport = {
    export_info: {
      date: new Date().toISOString(),
      total_recipes: exportRecipes.length,
      exported_by: "OptiRecipe",
      filters_applied: filtersApplied,
      stats: {
        by_category: byCategory,
        by_type: byType,
        by_difficulty: byDifficulty,
        dietary: dietaryStats,
      },
    },
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
      "original_title",
      "description",
      "image_url",
      "category",
      "sub_category",
      "servings",
      "prep_time_minutes",
      "cook_time_minutes",
      "difficulty",
      "type",
      "country",
      "region",
      "vegetarian",
      "vegan",
      "gluten_free",
      "lactose_free",
      "halal",
      "calories",
      "proteins",
      "carbs",
      "fats",
      "ingredients",
      "instructions",
    ].join(","));

    // Data rows
    for (const recipe of exportRecipes) {
      const row = [
        `"${(recipe.title || "").replace(/"/g, '""')}"`,
        `"${(recipe.original_title || "").replace(/"/g, '""')}"`,
        `"${(recipe.description || "").replace(/"/g, '""')}"`,
        `"${recipe.image_url || ""}"`,
        `"${recipe.category || ""}"`,
        `"${recipe.sub_category || ""}"`,
        recipe.servings,
        recipe.prep_time_minutes || "",
        recipe.cook_time_minutes || "",
        `"${recipe.difficulty || ""}"`,
        `"${recipe.type || ""}"`,
        `"${recipe.country || ""}"`,
        `"${recipe.region || ""}"`,
        recipe.dietary.vegetarian,
        recipe.dietary.vegan,
        recipe.dietary.gluten_free,
        recipe.dietary.lactose_free,
        recipe.dietary.halal,
        recipe.nutrition.calories || "",
        recipe.nutrition.proteins || "",
        recipe.nutrition.carbs || "",
        recipe.nutrition.fats || "",
        `"${recipe.ingredients.map((i) => `${i.quantity}${i.unit} ${i.name}`).join("; ").replace(/"/g, '""')}"`,
        `"${recipe.instructions.map((i) => `${i.step}. ${i.text}`).join(" ").replace(/"/g, '""')}"`,
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
