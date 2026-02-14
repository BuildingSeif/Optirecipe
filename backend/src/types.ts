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
  temperature_celsius: z.number().nullable().optional(),
  temperature_fahrenheit: z.number().nullable().optional(),
});

export type Instruction = z.infer<typeof InstructionSchema>;

// ==================== Recipe Schemas ====================
export const RecipeStatusSchema = z.enum(["pending", "approved", "rejected", "needs_review"]);
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>;

export const RecipeTypeSchema = z.enum(["prive", "collectivite", "both"]);
export type RecipeType = z.infer<typeof RecipeTypeSchema>;

export const DifficultySchema = z.enum(["facile", "moyen", "difficile"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

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
  difficulty: z.string().optional(),
  type: z.string().default("both"),
  region: z.string().optional(),
  country: z.string().default("France"),
  season: z.string().optional(),
  dietTags: z.array(z.string()).default([]),
  mealType: z.string().optional(),
  tips: z.string().optional(),
  imageUrl: z.string().optional(),
  is_vegetarian: z.boolean().default(false),
  is_vegan: z.boolean().default(false),
  is_gluten_free: z.boolean().default(false),
  is_lactose_free: z.boolean().default(false),
  is_halal: z.boolean().default(false),
  calories: z.number().optional(),
  proteins: z.number().optional(),
  carbs: z.number().optional(),
  fats: z.number().optional(),
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
  type: z.string().optional(),
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
  fileUrl: z.string().optional(), // Direct download URL for the PDF
  fileSize: z.number().optional(),
  totalPages: z.number().optional(),
  type: z.string().default("both"), // 'prive', 'collectivite', 'both'
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
  pinned: z.boolean().optional(),
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
  status: z.string().optional(),
  type: z.string().optional(), // 'prive', 'collectivite', 'both'
  cookbookId: z.string().optional(),
  category: z.string().optional(),
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
  processingCookbooks: number;
  completedCookbooks: number;
  failedCookbooks: number;
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
  difficulty: string | null;
  type: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  is_halal: boolean;
  calories: number | null;
  proteins: number | null;
  carbs: number | null;
  fats: number | null;
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
  fileUrl: string | null;
  fileSize: number | null;
  totalPages: number | null;
  status: CookbookStatus;
  processedPages: number;
  totalRecipesFound: number;
  errorMessage: string | null;
  generateDescriptions: boolean;
  reformulateForCopyright: boolean;
  convertToGrams: boolean;
  type: string;
  pinned: boolean;
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

// ==================== OptiRecipe Export Format ====================
export interface OptiRecipeExportInfo {
  date: string;
  total_recipes: number;
  exported_by: string;
  filters_applied: {
    status?: string;
    type?: string;
    cookbook?: string;
    category?: string;
  };
}

export interface OptiRecipeExportRecipe {
  title: string;
  original_title: string | null;
  description: string | null;
  image_url: string | null;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  difficulty: string | null;
  type: string;
  category: string | null;
  sub_category: string | null;
  country: string;
  region: string | null;
  dietary: {
    vegetarian: boolean;
    vegan: boolean;
    gluten_free: boolean;
    lactose_free: boolean;
    halal: boolean;
  };
  nutrition: {
    calories: number | null;
    proteins: number | null;
    carbs: number | null;
    fats: number | null;
  };
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    original_text: string | null;
  }>;
  instructions: Array<{
    step: number;
    text: string;
    time_minutes: number | null;
    temperature_celsius: number | null;
    temperature_fahrenheit: number | null;
  }>;
}

export interface OptiRecipeExport {
  export_info: OptiRecipeExportInfo;
  recipes: OptiRecipeExportRecipe[];
}

// ==================== Non-Recipe Content Schemas ====================
export const NonRecipeContentTypeSchema = z.enum([
  "technique",
  "intro",
  "tip",
  "glossary",
  "other",
]);
export type NonRecipeContentType = z.infer<typeof NonRecipeContentTypeSchema>;

export const NonRecipeContentFiltersSchema = z.object({
  cookbookId: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
export type NonRecipeContentFilters = z.infer<typeof NonRecipeContentFiltersSchema>;

export interface NonRecipeContent {
  id: string;
  cookbookId: string;
  userId: string;
  type: string;
  title: string | null;
  content: string;
  summary: string | null;
  page: number | null;
  bookName: string | null;
  createdAt: Date;
  cookbook?: { id: string; name: string };
}

// ==================== Image Generation Schemas ====================
export const GenerateImageRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;

export interface GenerateImageResponse {
  imageUrl: string;
}
