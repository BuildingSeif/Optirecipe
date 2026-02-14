import { prisma } from "../prisma";
import { env } from "../env";
import { createVibecodeSDK } from "@vibecodeapp/backend-sdk";
import type { Ingredient, Instruction } from "../types";
import { sendExtractionCompleteEmail } from "./email";

// PDF rendering - MuPDF (same engine as PyMuPDF used in working Python version)
import * as mupdf from "mupdf";

// Initialize Vibecode SDK for file access
const vibecode = createVibecodeSDK();

// Image generation helper using FAL AI Flux Pro v1.1
async function generateRecipeImage(title: string, description?: string): Promise<string | null> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.log("FAL_KEY not configured, skipping image generation");
    return null;
  }

  const descriptionPart = description ? ` ${description}.` : "";
  const prompt = `Professional food photography of ${title}.${descriptionPart} Appetizing presentation on a clean plate, soft natural lighting, top-down angle, French cuisine style, high-end restaurant quality. No text or watermarks.`;

  try {
    console.log(`Generating image for recipe: ${title}`);

    const response = await fetch(
      "https://fal.run/fal-ai/flux-pro/v1.1",
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_size: "square_hd",
          num_images: 1,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FAL AI error for recipe "${title}":`, errorText);
      return null;
    }

    const result = await response.json() as {
      images: Array<{ url: string }>;
    };

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0]!.url;
      console.log(`Successfully generated image for recipe: ${title}`);
      return imageUrl;
    }

    console.error(`No image generated for recipe "${title}"`);
    return null;
  } catch (error) {
    console.error(`Image generation error for recipe "${title}":`, error);
    return null;
  }
}

// Extraction prompt for GPT-4 Vision
const EXTRACTION_PROMPT = `Tu es un expert en extraction de recettes de cuisine pour une base de donnees professionnelle de restauration collective francaise.

CONTEXTE: Cette recette sera utilisee dans OptiMenu, un systeme de planification de repas pour les cantines scolaires, hopitaux, et restaurants d'entreprise en France. Les quantites doivent etre precises pour calculer les couts et generer les commandes.

TACHE:
1. Analyser cette page de livre de cuisine
2. Identifier s'il y a une recette (ou plusieurs)
3. Extraire toutes les informations
4. REFORMULER le titre et les instructions dans tes propres mots (eviter le plagiat)
5. Convertir TOUTES les quantites en grammes/ml exacts
6. Generer une description appetissante de 2-3 phrases

REGLES DE CONVERSION (OBLIGATOIRES):
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
- 1 cuillere a soupe rase = 15g (solides) ou 15ml (liquides)
- 1 cuillere a soupe bombee = 25g
- 1 cuillere a cafe = 5g ou 5ml
- 1 verre standard = 200ml
- 1 tasse = 250ml
- 1 bol = 350ml
- 1 poignee = 30g
- 1 pincee = 1g
- 1 noisette de beurre = 10g
- 1 noix de beurre = 20g
- 1 branche de thym = 2g
- 1 branche de romarin = 3g
- 1 feuille de laurier = 0.5g
- 1 bouquet garni = 15g
- 1 botte de persil = 50g
- 1 botte de ciboulette = 25g

REGLES D'ARRONDI:
- Arrondir a 0 ou 5 (ex: 123g -> 125g, 47g -> 45g)
- Jamais de decimales (ex: pas de 123.5g)
- Minimum 5g pour les petites quantites

CATEGORIES VALIDES (familles):
- "Entree": soupes, salades, crudites, terrines, feuilletes, tartes salees, verrines
- "Plat protidique": viandes (boeuf, volaille, poisson, porc, agneau, veau), oeufs, gibier, crustaces, plats vegetariens
- "Accompagnement": legumes, feculents, riz, pates, gratins, purees, poelees
- "Produit laitier": fromages, yaourts, faisselles
- "Dessert": gateaux, tartes, cremes, mousses, fruits, glaces, entremets, biscuits, verrines sucrees
- "Petit-dejeuner / Brunch": viennoiseries, pains, cereales, pancakes, gaufres
- "Gouter": biscuits, gateaux, fruits, laitages
- "Sauce": sauces chaudes, sauces froides, vinaigrettes, marinades
- "Base": pates de base, fonds, bouillons, cremes de base

IMPORTANT: Utilise EXACTEMENT ces noms de categories (familles) et les sous-categories correspondantes.
Le champ "category" doit contenir le nom de la famille (ex: "Plat protidique", "Dessert").
Le champ "sub_category" doit contenir la sous-famille (ex: "Volailles", "Gateaux").

REGIONS FRANCAISES:
Alsace, Aquitaine, Auvergne, Bourgogne, Bretagne, Centre, Champagne, Corse, Franche-Comte, Ile-de-France, Languedoc, Limousin, Lorraine, Midi-Pyrenees, Nord, Normandie, Pays de la Loire, Picardie, Poitou-Charentes, Provence, Rhone-Alpes

SAISONS:
- "printemps": mars, avril, mai
- "ete": juin, juillet, aout
- "automne": septembre, octobre, novembre
- "hiver": decembre, janvier, fevrier
- "toutes": recette de base, pas saisonniere

REGIMES ALIMENTAIRES (tags):
vegetarien, vegan, sans-gluten, sans-lactose, halal, casher, pauvre en sel, pauvre en sucre, riche en proteines, riche en fibres

NIVEAUX DE DIFFICULTE:
- "facile": recettes simples, peu d'etapes, ingredients basiques
- "moyen": technique moderee, plusieurs etapes
- "difficile": technique avancee, longue preparation, ingredients rares

DETECTION ET CONVERSION DES TEMPERATURES:
Detecte TOUTES les temperatures dans le texte, y compris les formats suivants:
- "180°C" → temperature_celsius: 180, temperature_fahrenheit: 356
- "four a 180 degres" → temperature_celsius: 180, temperature_fahrenheit: 356
- "350°F" → temperature_celsius: 177, temperature_fahrenheit: 350
- Thermostat (conversion obligatoire):
  Thermostat 1 = 30°C = 86°F
  Thermostat 2 = 60°C = 140°F
  Thermostat 3 = 90°C = 194°F
  Thermostat 4 = 120°C = 248°F
  Thermostat 5 = 150°C = 302°F
  Thermostat 6 = 180°C = 356°F
  Thermostat 7 = 210°C = 410°F
  Thermostat 8 = 240°C = 464°F
  Thermostat 9 = 270°C = 518°F
  Thermostat 10 = 300°C = 572°F

CHAQUE instruction contenant une temperature DOIT inclure temperature_celsius ET temperature_fahrenheit.
Formule de conversion: °F = (°C × 9/5) + 32, arrondi a l'entier le plus proche.

FORMAT DE SORTIE (JSON STRICT):

Si une recette est trouvee:
{
  "found_recipe": true,
  "recipes": [
    {
      "title": "Titre reformule creatif",
      "original_title": "Titre exact du livre",
      "description": "2-3 phrases appetissantes decrivant le plat et son origine/caractere.",
      "category": "plat",
      "sub_category": "viandes",
      "difficulty": "facile",
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
          "text": "Instruction reformulee dans tes propres mots.",
          "time_minutes": null,
          "temperature_celsius": 180,
          "temperature_fahrenheit": 356
        }
      ],
      "servings": 4,
      "prep_time_minutes": 15,
      "cook_time_minutes": 45,
      "region": "Bourgogne",
      "country": "France",
      "season": "hiver",
      "diet_tags": [],
      "meal_type": "diner",
      "tips": "Conseils du chef si presents dans le texte.",
      "dietary_flags": {
        "is_vegetarian": false,
        "is_vegan": false,
        "is_gluten_free": false,
        "is_lactose_free": false,
        "is_halal": false
      }
    }
  ]
}

