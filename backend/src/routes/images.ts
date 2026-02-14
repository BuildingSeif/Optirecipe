import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { auth } from "../auth";
import { prisma } from "../prisma";
import { GenerateImageRequestSchema, type GenerateImageResponse } from "../types";

const imagesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

/**
 * Calls FAL AI Flux Pro v1.1 to generate a food photograph.
 * Returns the hosted image URL on success.
 */
async function generateFalImage(
  apiKey: string,
  title: string,
  description?: string
): Promise<{ imageUrl: string } | { error: string }> {
  const descriptionPart = description ? ` ${description}.` : "";
  const prompt = `Professional food photography of ${title}.${descriptionPart} Appetizing, high-quality, restaurant-style presentation on a clean plate, soft natural lighting, shallow depth of field, delicious looking food.`;

  const response = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FAL AI API error:", errorText);
    return { error: "Failed to generate image" };
  }

  const result = (await response.json()) as {
    images: Array<{ url: string }>;
  };

  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) {
    console.error("Unexpected FAL AI response structure:", JSON.stringify(result));
    return { error: "Invalid response from image generation API" };
  }

  return { imageUrl };
}

// POST /generate - Generate a recipe image using FAL AI Flux Pro v1.1
imagesRouter.post(
  "/generate",
  zValidator("json", GenerateImageRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { title, description } = c.req.valid("json");

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return c.json({ error: { message: "FAL API key not configured" } }, 500);
    }

    try {
      const result = await generateFalImage(apiKey, title, description);

      if ("error" in result) {
        return c.json(
          { error: { message: result.error, code: "FAL_API_ERROR" } },
          500
        );
      }

      const imageResponse: GenerateImageResponse = {
        imageUrl: result.imageUrl,
      };

      return c.json({ data: imageResponse });
    } catch (error) {
      console.error("Image generation error:", error);
      return c.json(
        { error: { message: "Failed to generate image", code: "GENERATION_ERROR" } },
        500
      );
    }
  }
);

// POST /:id/regenerate-image - Regenerate image for an existing recipe
imagesRouter.post(
  "/:id/regenerate-image",
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const recipeId = c.req.param("id");

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return c.json({ error: { message: "FAL API key not configured" } }, 500);
    }

    try {
      // Look up the recipe, ensuring it belongs to the authenticated user
      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, userId: user.id },
      });

      if (!recipe) {
        return c.json(
          { error: { message: "Recipe not found", code: "NOT_FOUND" } },
          404
        );
      }

      const result = await generateFalImage(
        apiKey,
        recipe.title,
        recipe.description ?? undefined
      );

      if ("error" in result) {
        return c.json(
          { error: { message: result.error, code: "FAL_API_ERROR" } },
          500
        );
      }

      // Persist the new image URL on the recipe
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { imageUrl: result.imageUrl },
      });

      const imageResponse: GenerateImageResponse = {
        imageUrl: result.imageUrl,
      };

      return c.json({ data: imageResponse });
    } catch (error) {
      console.error("Image regeneration error:", error);
      return c.json(
        { error: { message: "Failed to regenerate image", code: "GENERATION_ERROR" } },
        500
      );
    }
  }
);

export { imagesRouter };
