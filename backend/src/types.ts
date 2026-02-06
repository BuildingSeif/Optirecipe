import { z } from "zod";

// ==================== Ingredient Schema ====================
export const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  original_text: z.string().optional(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

// ==================== Instruction Schema ====================
export const InstructionSchema = z.object({
  step: z.number(),
  text: z.string(),
  time_minutes: z.number().nullable().optional(),
});

export type Instruction = z.infer<typeof InstructionSchema>;

// ==================== Recipe Schemas ====================
export const RecipeStatusSchema = z.enum(["pending", "approved", "rejected", "needs_review"]);
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>;

export const RecipeCategorySchema = z.enum([
  "entrée",
  "plat",
  "dessert",
  "petit-déjeuner",
  "accompagnement",
  "sauce",
  "boisson",
]);
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;

export const SeasonSchema = z.enum(["printemps", "été", "automne", "hiver", "toutes"]);
export type Season = z.infer<typeof SeasonSchema>;

export const MealTypeSchema = z.enum(["déjeuner", "dîner", "petit-déjeuner", "goûter", "brunch"]);
export type MealType = z.infer<typeof MealTypeSchema>;

export const DietTagSchema = z.enum([
  "végétarien",
  "vegan",
  "sans-gluten",
  "sans-lactose",
  "halal",
  "casher",
  "pauvre en sel",
  "pauvre en sucre",
  "riche en protéines",
  "riche en fibres",
]);
export type DietTag = z.infer<typeof DietTagSchema>;

export const RegionSchema = z.enum([
  "Alsace",
  "Aquitaine",
  "Auvergne",
  "Bourgogne",
  "Bretagne",
  "Centre",
  "Champagne",
  "Corse",
  "Franche-Comté",
  "Île-de-France",
  "Languedoc",
  "Limousin",
  "Lorraine",
  "Midi-Pyrénées",
  "Nord",
  "Normandie",
  "Pays de la Loire",
  "Picardie",
  "Poitou-Charentes",
  "Provence",
  "Rhône-Alpes",
]);
export type Region = z.infer<typeof RegionSchema>;

export const CreateRecipeSchema = z.object({
  title: z.string().min(1),
  originalTitle: z.string().optional(),
  description: z.string().optional(),
  cookbookId: z.string().optional(),
  sourcePage: z.number().optional(),
  sourceType: z.string().default("pdf"),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  ingredients: z.array(IngredientSchema),
  instructions: z.array(InstructionSchema),
  prepTimeMinutes: z.number().optional(),
  cookTimeMinutes: z.number().optional(),
  servings: z.number().default(4),
  region: z.string().optional(),
  country: z.string().default("France"),
  season: z.string().optional(),
  dietTags: z.array(z.string()).default([]),
  mealType: z.string().optional(),
  tips: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>;

export const UpdateRecipeSchema = CreateRecipeSchema.partial().extend({
  status: RecipeStatusSchema.optional(),
  reviewNotes: z.string().optional(),
});

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeSchema>;

export const RecipeFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  cookbookId: z.string().optional(),
  season: z.string().optional(),
  dietTags: z.array(z.string()).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(["createdAt", "title", "category"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type RecipeFilters = z.infer<typeof RecipeFiltersSchema>;

// ==================== Cookbook Schemas ====================
export const CookbookStatusSchema = z.enum(["uploaded", "processing", "completed", "failed"]);
export type CookbookStatus = z.infer<typeof CookbookStatusSchema>;

export const CreateCookbookSchema = z.object({
  name: z.string().min(1),
  filePath: z.string(),
  fileSize: z.number().optional(),
  totalPages: z.number().optional(),
  generateDescriptions: z.boolean().default(true),
  reformulateForCopyright: z.boolean().default(true),
  convertToGrams: z.boolean().default(true),
});

export type CreateCookbookInput = z.infer<typeof CreateCookbookSchema>;

export const UpdateCookbookSchema = z.object({
  name: z.string().optional(),
  status: CookbookStatusSchema.optional(),
  processedPages: z.number().optional(),
  totalRecipesFound: z.number().optional(),
  errorMessage: z.string().optional(),
});

export type UpdateCookbookInput = z.infer<typeof UpdateCookbookSchema>;

// ==================== Processing Job Schemas ====================
export const ProcessingJobStatusSchema = z.enum(["pending", "processing", "completed", "failed", "cancelled"]);
export type ProcessingJobStatus = z.infer<typeof ProcessingJobStatusSchema>;

export const StartProcessingSchema = z.object({
  cookbookId: z.string(),
});

export type StartProcessingInput = z.infer<typeof StartProcessingSchema>;

// ==================== Export Schemas ====================
export const ExportFormatSchema = z.enum(["json", "csv"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportOptionsSchema = z.object({
  format: ExportFormatSchema.default("json"),
  recipeIds: z.array(z.string()).optional(), // If not provided, export all approved recipes
  includeAll: z.boolean().default(false), // Export all approved recipes
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

// ==================== Stats Response ====================
export interface DashboardStats {
  totalCookbooks: number;
  totalRecipes: number;
  pendingRecipes: number;
  approvedRecipes: number;
  rejectedRecipes: number;
  processingJobs: number;
}

// ==================== API Response Types ====================
export interface Recipe {
  id: string;
  cookbookId: string | null;
  userId: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  sourcePage: number | null;
  sourceType: string;
  category: string | null;
  subCategory: string | null;
  ingredients: Ingredient[];
  instructions: Instruction[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  region: string | null;
  country: string;
  season: string | null;
  dietTags: string[];
  mealType: string | null;
  tips: string | null;
  imageUrl: string | null;
  estimatedCostPerServing: number | null;
  status: RecipeStatus;
  reviewNotes: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cookbook?: Cookbook;
}

export interface Cookbook {
  id: string;
  userId: string;
  name: string;
  filePath: string;
  fileSize: number | null;
  totalPages: number | null;
  status: CookbookStatus;
  processedPages: number;
  totalRecipesFound: number;
  errorMessage: string | null;
  generateDescriptions: boolean;
  reformulateForCopyright: boolean;
  convertToGrams: boolean;
  createdAt: Date;
  updatedAt: Date;
  recipes?: Recipe[];
}

export interface ProcessingJob {
  id: string;
  cookbookId: string;
  userId: string;
  status: ProcessingJobStatus;
  currentPage: number;
  totalPages: number | null;
  recipesExtracted: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorLog: string[];
  processingLog: string[];
  createdAt: Date;
  cookbook?: Cookbook;
}

// ==================== 1000CHEFS Export Format ====================
export interface ChefExportIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface ChefExportInstruction {
  step: number;
  text: string;
}

export interface ChefExportMetadata {
  region: string | null;
  country: string;
  season: string | null;
  diet_tags: string[];
  meal_type: string | null;
}

export interface ChefExportRecipe {
  title: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  ingredients: ChefExportIngredient[];
  instructions: ChefExportInstruction[];
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  metadata: ChefExportMetadata;
  tips: string | null;
}

export interface ChefExport {
  export_date: string;
  recipe_count: number;
  recipes: ChefExportRecipe[];
}
