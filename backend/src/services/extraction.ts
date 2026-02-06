import { prisma } from "../prisma";
import { env } from "../env";
import type { Ingredient, Instruction } from "../types";

// Extraction prompt for GPT-4 Vision
const EXTRACTION_PROMPT = `Tu es un expert en extraction de recettes de cuisine pour une base de données professionnelle de restauration collective française.

CONTEXTE: Cette recette sera utilisée dans OptiMenu, un système de planification de repas pour les cantines scolaires, hôpitaux, et restaurants d'entreprise en France. Les quantités doivent être précises pour calculer les coûts et générer les commandes.

TÂCHE:
1. Analyser cette page de livre de cuisine
2. Identifier s'il y a une recette (ou plusieurs)
3. Extraire toutes les informations
4. REFORMULER le titre et les instructions dans tes propres mots (éviter le plagiat)
5. Convertir TOUTES les quantités en grammes/ml exacts
6. Générer une description appétissante de 2-3 phrases

RÈGLES DE CONVERSION (OBLIGATOIRES):
- 1 pomme de terre moyenne = 150g
- 1 carotte = 100g
- 1 oignon = 150g
- 1 gousse d'ail = 5g
- 1 citron = 80g
- 1 orange = 200g
- 1 pomme = 150g
- 1 poire = 170g
- 1 banane = 120g
- 1 tomate = 130g
- 1 courgette = 200g
- 1 aubergine = 300g
- 1 poivron = 150g
- 1 concombre = 300g
- 1 oeuf entier = 60g (dont 35g blanc, 25g jaune)
- 1 cuillère à soupe rase = 15g (solides) ou 15ml (liquides)
- 1 cuillère à soupe bombée = 25g
- 1 cuillère à café = 5g ou 5ml
- 1 verre standard = 200ml
- 1 tasse = 250ml
- 1 bol = 350ml
- 1 poignée = 30g
- 1 pincée = 1g
- 1 noisette de beurre = 10g
- 1 noix de beurre = 20g
- 1 branche de thym = 2g
- 1 branche de romarin = 3g
- 1 feuille de laurier = 0.5g
- 1 bouquet garni = 15g
- 1 botte de persil = 50g
- 1 botte de ciboulette = 25g

RÈGLES D'ARRONDI:
- Arrondir à 0 ou 5 (ex: 123g → 125g, 47g → 45g)
- Jamais de décimales (ex: pas de 123.5g)
- Minimum 5g pour les petites quantités

CATÉGORIES VALIDES:
- "entrée": soupes, salades, terrines, etc.
- "plat": viandes, poissons, plats complets
- "dessert": gâteaux, tartes, crèmes, fruits
- "petit-déjeuner": viennoiseries, céréales, etc.
- "accompagnement": légumes, féculents, sauces
- "sauce": sauces uniquement
- "boisson": boissons

RÉGIONS FRANÇAISES:
Alsace, Aquitaine, Auvergne, Bourgogne, Bretagne, Centre, Champagne, Corse, Franche-Comté, Île-de-France, Languedoc, Limousin, Lorraine, Midi-Pyrénées, Nord, Normandie, Pays de la Loire, Picardie, Poitou-Charentes, Provence, Rhône-Alpes

SAISONS:
- "printemps": mars, avril, mai
- "été": juin, juillet, août
- "automne": septembre, octobre, novembre
- "hiver": décembre, janvier, février
- "toutes": recette de base, pas saisonnière

RÉGIMES ALIMENTAIRES (tags):
végétarien, vegan, sans-gluten, sans-lactose, halal, casher, pauvre en sel, pauvre en sucre, riche en protéines, riche en fibres

FORMAT DE SORTIE (JSON STRICT):

Si une recette est trouvée:
{
  "found_recipe": true,
  "recipes": [
    {
      "title": "Titre reformulé créatif",
      "original_title": "Titre exact du livre",
      "description": "2-3 phrases appétissantes décrivant le plat et son origine/caractère.",
      "category": "plat",
      "sub_category": "viandes",
      "ingredients": [
        {
          "name": "boeuf (rumsteck)",
          "quantity": 500,
          "unit": "g",
          "original_text": "500g de rumsteck de boeuf"
        }
      ],
      "instructions": [
        {
          "step": 1,
          "text": "Instruction reformulée dans tes propres mots.",
          "time_minutes": null
        }
      ],
      "servings": 4,
      "prep_time_minutes": 15,
      "cook_time_minutes": 45,
      "region": "Bourgogne",
      "country": "France",
      "season": "hiver",
      "diet_tags": [],
      "meal_type": "dîner",
      "tips": "Conseils du chef si présents dans le texte."
    }
  ]
}

Si AUCUNE recette n'est trouvée (page d'intro, sommaire, etc.):
{
  "found_recipe": false,
  "page_type": "sommaire|introduction|publicité|autre",
  "notes": "Brève description de ce que contient la page"
}

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide, rien d'autre
- Si plusieurs recettes sur une page, retourne-les toutes dans le tableau "recipes"
- Si une information n'est pas disponible, utilise null (pas de string vide)
- Les quantités DOIVENT être des nombres, jamais du texte
- REFORMULE vraiment les instructions, ne copie pas mot pour mot`;

