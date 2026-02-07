import { prisma } from "../prisma";
import { env } from "../env";
import { createVibecodeSDK } from "@vibecodeapp/backend-sdk";
import type { Ingredient, Instruction } from "../types";

// PDF processing imports
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";

// Initialize Vibecode SDK for file access
const vibecode = createVibecodeSDK();

// Image generation helper using Google Gemini API
async function generateRecipeImage(title: string, description?: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log("GOOGLE_API_KEY not configured, skipping image generation");
    return null;
  }

  const descriptionPart = description ? ` ${description}.` : "";
  const prompt = `Professional food photography of ${title}.${descriptionPart} Appetizing, high-quality, restaurant-style presentation on a clean plate, soft natural lighting, shallow depth of field.`;

  try {
    console.log(`Generating image for recipe: ${title}`);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error for recipe "${title}":`, errorText);
      return null;
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType?: string;
              data?: string;
            };
          }>;
        };
      }>;
    };

    const candidate = result.candidates?.[0];
    const inlineData = candidate?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data || !inlineData?.mimeType) {
      console.error(`Invalid Gemini response for recipe "${title}":`, JSON.stringify(result));
      return null;
    }

    // Return as data URL
    const imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
    console.log(`Successfully generated image for recipe: ${title}`);
    return imageUrl;
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

CATEGORIES VALIDES:
- "entree": soupes, salades, terrines, etc.
- "plat": viandes, poissons, plats complets
- "dessert": gateaux, tartes, cremes, fruits
- "petit-dejeuner": viennoiseries, cereales, etc.
- "accompagnement": legumes, feculents, sauces
- "sauce": sauces uniquement
- "boisson": boissons

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
      "meal_type": "diner",
      "tips": "Conseils du chef si presents dans le texte."
    }
  ]
}

Si AUCUNE recette n'est trouvee (page d'intro, sommaire, etc.):
{
  "found_recipe": false,
  "page_type": "sommaire|introduction|publicite|autre",
  "notes": "Breve description de ce que contient la page"
}

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide, rien d'autre
- Si plusieurs recettes sur une page, retourne-les toutes dans le tableau "recipes"
- Si une information n'est pas disponible, utilise null (pas de string vide)
- Les quantites DOIVENT etre des nombres, jamais du texte
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

// Rate limiting for OpenAI API
const RATE_LIMIT_DELAY_MS = 500; // Delay between API calls to avoid rate limits
const MAX_RETRIES = 3;
const MAX_RECIPES_PER_PDF = 100;

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
      const mostRecent = pdfFiles[pdfFiles.length - 1];
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

// Convert PDF page to base64 image using canvas rendering
async function renderPageToBase64(pdfDoc: pdfjs.PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdfDoc.getPage(pageNum);

  // Use a reasonable scale for good quality without excessive size
  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  // Create canvas using the canvas library (works in Node.js/Bun)
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  // Render PDF page to canvas
  // Cast to any to bypass type incompatibility between canvas lib and pdfjs
  const renderContext = {
    canvasContext: context as any,
    viewport: viewport,
  };

  await page.render(renderContext as any).promise;

  // Convert canvas to base64 PNG
  const base64 = canvas.toBuffer('image/png').toString('base64');

  return base64;
}

// Call OpenAI Vision API to extract recipes from a page image
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
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_completion_tokens: 4096,
          temperature: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle rate limiting
        if (response.status === 429) {
          console.log(`Rate limited on page ${pageNum}, waiting before retry...`);
          await delay(5000 * attempt); // Exponential backoff
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
          notes: `Error processing page: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      console.log(`Attempt ${attempt} failed for page ${pageNum}, retrying...`);
      await delay(2000 * attempt);
    }
  }

  return {
    found_recipe: false,
    page_type: 'error',
    notes: 'Failed to process page after retries',
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

      // Load PDF with pdf.js
      processingLog.push("Analyse du PDF...");
      const pdfData = new Uint8Array(pdfBuffer);
      const pdfDoc = await pdfjs.getDocument({ data: pdfData }).promise;
      const totalPages = pdfDoc.numPages;

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

      // Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        // Check if job was cancelled
        if (cancelledJobs.has(job.id)) {
          processingLog.push(`Page ${pageNum}: Traitement annule par l'utilisateur`);
          break;
        }

        // Check recipe limit
        if (recipesExtracted >= MAX_RECIPES_PER_PDF) {
          processingLog.push(`Limite de ${MAX_RECIPES_PER_PDF} recettes atteinte, arret du traitement`);
          break;
        }

        try {
          processingLog.push(`Page ${pageNum}/${totalPages}: Conversion en image...`);
          await updateJobProgress(job.id, job.cookbookId, pageNum, recipesExtracted, processingLog);

          // Render page to image
          const imageBase64 = await renderPageToBase64(pdfDoc, pageNum);

          processingLog.push(`Page ${pageNum}/${totalPages}: Analyse par IA...`);
          await updateJobProgress(job.id, job.cookbookId, pageNum, recipesExtracted, processingLog);

          // Call OpenAI Vision API
          const result = await callOpenAIVision(imageBase64, pageNum);

          // Rate limiting delay between pages
          await delay(RATE_LIMIT_DELAY_MS);

          if (result.found_recipe && result.recipes && result.recipes.length > 0) {
            for (const recipe of result.recipes) {
              // Check recipe limit before adding
              if (recipesExtracted >= MAX_RECIPES_PER_PDF) {
                break;
              }

              processingLog.push(`Page ${pageNum}: Recette trouvee - ${recipe.title}`);

              // Create the recipe in database
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
                  region: recipe.region,
                  country: recipe.country || "France",
                  season: recipe.season,
                  dietTags: JSON.stringify(recipe.diet_tags || []),
                  mealType: recipe.meal_type,
                  tips: recipe.tips,
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
          }

          // Update progress after each page
          await updateJobProgress(job.id, job.cookbookId, pageNum, recipesExtracted, processingLog);

        } catch (pageError) {
          const errorMsg = `Page ${pageNum}: Erreur - ${pageError instanceof Error ? pageError.message : String(pageError)}`;
          errorLog.push(errorMsg);
          processingLog.push(errorMsg);
          console.error(errorMsg);
          // Continue with next page
        }
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
