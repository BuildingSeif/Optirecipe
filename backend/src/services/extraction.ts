import { prisma } from "../prisma";
import { env } from "../env";
import { createVibecodeSDK } from "@vibecodeapp/backend-sdk";
import type { Ingredient, Instruction } from "../types";
import { sendExtractionCompleteEmail } from "./email";
import { progressEmitter } from "./progress-emitter";
import * as fs from "node:fs";
import * as path from "node:path";

// PDF rendering - MuPDF (same engine as PyMuPDF used in working Python version)
import * as mupdf from "mupdf";

// Initialize Vibecode SDK for file access
const vibecode = createVibecodeSDK();

// ==================== UPGRADE #3: Intelligent Page Pre-filter Toggle ====================
const ENABLE_PAGE_PREFILTER = true;

// ==================== Image generation helper using FAL AI Flux Pro v1.1 ====================
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

// ==================== UPGRADE #5: Extraction Prompt V2 (augmented with confidence_score) ====================
const EXTRACTION_PROMPT = `Tu es un expert en extraction de recettes de cuisine pour une base de donnees professionnelle de restauration collective francaise.

CONTEXTE: Cette recette sera utilisee dans OptiMenu, un systeme de planification de repas pour les cantines scolaires, hopitaux, et restaurants d'entreprise en France. Les quantites doivent etre precises pour calculer les couts et generer les commandes.

TACHE:
1. Analyser cette page de livre de cuisine
2. Identifier s'il y a une recette (ou plusieurs)
3. Extraire toutes les informations
4. REFORMULER le titre et les instructions dans tes propres mots (eviter le plagiat)
5. Convertir TOUTES les quantites en grammes/ml exacts
6. Generer une description appetissante de 2-3 phrases
7. Evaluer ta confiance dans l'extraction (confidence_score)

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
- "180\u00b0C" \u2192 temperature_celsius: 180, temperature_fahrenheit: 356
- "four a 180 degres" \u2192 temperature_celsius: 180, temperature_fahrenheit: 356
- "350\u00b0F" \u2192 temperature_celsius: 177, temperature_fahrenheit: 350
- Thermostat (conversion obligatoire):
  Thermostat 1 = 30\u00b0C = 86\u00b0F
  Thermostat 2 = 60\u00b0C = 140\u00b0F
  Thermostat 3 = 90\u00b0C = 194\u00b0F
  Thermostat 4 = 120\u00b0C = 248\u00b0F
  Thermostat 5 = 150\u00b0C = 302\u00b0F
  Thermostat 6 = 180\u00b0C = 356\u00b0F
  Thermostat 7 = 210\u00b0C = 410\u00b0F
  Thermostat 8 = 240\u00b0C = 464\u00b0F
  Thermostat 9 = 270\u00b0C = 518\u00b0F
  Thermostat 10 = 300\u00b0C = 572\u00b0F

CHAQUE instruction contenant une temperature DOIT inclure temperature_celsius ET temperature_fahrenheit.
Formule de conversion: \u00b0F = (\u00b0C \u00d7 9/5) + 32, arrondi a l'entier le plus proche.

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
      "confidence_score": 85,
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
        "is_halal": false,
        "is_low_carb": false,
        "is_low_fat": false,
        "is_high_protein": true,
        "is_mediterranean": false,
        "is_whole30": false,
        "is_low_sodium": false
      }
    }
  ]
}

CONFIDENCE_SCORE: Evalue ta confiance dans cette extraction de 0 a 100.
- 100 = extraction parfaite, clairement une recette bien structuree
- 70-99 = bonne extraction, quelques informations peuvent manquer
- 50-69 = extraction incertaine, format inhabituel ou page partielle
- En dessous de 50 = tres incertain, pourrait ne pas etre une vraie recette

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
- RECETTES SUR PLUSIEURS PAGES: Si la page continue une recette commencee sur une page precedente (pas de nouveau titre, commence directement par des instructions, des ingredients supplementaires, ou la suite d'une preparation):
  * Mettre "found_recipe": true
  * Dans le tableau "recipes", creer une entree avec:
    - "title": le titre de la recette precedente si visible, sinon "CONTINUATION"
    - "is_continuation": true (champ special)
    - Les ingredients SUPPLEMENTAIRES trouves sur cette page uniquement
    - Les instructions SUPPLEMENTAIRES trouvees sur cette page uniquement
    - Tous les autres champs disponibles sur cette page
  * NE PAS mettre found_recipe: false pour les continuations - elles contiennent des donnees precieuses
- PLUSIEURS RECETTES PAR PAGE: Si une page contient plusieurs recettes (meme petites ou partielles), extraire CHAQUE recette dans le tableau "recipes"
- Pour les temperatures de cuisson, inclus le champ temperature_celsius et temperature_fahrenheit dans chaque instruction (null si pas de temperature)
- Pour difficulty, evalue la difficulte globale: "facile", "moyen", ou "difficile"
- Pour dietary_flags, analyse les ingredients pour determiner les flags alimentaires:
  * is_vegetarian: pas de viande ni poisson
  * is_vegan: aucun produit animal (viande, poisson, lait, oeufs, miel)
  * is_gluten_free: pas de ble, orge, seigle, avoine
  * is_lactose_free: pas de lait, fromage, creme, beurre
  * is_halal: pas de porc ni alcool
  * is_low_carb: true si PAUVRE en glucides (pas de pates, riz, pain, pommes de terre, sucre comme ingredients principaux)
  * is_low_fat: true si PAUVRE en graisses (pas de creme epaisse, beurre, huile comme ingredients principaux)
  * is_high_protein: true si RICHE en proteines (viande, poisson, oeufs, legumineuses comme ingredient principal)
  * is_mediterranean: true si style mediterraneen (huile d'olive, poisson, legumes, herbes)
  * is_whole30: true si conforme Whole30 (pas de sucre, alcool, cereales, legumineuses, produits laitiers)
  * is_low_sodium: true si pas de sel ajoute ni ingredients riches en sodium
- Pour meal_type, utilise EXACTEMENT ces valeurs:
  * "petit_dejeuner": petit-dejeuner (oeufs, viennoiseries, cereales, pancakes)
  * "dejeuner": dejeuner (salades, sandwiches, plats principaux legers)
  * "diner": diner (plats principaux, repas plus consistants)
  * "collation": gouters, snacks, bouchees legeres, appetizers`;

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
  is_continuation?: boolean;
  confidence_score?: number;
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
    is_low_carb: boolean;
    is_low_fat: boolean;
    is_high_protein: boolean;
    is_mediterranean: boolean;
    is_whole30: boolean;
    is_low_sodium: boolean;
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
const MAX_RECIPES_PER_PDF = 2000;
const BATCH_SIZE = 5; // Pages per batch for OpenAI PDF processing

