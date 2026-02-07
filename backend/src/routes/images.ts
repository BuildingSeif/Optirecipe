import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { auth } from "../auth";
import { GenerateImageRequestSchema, type GenerateImageResponse } from "../types";

const imagesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Generate a recipe image using Gemini API
imagesRouter.post(
  "/generate",
  zValidator("json", GenerateImageRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { title, description } = c.req.valid("json");

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return c.json({ error: { message: "Google API key not configured" } }, 500);
    }

    // Build the prompt for food photography
    const descriptionPart = description ? ` ${description}.` : "";
    const prompt = `Professional food photography of ${title}.${descriptionPart} Appetizing, high-quality, restaurant-style presentation on a clean plate, soft natural lighting, shallow depth of field.`;

    try {
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
        console.error("Gemini API error:", errorText);
        return c.json(
          { error: { message: "Failed to generate image", code: "GEMINI_API_ERROR" } },
          500
        );
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

      // Extract the image data from the response
      // Gemini returns: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
      const candidate = result.candidates?.[0];
      const inlineData = candidate?.content?.parts?.[0]?.inlineData;

      if (!inlineData?.data || !inlineData?.mimeType) {
        console.error("Unexpected Gemini response structure:", JSON.stringify(result));
        return c.json(
          { error: { message: "Invalid response from image generation API", code: "INVALID_RESPONSE" } },
          500
        );
      }

      const imageResponse: GenerateImageResponse = {
        imageBase64: inlineData.data,
        mimeType: inlineData.mimeType,
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

export { imagesRouter };
