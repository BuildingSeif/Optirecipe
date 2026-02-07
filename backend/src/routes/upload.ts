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

// Constants for file limits
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max
const FORM_PARSE_TIMEOUT = 120000; // 2 minutes for parsing large files
const UPLOAD_TIMEOUT = 600000; // 10 minutes for uploading large files

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// Format file size for logging
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Upload PDF file - optimized for large files up to 500MB
uploadRouter.post("/pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const startTime = Date.now();
  let fileName = "unknown";
  let fileSize = 0;

  try {
    console.log(`[Upload] Starting PDF upload for user: ${user.id}`);

    // Parse form data with extended timeout for large files
    const formData = await withTimeout(
      c.req.formData(),
      FORM_PARSE_TIMEOUT,
      "Request timeout while reading file data. Please try again with a stable connection."
    );

    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: { message: "No file provided" } }, 400);
    }

    fileName = file.name;
    fileSize = file.size;

    console.log(`[Upload] Received: ${fileName}, Size: ${formatFileSize(fileSize)}`);

    // Validate file type
    const isPDF = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
    if (!isPDF) {
      console.log(`[Upload] Rejected: Invalid file type - ${file.type}`);
      return c.json({ error: { message: "Only PDF files are allowed" } }, 400);
    }

    // Validate file size (500MB max)
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[Upload] Rejected: File too large - ${formatFileSize(file.size)}`);
      return c.json({
        error: {
          message: `File size (${formatFileSize(file.size)}) exceeds maximum of 500MB`
        }
      }, 400);
    }

    // Generate unique file reference
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `cookbooks/${user.id}/${timestamp}-${sanitizedName}`;

    // Upload to Vibecode storage with extended timeout for large files
    console.log(`[Upload] Uploading to storage: ${filePath}`);

    const uploadResult = await withTimeout(
      vibecode.storage.upload(file),
      UPLOAD_TIMEOUT,
      "Upload timeout - please check your connection and try again"
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Upload] Success: ${uploadResult.id} in ${duration}s`);

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
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Upload] Failed after ${duration}s:`, error);

    // Provide helpful error messages
    let message = "Failed to upload file";
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        message = `Upload timed out for ${formatFileSize(fileSize)}. Please try again with a stable internet connection.`;
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        message = "Network error during upload. Please check your connection and try again.";
      } else {
        message = error.message;
      }
    }

    return c.json({ error: { message } }, 500);
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