// Global extraction queue -- smart concurrency for multi-user scale
const extractionQueue: string[] = [];
let largeRunning = 0;
let smallRunning = 0;
const SMALL_PDF_THRESHOLD = 20; // Pages -- PDFs this size or smaller use the fast lane
const MAX_LARGE_CONCURRENT = 2;  // Max large PDFs extracting at once (reduced for memory safety)
const MAX_SMALL_CONCURRENT = 5;  // Max small PDFs extracting at once

async function processExtractionQueue(): Promise<void> {
  // Launch as many queued jobs as slots allow
  while (extractionQueue.length > 0 && largeRunning < MAX_LARGE_CONCURRENT) {
    const jobId = extractionQueue.shift()!;
    largeRunning++;
    console.log(`[Queue] Starting large extraction for job ${jobId} (${largeRunning}/${MAX_LARGE_CONCURRENT} slots, ${extractionQueue.length} queued)`);
    extractRecipesFromPDFInternal(jobId)
      .catch((error) => {
        console.error(`[Queue] Extraction failed for job ${jobId}:`, error);
      })
      .finally(() => {
        largeRunning--;
        console.log(`[Queue] Large slot freed (${largeRunning}/${MAX_LARGE_CONCURRENT} active, ${extractionQueue.length} queued)`);
        // Try to start next queued job
        processExtractionQueue().catch(() => {});
      });
  }
}

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