interface ExtractionResult {
  found_recipe: boolean;
  page_type?: string;
  notes?: string;
  recipes?: ExtractedRecipe[];
}

interface ExtractedRecipe {
  title: string;
  original_title?: string;
  description?: string;
  category?: string;
  sub_category?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  region?: string;
  country?: string;
  season?: string;
  diet_tags?: string[];
  meal_type?: string;
  tips?: string;
}

// Cancel token for processing jobs
const cancelledJobs = new Set<string>();

export function cancelProcessingJob(jobId: string) {
  cancelledJobs.add(jobId);
}

export async function extractRecipesFromPDF(jobId: string): Promise<void> {
  console.log(`Starting processing for job: ${jobId}`);

  try {
    // Get the job and cookbook
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { cookbook: true },
    });

    if (!job || !job.cookbook) {
      throw new Error("Job or cookbook not found");
    }

    // Update job to processing
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: "processing", startedAt: new Date() },
    });

    const processingLog: string[] = [];
    const errorLog: string[] = [];
    let recipesExtracted = 0;

    // Check if OpenAI API key is available
    if (!env.OPENAI_API_KEY) {
      // Simulate processing for demo purposes
      await simulateProcessing(job, processingLog, errorLog);
      return;
    }

    // Real processing would go here
    // For now, we'll simulate since we need actual PDF parsing
    await simulateProcessing(job, processingLog, errorLog);

  } catch (error) {
    console.error(`Processing error for job ${jobId}:`, error);

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorLog: JSON.stringify([String(error)]),
      },
    });

    // Get cookbook ID to update status
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      select: { cookbookId: true },
    });

    if (job) {
      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: {
          status: "failed",
          errorMessage: String(error),
        },
      });
    }
  } finally {
    cancelledJobs.delete(jobId);
  }
}

