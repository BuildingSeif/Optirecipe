import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { storage } from "../services/storage";
import { auth } from "../auth";

const userRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().optional(),
});

// Update user profile
userRouter.patch("/profile", zValidator("json", UpdateProfileSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { name, image } = c.req.valid("json");

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        image: image || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return c.json({ data: updatedUser });
  } catch (error) {
    console.error("Update profile error:", error);
    return c.json({ error: { message: "Failed to update profile" } }, 500);
  }
});

// Upload avatar
userRouter.post("/avatar", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: { message: "No file provided" } }, 400);
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return c.json({ error: { message: "Only image files are allowed" } }, 400);
    }

    // Validate file size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: { message: "File size must be less than 5MB" } }, 400);
    }

    // Upload to storage
    const uploadResult = await storage.upload(file);

    // Update user with new image URL
    await prisma.user.update({
      where: { id: user.id },
      data: { image: uploadResult.url },
    });

    return c.json({
      data: {
        url: uploadResult.url,
      },
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return c.json({ error: { message: "Failed to upload avatar" } }, 500);
  }
});

// Get user profile
userRouter.get("/profile", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    if (!profile) {
      return c.json({ error: { message: "User not found" } }, 404);
    }

    return c.json({ data: profile });
  } catch (error) {
    console.error("Get profile error:", error);
    return c.json({ error: { message: "Failed to get profile" } }, 500);
  }
});

export { userRouter };