// ==================== UPGRADE #8: Memory-Safe Streaming for 500MB+ PDFs ====================
// Downloads PDF to a temp file on disk instead of holding entire ArrayBuffer in memory.
// Returns the file path string.
async function fetchPDFFromStorage(filePath: string, fileUrl?: string | null, jobId?: string): Promise<string> {
  const tempPath = path.join("/tmp", `pdf-extract-${jobId || Date.now()}.pdf`);
  console.log(`Fetching PDF with filePath: ${filePath}, fileUrl: ${fileUrl || 'not provided'}, tempPath: ${tempPath}`);

  // Helper: stream response body to temp file
  async function downloadToFile(response: Response): Promise<string> {
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
    return tempPath;
  }

  // If we have a direct URL, use it
  if (fileUrl) {
    console.log(`Using direct URL: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
    }
    return await downloadToFile(response);
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
      return await downloadToFile(response);
    }

    throw new Error(`PDF file not found in storage: ${filePath}. Available files: ${files.map(f => f.originalFilename).join(', ')}`);
  }

  console.log(`Found file: ${targetFile.originalFilename} at ${targetFile.url}`);

  // Fetch the actual PDF file
  const response = await fetch(targetFile.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }

  return await downloadToFile(response);
}

// Cleanup temp file helper
function cleanupTempFile(tempPath: string): void {
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log(`[Cleanup] Deleted temp file: ${tempPath}`);
    }
  } catch (err) {
    console.error(`[Cleanup] Failed to delete temp file ${tempPath}:`, err);
  }
}

// ==================== UPGRADE #1: Adaptive Rendering Quality ====================
function getAdaptiveScale(pageNum: number, totalPages: number, fileSize: number): { scale: number; jpegQuality: number } {
  if (totalPages < 50) {
    return { scale: 2.0, jpegQuality: 90 };
  } else if (totalPages < 200) {
    return { scale: 1.8, jpegQuality: 85 };
  } else if (totalPages < 500) {
    return { scale: 1.5, jpegQuality: 80 };
  } else {
    return { scale: 1.3, jpegQuality: 75 };
  }
}

// Render a single PDF page to a JPEG base64 string using MuPDF
function renderPageToJpegBase64(pdfBuffer: ArrayBuffer, pageNum: number): string {
  const doc = mupdf.Document.openDocument(Buffer.from(pdfBuffer), "application/pdf");
  try {
    const page = doc.loadPage(pageNum - 1); // 0-indexed
    const scale = 2.0;
    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB);
    const jpegBuffer = pixmap.asJPEG(90);
    return Buffer.from(jpegBuffer).toString("base64");
  } finally {
    doc.destroy();
  }
}

// Render multiple pages from an already-opened document (batch-aware, avoids reopening PDF per page)
// UPGRADE #1: Now uses adaptive scale/quality based on PDF size
function renderPagesFromDoc(
  doc: mupdf.Document,
  pageNums: number[],
  totalPages: number,
  fileSize: number,
  jpegQualityOverride?: number,
): Map<number, string> {
  const results = new Map<number, string>();
  for (const pageNum of pageNums) {
    try {
      const { scale, jpegQuality: adaptiveQuality } = getAdaptiveScale(pageNum, totalPages, fileSize);
      const quality = jpegQualityOverride ?? adaptiveQuality;
      const page = doc.loadPage(pageNum - 1); // 0-indexed
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB);
      const jpegBuffer = pixmap.asJPEG(quality);
      results.set(pageNum, Buffer.from(jpegBuffer).toString("base64"));
    } catch (err) {
      console.error(`[Extraction] Failed to render page ${pageNum}:`, err);
    }
  }
  return results;
}

// Get total page count from PDF using MuPDF
function getPdfPageCount(pdfBuffer: Buffer): number {
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  try {
    return doc.countPages();
  } finally {
    doc.destroy();
  }
}

// ==================== UPGRADE #3: Intelligent Page Pre-filter ====================
async function classifyPageCheap(imageBase64: string, pageNum: number): Promise<"recipe" | "skip" | "uncertain"> {
  if (!env.OPENAI_API_KEY) {
    return "uncertain"; // Can't classify without API key, proceed with full extraction
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Is this a cookbook recipe page? Answer ONLY: recipe, skip, or uncertain. Skip = table of contents, blank, copyright, ads, section dividers, index.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_completion_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout for pre-filter
    });

    if (!response.ok) {
      // If pre-filter fails, proceed with full extraction
      return "uncertain";
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    if (content.includes("skip")) return "skip";
    if (content.includes("recipe")) return "recipe";
    return "uncertain";
  } catch (err) {
    console.error(`[PreFilter] Error classifying page ${pageNum}:`, err);
    return "uncertain"; // On error, proceed with full extraction
  }
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
        signal: AbortSignal.timeout(90000), // 90 second timeout per page
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 429) {
          console.log(`Rate limited on page ${pageNum}, waiting before retry...`);
          await delay(5000 * attempt);
          continue;
        }

        // Credit exhaustion -- no point retrying, fail fast with clear message
        if (response.status === 402) {
          const msg = `OpenAI API credit exhaustion (402) on page ${pageNum}. Top up your API credits and re-extract.`;
          console.error(msg);
          return {
            found_recipe: false,
            page_type: 'error',
            notes: msg,
          };
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

// ==================== UPGRADE #10: Automatic Quality Checks ====================
interface RecipeValidationResult {
  valid: boolean;
  issues: string[];
  qualityScore: number;
}

function validateRecipe(recipe: ExtractedRecipe): RecipeValidationResult {
  const issues: string[] = [];
  let qualityScore = 100;
  let valid = true;

  // Must have at least 1 ingredient
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    issues.push("No ingredients found");
    valid = false;
  }

  // Must have at least 1 instruction step
  if (!recipe.instructions || recipe.instructions.length === 0) {
    issues.push("No instructions found");
    valid = false;
  }

  // Title must not be empty or "CONTINUATION"
  if (!recipe.title || recipe.title.trim() === "" || recipe.title === "CONTINUATION") {
    issues.push("Title is empty or is a continuation marker");
    valid = false;
  }

  // Check ingredient quantities (flag if not valid, but still valid overall)
  if (recipe.ingredients) {
    const hasQuantityIssues = recipe.ingredients.some(i => !i.quantity || i.quantity <= 0);
    if (hasQuantityIssues) {
      issues.push("Some ingredients have missing or zero quantities");
    }
  }

  // Check for placeholder instructions like "voir page X"
  if (recipe.instructions) {
    const placeholderPattern = /^voir\s+page/i;
    const hasPlaceholders = recipe.instructions.some(i => placeholderPattern.test(i.text));
    if (hasPlaceholders) {
      issues.push("Instructions contain page references instead of real steps");
    }
  }

  // Quality score deductions for missing fields
  if (!recipe.description) {
    qualityScore -= 20;
    issues.push("Missing description (-20)");
  }
  if (!recipe.category) {
    qualityScore -= 20;
    issues.push("Missing category (-20)");
  }
  if (!recipe.servings) {
    qualityScore -= 20;
    issues.push("Missing servings (-20)");
  }
  if (!recipe.difficulty) {
    qualityScore -= 20;
    issues.push("Missing difficulty (-20)");
  }

  // Ensure score does not go below 0
  qualityScore = Math.max(0, qualityScore);

  return { valid, issues, qualityScore };
}

// ==================== UPGRADE #4: Recipe Deduplication Engine ====================
function normalizeForDedup(text: string): string {
  const stopWords = new Set(["de", "la", "le", "du", "des", "aux", "a", "au", "les", "un", "une", "et", "en", "l"]);
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove non-alphanumeric except spaces
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w))
    .join(" ");
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 0));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 0));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

async function deduplicateRecipes(cookbookId: string): Promise<number> {
  const recipes = await prisma.recipe.findMany({
    where: { cookbookId },
    select: {
      id: true,
      title: true,
      ingredients: true,
      instructions: true,
    },
  });

  if (recipes.length < 2) return 0;

  // Normalize titles for comparison
  const normalizedRecipes = recipes.map(r => ({
    ...r,
    normalizedTitle: normalizeForDedup(r.title),
  }));

  const toDelete = new Set<string>();

  for (let i = 0; i < normalizedRecipes.length; i++) {
    const recipeA = normalizedRecipes[i]!;
    if (toDelete.has(recipeA.id)) continue;

    for (let j = i + 1; j < normalizedRecipes.length; j++) {
      const recipeB = normalizedRecipes[j]!;
      if (toDelete.has(recipeB.id)) continue;

      const similarity = jaccardSimilarity(recipeA.normalizedTitle, recipeB.normalizedTitle);

      if (similarity > 0.8) {
        // Keep the one with more content (ingredients + instructions)
        let ingredientsA: unknown[] = [];
        let ingredientsB: unknown[] = [];
        let instructionsA: unknown[] = [];
        let instructionsB: unknown[] = [];
        try { ingredientsA = JSON.parse(recipeA.ingredients); } catch {}
        try { ingredientsB = JSON.parse(recipeB.ingredients); } catch {}
        try { instructionsA = JSON.parse(recipeA.instructions); } catch {}
        try { instructionsB = JSON.parse(recipeB.instructions); } catch {}

        const scoreA = ingredientsA.length + instructionsA.length;
        const scoreB = ingredientsB.length + instructionsB.length;

        if (scoreA >= scoreB) {
          toDelete.add(recipeB.id);
          console.log(`[Dedup] Removing duplicate "${recipeB.title}" (keeping "${recipeA.title}", similarity=${(similarity * 100).toFixed(0)}%)`);
        } else {
          toDelete.add(recipeA.id);
          console.log(`[Dedup] Removing duplicate "${recipeA.title}" (keeping "${recipeB.title}", similarity=${(similarity * 100).toFixed(0)}%)`);
          break; // recipeA is now marked for deletion, stop comparing it
        }
      }
    }
  }

  if (toDelete.size > 0) {
    await prisma.recipe.deleteMany({
      where: { id: { in: Array.from(toDelete) } },
    });
    console.log(`[Dedup] Removed ${toDelete.size} duplicate recipe(s) from cookbook ${cookbookId}`);
  }

  return toDelete.size;
}

// Throttled image generation queue
interface ImageGenTask {
  recipeId: string;
  title: string;
  description?: string;
}

const imageGenerationQueue: ImageGenTask[] = [];
let imageGenRunning = false;

async function processImageQueue(): Promise<void> {
  if (imageGenRunning) return;
  imageGenRunning = true;

  while (imageGenerationQueue.length > 0) {
    const batch = imageGenerationQueue.splice(0, 2); // 2 at a time
    await Promise.allSettled(
      batch.map(async (task) => {
        try {
          const imageUrl = await generateRecipeImage(task.title, task.description);
          if (imageUrl) {
            await prisma.recipe.update({
              where: { id: task.recipeId },
              data: { imageUrl },
            });
            console.log(`[ImageGen] Image saved for: ${task.title}`);
          }
        } catch (err) {
          console.error(`[ImageGen] Failed for ${task.title}:`, err);
        }
      })
    );
    await delay(1000); // 1s between batches
  }

  imageGenRunning = false;
}

/**
 * Recover missing recipe images after server restart.
 * Finds all recipes with no imageUrl and queues them for generation.
 * Should be called on startup with a delay to avoid competing with extraction recovery.
 */
export async function recoverMissingImages(): Promise<number> {
  try {
    const recipesWithoutImages = await prisma.recipe.findMany({
      where: { imageUrl: null },
      select: { id: true, title: true, description: true },
    });

    if (recipesWithoutImages.length === 0) {
      console.log("[ImageRecovery] All recipes have images, nothing to recover.");
      return 0;
    }

    console.log(`[ImageRecovery] Found ${recipesWithoutImages.length} recipe(s) missing images, queuing for generation...`);

    for (const recipe of recipesWithoutImages) {
      imageGenerationQueue.push({
        recipeId: recipe.id,
        title: recipe.title,
        description: recipe.description ?? undefined,
      });
    }

    // Kick off the queue processing (non-blocking)
    processImageQueue().catch((err) => {
      console.error("[ImageRecovery] Queue processing error:", err);
    });

    return recipesWithoutImages.length;
  } catch (error) {
    console.error("[ImageRecovery] Error recovering missing images:", error);
    return 0;
  }
}

// Memory monitoring for large PDF processing
function logMemoryUsage(jobId: string, context: string): void {
  const used = process.memoryUsage();
  const heapMB = Math.round(used.heapUsed / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  console.log(`[Memory] Job ${jobId} (${context}): heap=${heapMB}MB rss=${rssMB}MB`);
}

export async function extractRecipesFromPDF(jobId: string): Promise<void> {
  // Check if this is a small PDF that can use the fast lane
  try {
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { cookbook: { select: { totalPages: true, fileSize: true, name: true } } },
    });

    const pageCount = job?.cookbook?.totalPages || 0;
    const fileSize = job?.cookbook?.fileSize || 0;
    const isSmallByPages = pageCount > 0 && pageCount <= SMALL_PDF_THRESHOLD;
    const isSmallBySize = fileSize > 0 && fileSize < 5 * 1024 * 1024; // Under 5MB

    // Small PDFs use capped fast lane (max MAX_SMALL_CONCURRENT at once)
    if (isSmallByPages || isSmallBySize) {
      if (smallRunning >= MAX_SMALL_CONCURRENT) {
        // Fast lane full -- queue it with large PDFs instead of dropping
        console.log(`[Queue] Small PDF fast lane full (${smallRunning}/${MAX_SMALL_CONCURRENT}), queuing "${job?.cookbook?.name}"`);
      } else {
        const reason = isSmallByPages ? `${pageCount} pages` : `${(fileSize / 1024 / 1024).toFixed(1)}MB`;
        console.log(`[Queue] Small PDF "${job?.cookbook?.name}" (${reason}) -- fast lane (${smallRunning + 1}/${MAX_SMALL_CONCURRENT})`);
        smallRunning++;
        extractRecipesFromPDFInternal(jobId)
          .catch((err) => {
            console.error(`[Queue] Small PDF extraction failed for job ${jobId}:`, err);
          })
          .finally(() => {
            smallRunning--;
          });
        return;
      }
    }
  } catch {
    // If we can't check, fall through to queue
  }

  // Large PDFs (or overflow from small lane) go through the concurrent queue
  extractionQueue.push(jobId);
  console.log(`[Queue] Job ${jobId} added to extraction queue (position ${extractionQueue.length})`);
  processExtractionQueue().catch((err) => {
    console.error("[Queue] Queue processing error:", err);
  });
}

// ==================== UPGRADE #9: Cost Tracking ====================
interface CostTracker {
  openaiCalls: number;
  prefilterCalls: number;
  pagesSkipped: number;
  recipesValidated: number;
  recipesNeedsReview: number;
  duplicatesRemoved: number;
}

async function extractRecipesFromPDFInternal(jobId: string): Promise<void> {
  console.log(`Starting processing for job: ${jobId}`);
  let tempFilePath: string | null = null;

  // UPGRADE #9: Cost tracking
  const costTracker: CostTracker = {
    openaiCalls: 0,
    prefilterCalls: 0,
    pagesSkipped: 0,
    recipesValidated: 0,
    recipesNeedsReview: 0,
    duplicatesRemoved: 0,
  };

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
    let failedPages = isResume ? (job.failedPages ?? 0) : 0;

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
      // UPGRADE #8: Fetch PDF to temp file on disk
      processingLog.push("Telechargement du PDF...");
      await updateJobProgress(job.id, job.cookbookId, 0, 0, processingLog, false, failedPages);

      tempFilePath = await fetchPDFFromStorage(job.cookbook.filePath, job.cookbook.fileUrl, job.id);
      const fileStats = fs.statSync(tempFilePath);
      const fileSizeMB = fileStats.size / 1024 / 1024;
      processingLog.push(`PDF telecharge: ${fileSizeMB.toFixed(2)} MB`);

      // Get page count using MuPDF (read from temp file per batch)
      processingLog.push("Analyse du PDF...");
      const pdfNodeBuffer = fs.readFileSync(tempFilePath);
      const totalPages = getPdfPageCount(pdfNodeBuffer);
      const fileSize = fileStats.size;

      processingLog.push(`PDF charge: ${totalPages} pages detectees`);
      await updateJobProgress(job.id, job.cookbookId, 0, recipesExtracted, processingLog, false, failedPages);

      // Update total pages in job and cookbook
      await prisma.processingJob.update({
        where: { id: jobId },
        data: { totalPages },
      });
      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: { totalPages },
      });

      // UPGRADE #1: Adaptive quality based on PDF size
      const { jpegQuality: adaptiveJpegQuality } = getAdaptiveScale(1, totalPages, fileSize);
      if (totalPages > 50) {
        console.log(`[Extraction] Job ${job.id}: PDF (${totalPages} pages), using adaptive JPEG quality ${adaptiveJpegQuality}`);
      }

      // Track last created recipe ID for merging multi-page continuations
      let lastCreatedRecipeId: string | null = null;

      // UPGRADE #2: Pipeline Architecture - Pre-render first batch before the loop
      let preRenderedPages: Map<number, string> | null = null;

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
          await updateJobProgress(job.id, job.cookbookId, batchStart - 1, recipesExtracted, processingLog, true, failedPages);
          await prisma.processingJob.update({
            where: { id: job.id },
            data: { status: "paused" },
          });
          try {
            progressEmitter.emit({
              type: "paused",
              jobId: job.id,
              cookbookId: job.cookbookId,
              data: { currentPage: batchStart - 1, recipesExtracted },
              timestamp: Date.now(),
            });
          } catch {}
          return;
        }

        // Check recipe limit
        if (recipesExtracted >= MAX_RECIPES_PER_PDF) {
          processingLog.push(`Limite de ${MAX_RECIPES_PER_PDF} recettes atteinte, arret du traitement`);
          break;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        const batchPages = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

        console.log(`[Extraction] Job ${job.id}: Processing pages ${batchStart}-${batchEnd}/${totalPages} (${recipesExtracted} recipes so far)`);

        // Cap processing log to last 200 entries to prevent unbounded growth on large PDFs
        if (processingLog.length > 200) {
          const removed = processingLog.length - 150;
          processingLog.splice(0, removed);
          processingLog.unshift(`[...${removed} entrees precedentes supprimees]`);
        }

        processingLog.push(`Traitement des pages ${batchStart}-${batchEnd}/${totalPages}...`);
        await updateJobProgress(job.id, job.cookbookId, batchStart, recipesExtracted, processingLog, false, failedPages);

        // UPGRADE #2: Pipeline Architecture
        // Use pre-rendered pages from previous iteration, or render this batch now
        let renderedPages: Map<number, string>;
        if (preRenderedPages !== null) {
          renderedPages = preRenderedPages;
          preRenderedPages = null;
        } else {
          // First batch or fallback: render synchronously
          try {
            const batchBuffer = fs.readFileSync(tempFilePath);
            const doc = mupdf.Document.openDocument(batchBuffer, "application/pdf");
            try {
              renderedPages = renderPagesFromDoc(doc, batchPages, totalPages, fileSize);
            } finally {
              doc.destroy();
            }
          } catch (err) {
            const errMsg = `Failed to open PDF for pages ${batchStart}-${batchEnd}: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[Extraction] ${errMsg}`);
            errorLog.push(errMsg);
            continue; // Skip this batch, try next
          }
        }

        // UPGRADE #3: Intelligent Page Pre-filter
        // Classify pages cheaply before sending to full GPT-5.2
        let pagesToProcess = batchPages;
        if (ENABLE_PAGE_PREFILTER) {
          const classificationResults = await Promise.allSettled(
            batchPages.map(async (pageNum) => {
              const imageBase64 = renderedPages.get(pageNum);
              if (!imageBase64) return { pageNum, classification: "uncertain" as const };
              costTracker.prefilterCalls++;
              const classification = await classifyPageCheap(imageBase64, pageNum);
              return { pageNum, classification };
            })
          );

          const skipPages = new Set<number>();
          for (const settled of classificationResults) {
            if (settled.status === "fulfilled" && settled.value.classification === "skip") {
              skipPages.add(settled.value.pageNum);
              costTracker.pagesSkipped++;
              console.log(`[PreFilter] Page ${settled.value.pageNum}: skipped (non-recipe content)`);
              processingLog.push(`Page ${settled.value.pageNum}: Pre-filtre - contenu non-recette, ignore`);
              try {
                progressEmitter.emit({
                  type: "page_skipped",
                  jobId: job.id,
                  cookbookId: job.cookbookId,
                  data: { page: settled.value.pageNum, reason: "pre-filter" },
                  timestamp: Date.now(),
                });
              } catch {}
            }
          }

          if (skipPages.size > 0) {
            pagesToProcess = batchPages.filter(p => !skipPages.has(p));
          }
        }

        // UPGRADE #2: Pipeline - Start rendering next batch while analyzing current batch
        const nextBatchStart = batchStart + BATCH_SIZE;
        const nextBatchEnd = Math.min(nextBatchStart + BATCH_SIZE - 1, totalPages);
        let renderNextBatchPromise: Promise<Map<number, string>> | null = null;

        if (nextBatchStart <= totalPages) {
          const nextBatchPages = Array.from({ length: nextBatchEnd - nextBatchStart + 1 }, (_, i) => nextBatchStart + i);
          const capturedTempFilePath = tempFilePath;
          renderNextBatchPromise = (async () => {
            try {
              const nextBuffer = fs.readFileSync(capturedTempFilePath);
              const doc = mupdf.Document.openDocument(nextBuffer, "application/pdf");
              try {
                return renderPagesFromDoc(doc, nextBatchPages, totalPages, fileSize);
              } finally {
                doc.destroy();
              }
            } catch (err) {
              console.error(`[Pipeline] Failed to pre-render next batch:`, err);
              return new Map<number, string>();
            }
          })();
        }

        // Send rendered pages to OpenAI concurrently (like Python's asyncio.gather)
        const extractionPromises = pagesToProcess.map(async (pageNum) => {
          const imageBase64 = renderedPages.get(pageNum);
          if (!imageBase64) {
            return { pageNum, result: { found_recipe: false, page_type: 'error', notes: `Failed to render page ${pageNum}` } as ExtractionResult, durationMs: 0 };
          }
          try {
            costTracker.openaiCalls++;
            const startTime = Date.now();
            const result = await callOpenAIVision(imageBase64, pageNum);
            const durationMs = Date.now() - startTime;
            return { pageNum, result, durationMs };
          } catch (err) {
            return { pageNum, result: { found_recipe: false, page_type: 'error', notes: `API error: ${err instanceof Error ? err.message : String(err)}` } as ExtractionResult, durationMs: 0 };
          }
        });

        // UPGRADE #2: Pipeline - Wait for both extraction and pre-rendering simultaneously
        let results: PromiseSettledResult<{ pageNum: number; result: ExtractionResult; durationMs: number }>[];
        if (renderNextBatchPromise) {
          const [extractionResults, nextBatchRendered] = await Promise.all([
            Promise.allSettled(extractionPromises),
            renderNextBatchPromise,
          ]);
          results = extractionResults;
          preRenderedPages = nextBatchRendered;
        } else {
          results = await Promise.allSettled(extractionPromises);
        }

        // Clear rendered pages from memory
        renderedPages.clear();

        // Memory check every 20 pages
        if (batchEnd % 20 === 0 || batchEnd === totalPages) {
          logMemoryUsage(job.id, `page ${batchEnd}/${totalPages}`);
        }

        // Process results in page order
        for (const settled of results) {
          if (settled.status === "rejected") {
            errorLog.push(`Page: Erreur - ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`);
            failedPages++;
            try {
              progressEmitter.emit({
                type: "error",
                jobId: job.id,
                cookbookId: job.cookbookId,
                data: { error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason) },
                timestamp: Date.now(),
              });
            } catch {}
            continue;
          }

          const { pageNum, result, durationMs } = settled.value;

          // Per-page logging
          if (result.found_recipe && result.recipes && result.recipes.length > 0) {
            console.log(`[Extraction] Page ${pageNum}/${totalPages} - ${result.recipes.length} recipe(s) found (${durationMs}ms)`);
          } else {
            console.log(`[Extraction] Page ${pageNum}/${totalPages} - no recipe (${result.page_type || 'unknown'}) (${durationMs}ms)`);
          }

          if (result.found_recipe && result.recipes && result.recipes.length > 0) {
            for (const recipe of result.recipes) {
              if (recipesExtracted >= MAX_RECIPES_PER_PDF) break;

              // Handle multi-page recipe continuations
              if (recipe.is_continuation && lastCreatedRecipeId) {
                // Merge with the last created recipe
                try {
                  const existingRecipe = await prisma.recipe.findUnique({ where: { id: lastCreatedRecipeId } });
                  if (existingRecipe) {
                    const existingIngredients: unknown[] = JSON.parse(existingRecipe.ingredients as string || '[]');
                    const existingInstructions: unknown[] = JSON.parse(existingRecipe.instructions as string || '[]');

                    // Merge ingredients (add new ones)
                    const mergedIngredients = [...existingIngredients, ...(recipe.ingredients || [])];

                    // Merge instructions (continue step numbering)
                    const maxStep = existingInstructions.reduce((max: number, i: unknown) => Math.max(max, (i as { step?: number }).step || 0), 0);
                    const newInstructions = (recipe.instructions || []).map((inst, idx) => ({
                      ...inst,
                      step: maxStep + idx + 1,
                    }));
                    const mergedInstructions = [...existingInstructions, ...newInstructions];

                    // Update times if the continuation has them and the original doesn't
                    const updateData: Record<string, unknown> = {
                      ingredients: JSON.stringify(mergedIngredients),
                      instructions: JSON.stringify(mergedInstructions),
                    };
                    if (recipe.prep_time_minutes && !existingRecipe.prepTimeMinutes) {
                      updateData.prepTimeMinutes = recipe.prep_time_minutes;
                    }
                    if (recipe.cook_time_minutes && !existingRecipe.cookTimeMinutes) {
                      updateData.cookTimeMinutes = recipe.cook_time_minutes;
                    }
                    if (recipe.tips && !existingRecipe.tips) {
                      updateData.tips = recipe.tips;
                    }
                    if (recipe.servings && !existingRecipe.servings) {
                      updateData.servings = recipe.servings;
                    }

                    await prisma.recipe.update({
                      where: { id: lastCreatedRecipeId },
                      data: updateData,
                    });

                    processingLog.push(`Page ${pageNum}: Continuation fusionnee avec "${existingRecipe.title}"`);
                    console.log(`[Extraction] Page ${pageNum}: Merged continuation with recipe "${existingRecipe.title}"`);
                  }
                } catch (mergeErr) {
                  console.error(`[Extraction] Failed to merge continuation on page ${pageNum}:`, mergeErr);
                  // Fall through to create as separate recipe
                }
                continue; // Skip creating a new recipe
              }

              // UPGRADE #10: Validate recipe quality
              const validation = validateRecipe(recipe);
              costTracker.recipesValidated++;

              // UPGRADE #5: Low confidence check
              const confidenceScore = recipe.confidence_score ?? 100;
              const isLowConfidence = confidenceScore < 50;

              // Determine status based on validation and confidence
              let recipeStatus = "approved";
              if (!validation.valid || isLowConfidence) {
                recipeStatus = "needs_review";
                costTracker.recipesNeedsReview++;
              }

              if (validation.issues.length > 0) {
                processingLog.push(`Page ${pageNum}: Validation "${recipe.title}" - score=${validation.qualityScore}, issues=[${validation.issues.join('; ')}]`);
              }
              if (isLowConfidence) {
                processingLog.push(`Page ${pageNum}: Confiance faible (${confidenceScore}/100) pour "${recipe.title}"`);
              }

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
                  is_low_carb: recipe.dietary_flags?.is_low_carb ?? false,
                  is_low_fat: recipe.dietary_flags?.is_low_fat ?? false,
                  is_high_protein: recipe.dietary_flags?.is_high_protein ?? false,
                  is_mediterranean: recipe.dietary_flags?.is_mediterranean ?? false,
                  is_whole30: recipe.dietary_flags?.is_whole30 ?? false,
                  is_low_sodium: recipe.dietary_flags?.is_low_sodium ?? false,
                  status: recipeStatus,
                },
              });

              // Track this recipe as the last created for potential continuation merging
              lastCreatedRecipeId = createdRecipe.id;
              recipesExtracted++;

              try {
                progressEmitter.emit({
                  type: "recipe_found",
                  jobId: job.id,
                  cookbookId: job.cookbookId,
                  data: { title: recipe.title, page: pageNum, recipesExtracted },
                  timestamp: Date.now(),
                });
              } catch {}

              // Queue image generation (throttled, non-blocking)
              imageGenerationQueue.push({
                recipeId: createdRecipe.id,
                title: recipe.title,
                description: recipe.description,
              });
            }
          } else {
            const pageType = result.page_type || "inconnu";
            // Don't store API/rendering errors as content
            if (pageType === "error") {
              errorLog.push(`Page ${pageNum}: ${result.notes || "Erreur de traitement"}`);
              failedPages++;
              try {
                progressEmitter.emit({
                  type: "error",
                  jobId: job.id,
                  cookbookId: job.cookbookId,
                  data: { page: pageNum, error: result.notes || "Erreur de traitement" },
                  timestamp: Date.now(),
                });
              } catch {}
              continue;
            }

            // Handle old-style CONTINUATION notes - merge with last recipe
            if (result.notes?.startsWith('CONTINUATION:') && lastCreatedRecipeId) {
              processingLog.push(`Page ${pageNum}: Continuation (ancien format) detectee`);
              console.log(`[Extraction] Page ${pageNum}: Old-style continuation detected, skipping storage as NonRecipeContent`);
              continue; // Don't store as non-recipe content
            }

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

        // FORCE progress write after every batch (critical for crash recovery on large PDFs)
        await updateJobProgress(job.id, job.cookbookId, batchEnd, recipesExtracted, processingLog, true, failedPages);

        // Small delay between batches to respect rate limits
        await delay(RATE_LIMIT_DELAY_MS);
      }

      // UPGRADE #4: Recipe Deduplication Engine
      processingLog.push("Deduplication des recettes...");
      const duplicatesRemoved = await deduplicateRecipes(job.cookbookId);
      costTracker.duplicatesRemoved = duplicatesRemoved;
      if (duplicatesRemoved > 0) {
        recipesExtracted -= duplicatesRemoved;
        processingLog.push(`Deduplication: ${duplicatesRemoved} doublon(s) supprime(s)`);
      } else {
        processingLog.push("Deduplication: aucun doublon detecte");
      }

      // UPGRADE #8: Clean up temp file
      if (tempFilePath) {
        cleanupTempFile(tempFilePath);
        tempFilePath = null;
      }

      // Process queued image generations (non-blocking)
      processImageQueue().catch((err) => {
        console.error("[ImageGen] Queue processing error:", err);
      });

      // Delayed recovery: catch any recipes that might have been missed by the queue
      // (e.g., if queue processing completed before all recipes were pushed)
      setTimeout(() => {
        recoverMissingImages().catch((err) => {
          console.error("[ImageRecovery] Post-extraction recovery error:", err);
        });
      }, 30000); // 30s delay to let the immediate queue finish first

      // UPGRADE #9: Cost Tracking Summary
      const totalPagesProcessed = cancelledJobs.has(job.id) ? 0 : (await prisma.processingJob.findUnique({ where: { id: job.id }, select: { totalPages: true } }))?.totalPages ?? 0;
      const estimatedGPT52Cost = costTracker.openaiCalls * 0.01;
      const estimatedPrefilterCost = costTracker.prefilterCalls * 0.0001;
      const totalEstimatedCost = estimatedGPT52Cost + estimatedPrefilterCost;

      const costSummary = [
        `--- Resume du traitement ---`,
        `Pages totales: ${totalPagesProcessed}`,
        `Pages ignorees (pre-filtre): ${costTracker.pagesSkipped}`,
        `Appels GPT-5.2: ${costTracker.openaiCalls}`,
        `Appels pre-filtre (GPT-4o-mini): ${costTracker.prefilterCalls}`,
        `Recettes extraites: ${recipesExtracted}`,
        `Recettes a revoir: ${costTracker.recipesNeedsReview}`,
        `Doublons supprimes: ${costTracker.duplicatesRemoved}`,
        `Cout estime: $${totalEstimatedCost.toFixed(2)} (GPT-5.2: $${estimatedGPT52Cost.toFixed(2)}, pre-filtre: $${estimatedPrefilterCost.toFixed(4)})`,
      ];
      costSummary.forEach(line => processingLog.push(line));
      console.log(`[CostTracker] Job ${job.id}: ${costSummary.join(' | ')}`);

      try {
        progressEmitter.emit({
          type: "cost_update",
          jobId: job.id,
          cookbookId: job.cookbookId,
          data: {
            openaiCalls: costTracker.openaiCalls,
            prefilterCalls: costTracker.prefilterCalls,
            pagesSkipped: costTracker.pagesSkipped,
            recipesExtracted,
            recipesNeedsReview: costTracker.recipesNeedsReview,
            duplicatesRemoved: costTracker.duplicatesRemoved,
            estimatedCost: totalEstimatedCost,
          },
          timestamp: Date.now(),
        });
      } catch {}

      // Mark job as completed
      const finalStatus = cancelledJobs.has(job.id) ? "cancelled" : "completed";
      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          currentPage: totalPagesProcessed,
          recipesExtracted,
          failedPages,
          processingLog: JSON.stringify(processingLog),
          errorLog: JSON.stringify(errorLog),
        },
      });

      // Update cookbook status
      await prisma.cookbook.update({
        where: { id: job.cookbookId },
        data: {
          status: finalStatus === "cancelled" ? "failed" : "completed",
          processedPages: totalPagesProcessed,
          totalRecipesFound: recipesExtracted,
          errorMessage: finalStatus === "cancelled" ? "Traitement annule par l'utilisateur" : null,
        },
      });

      console.log(`Processing completed for job ${job.id}: ${recipesExtracted} recipes extracted from ${totalPagesProcessed} pages`);

      try {
        progressEmitter.emit({
          type: "completed",
          jobId: job.id,
          cookbookId: job.cookbookId,
          data: {
            status: finalStatus,
            recipesExtracted,
            totalPages: totalPagesProcessed,
            failedPages,
            duplicatesRemoved: costTracker.duplicatesRemoved,
          },
          timestamp: Date.now(),
        });
      } catch {}

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
              totalPagesProcessed,
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
      const processingLog: string[] = [];
      const errorLog: string[] = [];
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
    // UPGRADE #8: Always clean up temp file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
    cancelledJobs.delete(jobId);
    pausedJobs.delete(jobId);
    lastProgressUpdate.delete(jobId);
  }
}

// ==================== UPGRADE #7: Page-Range Re-extraction ====================
export async function extractPageRange(jobId: string, startPage: number, endPage: number): Promise<void> {
  console.log(`[PageRange] Starting page-range re-extraction for job ${jobId}: pages ${startPage}-${endPage}`);
  let tempFilePath: string | null = null;

  try {
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { cookbook: true },
    });

    if (!job || !job.cookbook) {
      throw new Error("Job or cookbook not found");
    }

    // Delete recipes from those specific pages
    const deletedRecipes = await prisma.recipe.deleteMany({
      where: {
        cookbookId: job.cookbookId,
        sourcePage: { gte: startPage, lte: endPage },
      },
    });
    console.log(`[PageRange] Deleted ${deletedRecipes.count} existing recipes from pages ${startPage}-${endPage}`);

    // Also delete non-recipe content from those pages
    await prisma.nonRecipeContent.deleteMany({
      where: {
        cookbookId: job.cookbookId,
        page: { gte: startPage, lte: endPage },
      },
    });

    // Update job status to processing
    const existingLog: string[] = (() => { try { return JSON.parse(job.processingLog); } catch { return []; } })();
    const existingErrorLog: string[] = (() => { try { return JSON.parse(job.errorLog); } catch { return []; } })();
    existingLog.push(`Re-extraction des pages ${startPage}-${endPage}...`);

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "processing",
        processingLog: JSON.stringify(existingLog),
      },
    });

    // Fetch PDF to temp file
    tempFilePath = await fetchPDFFromStorage(job.cookbook.filePath, job.cookbook.fileUrl, `${jobId}-reextract`);
    const fileStats = fs.statSync(tempFilePath);
    const fileSize = fileStats.size;

    // Read buffer for MuPDF
    const pdfNodeBuffer = fs.readFileSync(tempFilePath);
    const totalPages = getPdfPageCount(pdfNodeBuffer);

    let recipesExtracted = 0;
    let failedPages = 0;

    // Process pages in batches
    for (let batchStart = startPage; batchStart <= endPage; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endPage);
      const batchPages = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

      // Render pages
      let renderedPages: Map<number, string>;
      try {
        const batchBuffer = fs.readFileSync(tempFilePath);
        const doc = mupdf.Document.openDocument(batchBuffer, "application/pdf");
        try {
          renderedPages = renderPagesFromDoc(doc, batchPages, totalPages, fileSize);
        } finally {
          doc.destroy();
        }
      } catch (err) {
        console.error(`[PageRange] Failed to render pages ${batchStart}-${batchEnd}:`, err);
        existingErrorLog.push(`Failed to render pages ${batchStart}-${batchEnd}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      // Pre-filter if enabled
      let pagesToProcess = batchPages;
      if (ENABLE_PAGE_PREFILTER) {
        const classificationResults = await Promise.allSettled(
          batchPages.map(async (pageNum) => {
            const imageBase64 = renderedPages.get(pageNum);
            if (!imageBase64) return { pageNum, classification: "uncertain" as const };
            const classification = await classifyPageCheap(imageBase64, pageNum);
            return { pageNum, classification };
          })
        );

        const skipPages = new Set<number>();
        for (const settled of classificationResults) {
          if (settled.status === "fulfilled" && settled.value.classification === "skip") {
            skipPages.add(settled.value.pageNum);
            existingLog.push(`Page ${settled.value.pageNum}: Pre-filtre - contenu non-recette, ignore`);
          }
        }
        if (skipPages.size > 0) {
          pagesToProcess = batchPages.filter(p => !skipPages.has(p));
        }
      }

      // Extract recipes
      const extractionResults = await Promise.allSettled(
        pagesToProcess.map(async (pageNum) => {
          const imageBase64 = renderedPages.get(pageNum);
          if (!imageBase64) {
            return { pageNum, result: { found_recipe: false, page_type: 'error', notes: `Failed to render page ${pageNum}` } as ExtractionResult };
          }
          const result = await callOpenAIVision(imageBase64, pageNum);
          return { pageNum, result };
        })
      );

      renderedPages.clear();

      // Process results
      for (const settled of extractionResults) {
        if (settled.status === "rejected") {
          failedPages++;
          continue;
        }

        const { pageNum, result } = settled.value;

        if (result.found_recipe && result.recipes && result.recipes.length > 0) {
          for (const recipe of result.recipes) {
            if (recipe.is_continuation) continue; // Skip continuations in page-range mode

            const validation = validateRecipe(recipe);
            const confidenceScore = recipe.confidence_score ?? 100;
            const recipeStatus = (!validation.valid || confidenceScore < 50) ? "needs_review" : "approved";

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
                is_low_carb: recipe.dietary_flags?.is_low_carb ?? false,
                is_low_fat: recipe.dietary_flags?.is_low_fat ?? false,
                is_high_protein: recipe.dietary_flags?.is_high_protein ?? false,
                is_mediterranean: recipe.dietary_flags?.is_mediterranean ?? false,
                is_whole30: recipe.dietary_flags?.is_whole30 ?? false,
                is_low_sodium: recipe.dietary_flags?.is_low_sodium ?? false,
                status: recipeStatus,
              },
            });

            recipesExtracted++;
            existingLog.push(`Page ${pageNum}: Recette trouvee - ${recipe.title}`);

            // Queue image generation
            imageGenerationQueue.push({
              recipeId: createdRecipe.id,
              title: recipe.title,
              description: recipe.description,
            });
          }
        } else if (result.page_type === "error") {
          existingErrorLog.push(`Page ${pageNum}: ${result.notes || "Erreur de traitement"}`);
          failedPages++;
        }
      }

      await delay(RATE_LIMIT_DELAY_MS);
    }

    // Clean up temp file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
      tempFilePath = null;
    }

    // Update job with results
    existingLog.push(`Re-extraction terminee: ${recipesExtracted} recettes extraites des pages ${startPage}-${endPage}`);

    // Recount total recipes for the cookbook
    const totalRecipes = await prisma.recipe.count({ where: { cookbookId: job.cookbookId } });

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        recipesExtracted: totalRecipes,
        processingLog: JSON.stringify(existingLog),
        errorLog: JSON.stringify(existingErrorLog),
      },
    });

    await prisma.cookbook.update({
      where: { id: job.cookbookId },
      data: {
        totalRecipesFound: totalRecipes,
      },
    });

    // Process queued images
    processImageQueue().catch((err) => {
      console.error("[ImageGen] Queue processing error:", err);
    });

    console.log(`[PageRange] Completed: ${recipesExtracted} recipes extracted from pages ${startPage}-${endPage}`);

  } catch (error) {
    console.error(`[PageRange] Error for job ${jobId}:`, error);

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorLog: JSON.stringify([`Page-range re-extraction failed: ${String(error)}`]),
      },
    });

    throw error;
  } finally {
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
}