Si AUCUNE recette n'est trouvee (page d'intro, sommaire, etc.):
{
  "found_recipe": false,
  "page_type": "sommaire|introduction|technique|conseil|astuce|glossaire|publicite|autre",
  "notes": "Resume detaille du contenu de la page: inclure les techniques, conseils, astuces, definitions, ou tout contenu utile present sur la page"
}

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide, rien d'autre
- Si plusieurs recettes sur une page, retourne-les toutes dans le tableau "recipes"
- Si une information n'est pas disponible, utilise null (pas de string vide)
- Les quantites DOIVENT etre des nombres, jamais du texte
- REFORMULE vraiment les instructions, ne copie pas mot pour mot
- Si la page semble etre la CONTINUATION d'une recette (pas de titre, commence par des instructions), indique-le dans le champ "notes" avec le prefixe "CONTINUATION:" suivi du contenu
- Extrais CHAQUE recette separement, meme si elles sont petites ou partielles
- Pour les temperatures de cuisson, inclus le champ temperature_celsius et temperature_fahrenheit dans chaque instruction (null si pas de temperature)
- Pour difficulty, evalue la difficulte globale: "facile", "moyen", ou "difficile"
- Pour dietary_flags, analyse les ingredients pour determiner les flags alimentaires (vegetarien, vegan, sans-gluten, sans-lactose, halal)`;

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
  difficulty?: string;
  region?: string;
  country?: string;
  season?: string;
  diet_tags?: string[];
  meal_type?: string;
  tips?: string;
  dietary_flags?: {
    is_vegetarian: boolean;
    is_vegan: boolean;
    is_gluten_free: boolean;
    is_lactose_free: boolean;
    is_halal: boolean;
  };
}

// Cancel token for processing jobs
const cancelledJobs = new Set<string>();

export function cancelProcessingJob(jobId: string) {
  cancelledJobs.add(jobId);
}

// Pause token for processing jobs
const pausedJobs = new Set<string>();

export function pauseProcessingJob(jobId: string) {
  pausedJobs.add(jobId);
}

export function resumeProcessingJob(jobId: string) {
  pausedJobs.delete(jobId);
}

// Rate limiting for OpenAI API
const RATE_LIMIT_DELAY_MS = 500; // Delay between API calls to avoid rate limits
const MAX_RETRIES = 3;
const MAX_RECIPES_PER_PDF = 500;
const BATCH_SIZE = 5; // Pages per batch for OpenAI PDF processing

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Normalize filename for comparison (remove special chars, lowercase)
function normalizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric
}

// Fetch PDF file from storage
async function fetchPDFFromStorage(filePath: string, fileUrl?: string | null): Promise<ArrayBuffer> {
  console.log(`Fetching PDF with filePath: ${filePath}, fileUrl: ${fileUrl || 'not provided'}`);

  // If we have a direct URL, use it
  if (fileUrl) {
    console.log(`Using direct URL: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  // Otherwise, list files to find the one matching our path
  const { files } = await vibecode.storage.list({ limit: 100 });
  console.log(`Available files in storage: ${files.map(f => f.originalFilename).join(', ')}`);

  // Extract filename from path and normalize it
  const pathFileName = filePath.split('/').pop() || '';
  const normalizedPathName = normalizeFilename(pathFileName);
  console.log(`Looking for file matching: ${pathFileName} (normalized: ${normalizedPathName})`);

  // Find file by multiple matching strategies
  const targetFile = files.find(f => {
    // Exact match on storage path
    if (f.storagePath === filePath) return true;

    // Exact match on original filename
    if (f.originalFilename === pathFileName) return true;

    // Normalized filename match (handles special chars and accents)
    const normalizedOriginal = normalizeFilename(f.originalFilename);
    if (normalizedOriginal === normalizedPathName) return true;

    // Partial normalized match (for cases where names are slightly different)
    if (normalizedOriginal.includes(normalizedPathName) || normalizedPathName.includes(normalizedOriginal)) return true;

    return false;
  });

  if (!targetFile) {
    // Last resort: find most recent PDF file
    const pdfFiles = files.filter(f => f.originalFilename.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 0) {
      // Sort by most recent (assuming files are returned in some order)
      const mostRecent = pdfFiles[pdfFiles.length - 1]!;
      console.log(`Using most recent PDF as fallback: ${mostRecent.originalFilename}`);
      const response = await fetch(mostRecent.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }

    throw new Error(`PDF file not found in storage: ${filePath}. Available files: ${files.map(f => f.originalFilename).join(', ')}`);
  }

  console.log(`Found file: ${targetFile.originalFilename} at ${targetFile.url}`);

  // Fetch the actual PDF file
  const response = await fetch(targetFile.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

// Render a single PDF page to a JPEG base64 string using MuPDF
function renderPageToJpegBase64(pdfBuffer: ArrayBuffer, pageNum: number): string {
  const doc = mupdf.Document.openDocument(Buffer.from(pdfBuffer), "application/pdf");
  const page = doc.loadPage(pageNum - 1); // 0-indexed

  // Scale 2x for good quality (matches Python's resolution=2.0)
  const scale = 2.0;
  const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB);
  const jpegBuffer = pixmap.asJPEG(90);

  return Buffer.from(jpegBuffer).toString("base64");
}

// Get total page count from PDF using MuPDF
function getPdfPageCount(pdfBuffer: ArrayBuffer): number {
  const doc = mupdf.Document.openDocument(Buffer.from(pdfBuffer), "application/pdf");
  return doc.countPages();
}

// Call OpenAI Vision API to extract recipes from a single page image
async function callOpenAIVision(imageBase64: string, pageNum: number): Promise<ExtractionResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: EXTRACTION_PROMPT,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_completion_tokens: 8192,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 429) {
          console.log(`Rate limited on page ${pageNum}, waiting before retry...`);
          await delay(5000 * attempt);
          continue;
        }

        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse JSON response - handle markdown code blocks
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();

      const result = JSON.parse(jsonContent) as ExtractionResult;
      return result;

    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`Failed to process page ${pageNum} after ${MAX_RETRIES} attempts:`, error);
        return {
          found_recipe: false,
          page_type: 'error',
          notes: `Error processing page ${pageNum}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      console.log(`Attempt ${attempt} failed for page ${pageNum}, retrying...`);
      await delay(2000 * attempt);
    }
  }

  return {
    found_recipe: false,
    page_type: 'error',
    notes: `Failed to process page ${pageNum} after retries`,
  };
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

    // Determine if this is a resume (currentPage > 0 means we already processed some pages)
    const isResume = (job.currentPage ?? 0) > 0;
    const startPage = isResume ? (job.currentPage ?? 0) + 1 : 1;

    // Update job to processing (only set startedAt on first run)
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "processing",
        ...(isResume ? {} : { startedAt: new Date() }),
      },
    });

    // Restore logs and count when resuming, otherwise start fresh
    const processingLog: string[] = isResume
      ? (() => { try { return JSON.parse(job.processingLog); } catch { return []; } })()
      : [];
    const errorLog: string[] = isResume
      ? (() => { try { return JSON.parse(job.errorLog); } catch { return []; } })()
      : [];
    let recipesExtracted = isResume ? (job.recipesExtracted ?? 0) : 0;

    if (isResume) {
      processingLog.push(`Reprise du traitement a partir de la page ${startPage}`);
    }

    // Check if OpenAI API key is available
    if (!env.OPENAI_API_KEY) {
      const errorMsg = "OPENAI_API_KEY is not configured. Cannot process PDF.";
      errorLog.push(errorMsg);
      processingLog.push(errorMsg);

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          completedAt: new Date(),
          processingLog: JSON.stringify(processingLog),
          errorLog: JSON.stringify(errorLog),
        },
      });

      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: {
          status: "failed",
          errorMessage: errorMsg,
        },
      });

      return;
    }

    try {
      // Fetch PDF from storage
      processingLog.push("Telechargement du PDF...");
      await updateJobProgress(job.id, job.cookbookId, 0, 0, processingLog);

      const pdfBuffer = await fetchPDFFromStorage(job.cookbook.filePath, job.cookbook.fileUrl);
      processingLog.push(`PDF telecharge: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

      // Get page count using MuPDF
      processingLog.push("Analyse du PDF...");
      const totalPages = getPdfPageCount(pdfBuffer);

      processingLog.push(`PDF charge: ${totalPages} pages detectees`);
      await updateJobProgress(job.id, job.cookbookId, 0, recipesExtracted, processingLog);

      // Update total pages in job and cookbook
      await prisma.processingJob.update({
        where: { id: jobId },
        data: { totalPages },
      });
      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: { totalPages },
      });

      // Process pages in batches of BATCH_SIZE (concurrent per batch, like Python version)
      for (let batchStart = startPage; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        // Check if job was cancelled
        if (cancelledJobs.has(job.id)) {
          processingLog.push(`Traitement annule par l'utilisateur`);
          break;
        }

        // Check if job was paused
        if (pausedJobs.has(job.id)) {
          processingLog.push(`Traitement mis en pause par l'utilisateur`);
          await updateJobProgress(job.id, job.cookbookId, batchStart - 1, recipesExtracted, processingLog);
          await prisma.processingJob.update({
            where: { id: job.id },
            data: { status: "paused" },
          });
          return;
        }

        // Check recipe limit
        if (recipesExtracted >= MAX_RECIPES_PER_PDF) {
          processingLog.push(`Limite de ${MAX_RECIPES_PER_PDF} recettes atteinte, arret du traitement`);
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        const batchPages = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

        processingLog.push(`Traitement des pages ${batchStart}-${batchEnd}/${totalPages}...`);
        await updateJobProgress(job.id, job.cookbookId, batchStart, recipesExtracted, processingLog);

        // Render each page to JPEG and call OpenAI Vision concurrently (like Python's asyncio.gather)
        const extractionPromises = batchPages.map(async (pageNum) => {
          try {
            const imageBase64 = renderPageToJpegBase64(pdfBuffer, pageNum);
            const result = await callOpenAIVision(imageBase64, pageNum);
            return { pageNum, result };
          } catch (err) {
            return { pageNum, result: { found_recipe: false, page_type: 'error', notes: `Render error: ${err instanceof Error ? err.message : String(err)}` } as ExtractionResult };
          }
        });
        const results = await Promise.allSettled(extractionPromises);

        // Process results in page order
        for (const settled of results) {
          if (settled.status === "rejected") {
            errorLog.push(`Page: Erreur - ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`);
            continue;
          }

          const { pageNum, result } = settled.value;

          if (result.found_recipe && result.recipes && result.recipes.length > 0) {
            for (const recipe of result.recipes) {
              if (recipesExtracted >= MAX_RECIPES_PER_PDF) break;

              processingLog.push(`Page ${pageNum}: Recette trouvee - ${recipe.title}`);

              const createdRecipe = await prisma.recipe.create({
                data: {
                  cookbookId: job.cookbookId,
                  userId: job.userId,
                  title: recipe.title,
                  originalTitle: recipe.original_title,
                  description: recipe.description,
                  sourcePage: pageNum,
                  sourceType: "pdf",
                  category: recipe.category,
                  subCategory: recipe.sub_category,
                  ingredients: JSON.stringify(recipe.ingredients),
                  instructions: JSON.stringify(recipe.instructions),
                  prepTimeMinutes: recipe.prep_time_minutes,
                  cookTimeMinutes: recipe.cook_time_minutes,
                  servings: recipe.servings || 4,
                  difficulty: recipe.difficulty,
                  type: job.cookbook.type || "both",
                  region: recipe.region,
                  country: recipe.country || "France",
                  season: recipe.season,
                  dietTags: JSON.stringify(recipe.diet_tags || []),
                  mealType: recipe.meal_type,
                  tips: recipe.tips,
                  is_vegetarian: recipe.dietary_flags?.is_vegetarian ?? false,
                  is_vegan: recipe.dietary_flags?.is_vegan ?? false,
                  is_gluten_free: recipe.dietary_flags?.is_gluten_free ?? false,
                  is_lactose_free: recipe.dietary_flags?.is_lactose_free ?? false,
                  is_halal: recipe.dietary_flags?.is_halal ?? false,
                  status: "approved",
                },
              });

              recipesExtracted++;

              // Generate image for the recipe (async, don't wait)
              generateRecipeImage(recipe.title, recipe.description)
                .then(async (imageUrl) => {
                  if (imageUrl) {
                    await prisma.recipe.update({
                      where: { id: createdRecipe.id },
                      data: { imageUrl },
                    });
                    console.log(`Image generated for recipe: ${recipe.title}`);
                  }
                })
                .catch((err) => {
                  console.error(`Failed to generate image for ${recipe.title}:`, err);
                });
            }
          } else {
            const pageType = result.page_type || "inconnu";
            const notes = result.notes ? ` - ${result.notes}` : "";
            processingLog.push(`Page ${pageNum}: Pas de recette (${pageType}${notes})`);

            // Store non-recipe content
            if (result.notes) {
              const pageTypeToContentType: Record<string, string> = {
                sommaire: "intro",
                introduction: "intro",
                technique: "technique",
                conseil: "tip",
                astuce: "tip",
                glossaire: "glossary",
              };
              const mappedType = pageTypeToContentType[pageType] || "other";

              await prisma.nonRecipeContent.create({
                data: {
                  cookbookId: job.cookbookId,
                  userId: job.userId,
                  type: mappedType,
                  title: result.page_type || null,
                  content: result.notes,
                  page: pageNum,
                  bookName: job.cookbook.name,
                },
              });
            }
          }
        }

        // Update progress after each batch
        await updateJobProgress(job.id, job.cookbookId, batchEnd, recipesExtracted, processingLog);

        // Small delay between batches to respect rate limits
        await delay(RATE_LIMIT_DELAY_MS);
      }

      // Mark job as completed
      const finalStatus = cancelledJobs.has(job.id) ? "cancelled" : "completed";
      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          currentPage: totalPages,
          recipesExtracted,
          processingLog: JSON.stringify(processingLog),
          errorLog: JSON.stringify(errorLog),
        },
      });

      // Update cookbook status
      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: {
          status: finalStatus === "cancelled" ? "failed" : "completed",
          processedPages: totalPages,
          totalRecipesFound: recipesExtracted,
          errorMessage: finalStatus === "cancelled" ? "Traitement annule par l'utilisateur" : null,
        },
      });

      console.log(`Processing completed for job ${job.id}: ${recipesExtracted} recipes extracted from ${totalPages} pages`);

      // Send email notification if extraction was successful (not cancelled)
      if (finalStatus === "completed" && recipesExtracted > 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: job.userId } });
          if (user?.email) {
            const appUrl = env.BACKEND_URL.replace(/:\d+$/, "").replace("preview-", "");
            await sendExtractionCompleteEmail(
              user.email,
              job.cookbook.name,
              recipesExtracted,
              totalPages,
              appUrl
            );
          }
        } catch (emailError) {
          console.error("Failed to send extraction email:", emailError);
          // Non-critical, don't fail the job
        }
      }

    } catch (pdfError) {
      const errorMsg = `Erreur PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`;
      errorLog.push(errorMsg);
      processingLog.push(errorMsg);

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          completedAt: new Date(),
          processingLog: JSON.stringify(processingLog),
          errorLog: JSON.stringify(errorLog),
        },
      });

      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: {
          status: "failed",
          errorMessage: errorMsg,
        },
      });

      throw pdfError;
    }

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
    pausedJobs.delete(jobId);
  }
}

// Helper function to update job progress
async function updateJobProgress(
  jobId: string,
  cookbookId: string,
  currentPage: number,
  recipesExtracted: number,
  processingLog: string[]
): Promise<void> {
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      currentPage,
      recipesExtracted,
      processingLog: JSON.stringify(processingLog),
    },
  });

  await prisma.cookbook.update({
    where: { id: cookbookId },
    data: {
      processedPages: currentPage,
      totalRecipesFound: recipesExtracted,
    },
  });
}
