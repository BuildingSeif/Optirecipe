import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { auth } from "../auth";
import { prisma } from "../prisma";
import { IngredientImageBatchRequestSchema } from "../types";

const ingredientImagesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

/**
 * Generates an ingredient image via FAL AI Flux Pro v1.1.
 * Returns the image URL on success, or null on failure.
 */
async function generateIngredientImage(
  apiKey: string,
  name: string
): Promise<string | null> {
  try {
    const response = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Clean food ingredient photo of ${name}, isolated on plain white background, professional product photography, studio lighting, sharp focus, single ingredient only, no text, no labels`,
        image_size: "square",
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FAL AI error for ingredient "${name}":`, errorText);
      return null;
    }

    const result = (await response.json()) as {
      images: Array<{ url: string }>;
    };

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) {
      console.error(
        `Unexpected FAL AI response for ingredient "${name}":`,
        JSON.stringify(result)
      );
      return null;
    }

    return imageUrl;
  } catch (error) {
    console.error(`Failed to generate image for ingredient "${name}":`, error);
    return null;
  }
}

/**
 * Process items in chunks with a concurrency limit.
 * Uses Promise.allSettled so one failure does not block others.
 */
async function processInChunks<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  chunkSize: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

// POST /batch - Generate and cache ingredient images in batch
ingredientImagesRouter.post(
  "/batch",
  zValidator("json", IngredientImageBatchRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    const { names } = c.req.valid("json");

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return c.json(
        { error: { message: "FAL API key not configured" } },
        500
      );
    }

    // Normalize all names for cache lookup
    const normalizedMap = new Map<string, string>(); // normalized -> original
    const uniqueNormalized = new Set<string>();
    for (const name of names) {
      const normalized = name.trim().toLowerCase();
      if (normalized) {
        normalizedMap.set(normalized, name);
        uniqueNormalized.add(normalized);
      }
    }

    const normalizedNames = Array.from(uniqueNormalized);

    // Check cache for all names at once
    const cached = await prisma.ingredientImage.findMany({
      where: { name: { in: normalizedNames } },
    });

    const imageMap: Record<string, string> = {};
    const cachedSet = new Set<string>();

    for (const entry of cached) {
      imageMap[entry.name] = entry.imageUrl;
      cachedSet.add(entry.name);
    }

    // Find which names need generation
    const uncached = normalizedNames.filter((n) => !cachedSet.has(n));

    // Generate uncached images in parallel, max 3 concurrent
    if (uncached.length > 0) {
      await processInChunks(
        uncached,
        async (normalizedName: string) => {
          const imageUrl = await generateIngredientImage(
            apiKey,
            normalizedName
          );

          if (imageUrl) {
            // Use upsert to handle race conditions from concurrent requests
            const saved = await prisma.ingredientImage.upsert({
              where: { name: normalizedName },
              create: { name: normalizedName, imageUrl },
              update: { imageUrl },
            });
            imageMap[normalizedName] = saved.imageUrl;
          }
        },
        3
      );
    }

    // Build final response mapping original names to URLs
    // Use normalized keys so frontend can look up by lowercase name
    return c.json({ data: imageMap });
  }
);

export { ingredientImagesRouter };