// Throttled progress updates -- avoid hammering SQLite with writes
const lastProgressUpdate = new Map<string, number>();
const PROGRESS_UPDATE_INTERVAL_MS = 3000; // Write progress at most every 3s per job

async function updateJobProgress(
  jobId: string,
  cookbookId: string,
  currentPage: number,
  recipesExtracted: number,
  processingLog: string[],
  force = false,
  failedPages = 0
): Promise<void> {
  const now = Date.now();
  const lastUpdate = lastProgressUpdate.get(jobId) || 0;

  // Skip if we updated recently (unless forced -- completion, errors, pauses)
  if (!force && now - lastUpdate < PROGRESS_UPDATE_INTERVAL_MS) {
    return;
  }
  lastProgressUpdate.set(jobId, now);

  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      currentPage,
      recipesExtracted,
      failedPages,
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

  try {
    progressEmitter.emit({
      type: "progress",
      jobId,
      cookbookId,
      data: { currentPage, recipesExtracted, failedPages },
      timestamp: Date.now(),
    });
  } catch {}
}

// Graceful shutdown -- save checkpoint for any running jobs
export async function gracefulShutdown(): Promise<void> {
  console.log("[Shutdown] Saving extraction state...");
  // The extraction loop checks cancelledJobs each iteration, so marking all as cancelled
  // will cause them to stop and save their checkpoint naturally.
  // For immediate effect, we mark processing jobs in DB so recovery picks them up.
  try {
    const runningJobs = await prisma.processingJob.findMany({
      where: { status: "processing" },
    });
    for (const job of runningJobs) {
      cancelledJobs.add(job.id);
    }
    // Give running batches a moment to finish and checkpoint
    if (runningJobs.length > 0) {
      console.log(`[Shutdown] Signaled ${runningJobs.length} running job(s) to stop`);
      await delay(2000);
    }
  } catch (err) {
    console.error("[Shutdown] Error during graceful shutdown:", err);
  }
}