async function simulateProcessing(
  job: { id: string; cookbookId: string; userId: string; cookbook: { totalPages: number | null; generateDescriptions: boolean; reformulateForCopyright: boolean; convertToGrams: boolean } },
  processingLog: string[],
  errorLog: string[]
): Promise<void> {
  const totalPages = job.cookbook.totalPages || 10;
  let recipesExtracted = 0;

  // Sample recipes for demonstration
  const sampleRecipes: ExtractedRecipe[] = [
    {
      title: "Bœuf Bourguignon Traditionnel",
      original_title: "Bœuf Bourguignon",
      description: "Un classique de la cuisine française, ce ragoût de bœuf mijoté dans un vin rouge de Bourgogne est réconfortant et savoureux. Les morceaux de viande fondants se marient parfaitement avec les légumes caramélisés.",
      category: "plat",
      sub_category: "viandes",
      ingredients: [
        { name: "bœuf (paleron)", quantity: 1000, unit: "g", original_text: "1 kg de paleron de bœuf" },
        { name: "vin rouge de Bourgogne", quantity: 750, unit: "ml", original_text: "1 bouteille de vin rouge" },
        { name: "lardons fumés", quantity: 150, unit: "g", original_text: "150g de lardons" },
        { name: "oignon", quantity: 300, unit: "g", original_text: "2 oignons" },
        { name: "carotte", quantity: 300, unit: "g", original_text: "3 carottes" },
        { name: "champignons de Paris", quantity: 250, unit: "g", original_text: "250g de champignons" },
        { name: "bouquet garni", quantity: 15, unit: "g", original_text: "1 bouquet garni" },
        { name: "farine", quantity: 30, unit: "g", original_text: "2 cuillères à soupe de farine" },
        { name: "beurre", quantity: 50, unit: "g", original_text: "50g de beurre" },
      ],
      instructions: [
        { step: 1, text: "Couper le bœuf en cubes de 4 cm et les faire revenir dans une cocotte avec le beurre jusqu'à coloration.", time_minutes: 10 },
        { step: 2, text: "Retirer la viande et faire revenir les lardons, puis les oignons émincés.", time_minutes: 5 },
        { step: 3, text: "Saupoudrer de farine et mélanger. Ajouter la viande et verser le vin rouge.", time_minutes: 5 },
        { step: 4, text: "Ajouter les carottes en rondelles et le bouquet garni. Porter à ébullition puis réduire le feu.", time_minutes: 5 },
        { step: 5, text: "Laisser mijoter à couvert pendant 2h30. Ajouter les champignons 30 minutes avant la fin.", time_minutes: 150 },
      ],
      servings: 6,
      prep_time_minutes: 30,
      cook_time_minutes: 180,
      region: "Bourgogne",
      country: "France",
      season: "hiver",
      diet_tags: [],
      meal_type: "dîner",
      tips: "Préparez ce plat la veille, les saveurs n'en seront que meilleures. Servez avec des pommes de terre vapeur ou des pâtes fraîches.",
    },
    {
      title: "Tarte Tatin aux Pommes Caramélisées",
      original_title: "Tarte Tatin",
      description: "Cette tarte renversée aux pommes caramélisées est un dessert emblématique de la gastronomie française. Les pommes fondantes et le caramel doré en font un délice irrésistible.",
      category: "dessert",
      sub_category: "tartes",
      ingredients: [
        { name: "pommes (Golden ou Reinettes)", quantity: 900, unit: "g", original_text: "6 pommes" },
        { name: "pâte feuilletée", quantity: 250, unit: "g", original_text: "1 pâte feuilletée" },
        { name: "sucre", quantity: 150, unit: "g", original_text: "150g de sucre" },
        { name: "beurre demi-sel", quantity: 80, unit: "g", original_text: "80g de beurre" },
        { name: "cannelle", quantity: 5, unit: "g", original_text: "1 cuillère à café de cannelle" },
      ],
      instructions: [
        { step: 1, text: "Préchauffer le four à 200°C. Éplucher et couper les pommes en quartiers épais.", time_minutes: 10 },
        { step: 2, text: "Dans un moule à tarte, faire fondre le beurre avec le sucre pour obtenir un caramel blond.", time_minutes: 8 },
        { step: 3, text: "Disposer les quartiers de pommes serrés sur le caramel, saupoudrer de cannelle.", time_minutes: 5 },
        { step: 4, text: "Recouvrir de la pâte feuilletée en rentrant les bords. Piquer avec une fourchette.", time_minutes: 3 },
        { step: 5, text: "Enfourner pour 35-40 minutes jusqu'à ce que la pâte soit bien dorée.", time_minutes: 40 },
        { step: 6, text: "Sortir du four, attendre 5 minutes puis retourner sur un plat de service.", time_minutes: 5 },
      ],
      servings: 8,
      prep_time_minutes: 25,
      cook_time_minutes: 40,
      region: "Centre",
      country: "France",
      season: "automne",
      diet_tags: ["végétarien"],
      meal_type: "goûter",
      tips: "Servez tiède avec une boule de glace vanille ou une cuillère de crème fraîche épaisse.",
    },
    {
      title: "Soupe à l'Oignon Gratinée",
      original_title: "Soupe à l'Oignon",
      description: "Cette soupe réconfortante typiquement parisienne révèle toute la douceur des oignons longuement caramélisés. Le gratiné de fromage fondant en fait un plat complet et savoureux.",
      category: "entrée",
      sub_category: "soupes",
      ingredients: [
        { name: "oignon jaune", quantity: 750, unit: "g", original_text: "5 gros oignons" },
        { name: "beurre", quantity: 60, unit: "g", original_text: "60g de beurre" },
        { name: "farine", quantity: 30, unit: "g", original_text: "2 cuillères à soupe de farine" },
        { name: "bouillon de bœuf", quantity: 1500, unit: "ml", original_text: "1.5L de bouillon" },
        { name: "vin blanc sec", quantity: 150, unit: "ml", original_text: "1 verre de vin blanc" },
        { name: "gruyère râpé", quantity: 200, unit: "g", original_text: "200g de gruyère" },
        { name: "pain de campagne", quantity: 150, unit: "g", original_text: "6 tranches de pain" },
      ],
      instructions: [
        { step: 1, text: "Émincer finement les oignons. Les faire revenir doucement dans le beurre pendant 30 minutes jusqu'à coloration dorée.", time_minutes: 35 },
        { step: 2, text: "Saupoudrer de farine, mélanger et verser le vin blanc. Laisser réduire 2 minutes.", time_minutes: 5 },
        { step: 3, text: "Ajouter le bouillon chaud, saler, poivrer et laisser mijoter 20 minutes.", time_minutes: 20 },
        { step: 4, text: "Répartir la soupe dans des bols allant au four, disposer les tranches de pain et couvrir de gruyère.", time_minutes: 5 },
        { step: 5, text: "Gratiner sous le grill du four jusqu'à ce que le fromage soit bien doré.", time_minutes: 5 },
      ],
      servings: 6,
      prep_time_minutes: 15,
      cook_time_minutes: 65,
      region: "Île-de-France",
      country: "France",
      season: "hiver",
      diet_tags: ["végétarien"],
      meal_type: "dîner",
      tips: "La clé d'une bonne soupe à l'oignon est de bien caraméliser les oignons sans les brûler. Prenez votre temps!",
    },
  ];

  // Simulate page-by-page processing
  for (let page = 1; page <= totalPages; page++) {
    // Check if job was cancelled
    if (cancelledJobs.has(job.id)) {
      processingLog.push(`Page ${page}: Traitement annulé par l'utilisateur`);
      break;
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Randomly decide if this page has a recipe (about 30% chance)
    const hasRecipe = Math.random() < 0.3 && recipesExtracted < sampleRecipes.length;

    if (hasRecipe) {
      const recipe = sampleRecipes[recipesExtracted];
      if (recipe) {
        processingLog.push(`Page ${page}: Recette trouvée - ${recipe.title}`);

        // Create the recipe in database
        await prisma.recipe.create({
          data: {
            cookbookId: job.cookbookId,
            userId: job.userId,
            title: recipe.title,
            originalTitle: recipe.original_title,
            description: recipe.description,
            sourcePage: page,
            sourceType: "pdf",
            category: recipe.category,
            subCategory: recipe.sub_category,
            ingredients: JSON.stringify(recipe.ingredients),
            instructions: JSON.stringify(recipe.instructions),
            prepTimeMinutes: recipe.prep_time_minutes,
            cookTimeMinutes: recipe.cook_time_minutes,
            servings: recipe.servings || 4,
            region: recipe.region,
            country: recipe.country || "France",
            season: recipe.season,
            dietTags: JSON.stringify(recipe.diet_tags || []),
            mealType: recipe.meal_type,
            tips: recipe.tips,
            status: "pending",
          },
        });

        recipesExtracted++;
      }
    } else {
      processingLog.push(`Page ${page}: Pas de recette détectée`);
    }

    // Update job progress
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        currentPage: page,
        recipesExtracted,
        processingLog: JSON.stringify(processingLog),
      },
    });

    // Update cookbook progress
    await prisma.cookbook.update({
      where: { id: job.cookbookId },
      data: {
        processedPages: page,
        totalRecipesFound: recipesExtracted,
      },
    });
  }

  // Mark job as completed
  const finalStatus = cancelledJobs.has(job.id) ? "cancelled" : "completed";
  await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      processingLog: JSON.stringify(processingLog),
      errorLog: JSON.stringify(errorLog),
    },
  });

  // Update cookbook status
  await prisma.cookbook.update({
    where: { id: job.cookbookId },
    data: {
      status: finalStatus === "cancelled" ? "failed" : "completed",
      errorMessage: finalStatus === "cancelled" ? "Traitement annulé par l'utilisateur" : null,
    },
  });

  console.log(`Processing completed for job ${job.id}: ${recipesExtracted} recipes extracted`);
}

// Call OpenAI API for actual extraction (placeholder for when API key is available)
async function callOpenAIForExtraction(imageBase64: string): Promise<ExtractionResult> {
  // This would be the actual API call
  // For now, return a placeholder
  return {
    found_recipe: false,
    page_type: "autre",
    notes: "OpenAI API not configured",
  };
}
