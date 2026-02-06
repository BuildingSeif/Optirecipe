import { Hono } from "hono";
import { createVibecodeSDK } from "@vibecodeapp/backend-sdk";
import { auth } from "../auth";

const uploadRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const vibecode = createVibecodeSDK();

// Upload PDF file
uploadRouter.post("/pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: { message: "No file provided" } }, 400);
    }

    // Validate file type
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return c.json({ error: { message: "Only PDF files are allowed" } }, 400);
    }

    // Validate file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: { message: "File size must be less than 100MB" } }, 400);
    }

    // Generate unique file reference
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `cookbooks/${user.id}/${timestamp}-${sanitizedName}`;

    // Upload to Vibecode storage
    const uploadResult = await vibecode.storage.upload(file);

    return c.json({
      data: {
        filePath: filePath,
        fileId: uploadResult.id,
        fileName: file.name,
        fileSize: file.size,
        url: uploadResult.url,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: { message: "Failed to upload file" } }, 500);
  }
});

// List files
uploadRouter.get("/files", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const result = await vibecode.storage.list({ limit: 50 });
    return c.json({ data: result });
  } catch (error) {
    console.error("List files error:", error);
    return c.json({ error: { message: "Failed to list files" } }, 500);
  }
});

// Delete a file
uploadRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const id = c.req.param("id");
    await vibecode.storage.delete(id);
    return c.body(null, 204);
  } catch (error) {
    console.error("Delete file error:", error);
    return c.json({ error: { message: "Failed to delete file" } }, 500);
  }
});

export { uploadRouter };
