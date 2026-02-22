import { Hono } from "hono";
import { storage } from "../services/storage";
import { auth } from "../auth";
import { writeFile, readFile, unlink, mkdir, readdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const uploadRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Constants for file limits
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNKS_DIR = "/tmp/pdf-chunks";
const FORM_PARSE_TIMEOUT = 60000; // 1 minute for chunk parsing
const UPLOAD_TIMEOUT = 600000; // 10 minutes for final upload

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

// Ensure chunks directory exists
async function ensureChunksDir(uploadId: string): Promise<string> {
  const dir = join(CHUNKS_DIR, uploadId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

// Clean up chunks directory
async function cleanupChunks(uploadId: string): Promise<void> {
  const dir = join(CHUNKS_DIR, uploadId);
  try {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true });
    }
  } catch (e) {
    console.error(`[Upload] Failed to cleanup chunks: ${uploadId}`, e);
  }
}

// Initialize chunked upload - returns uploadId
uploadRouter.post("/init", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  try {
    const body = await c.req.json();
    const { fileName, fileSize, totalChunks } = body;

    if (!fileName || !fileSize || !totalChunks) {
      return c.json({ error: { message: "Missing required fields" } }, 400);
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return c.json({
        error: { message: `File size (${formatFileSize(fileSize)}) exceeds maximum of 500MB` }
      }, 400);
    }

    // Validate file type
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return c.json({ error: { message: "Only PDF files are allowed" } }, 400);
    }

    // Generate unique upload ID
    const uploadId = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create directory for chunks
    await ensureChunksDir(uploadId);

    // Store upload metadata
    const metadataPath = join(CHUNKS_DIR, uploadId, "metadata.json");
    await writeFile(metadataPath, JSON.stringify({
      fileName,
      fileSize,
      totalChunks,
      userId: user.id,
      createdAt: new Date().toISOString(),
      receivedChunks: [],
    }));

    console.log(`[Upload] Initialized chunked upload: ${uploadId}, ${fileName}, ${formatFileSize(fileSize)}, ${totalChunks} chunks`);

    return c.json({
      data: {
        uploadId,
        chunkSize: CHUNK_SIZE,
        totalChunks,
      },
    });
  } catch (error) {
    console.error("[Upload] Init error:", error);
    return c.json({ error: { message: "Failed to initialize upload" } }, 500);
  }
});

// Upload a single chunk
uploadRouter.post("/chunk/:uploadId/:chunkIndex", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const uploadId = c.req.param("uploadId");
  const chunkIndex = parseInt(c.req.param("chunkIndex"), 10);

  try {
    const formData = await withTimeout(
      c.req.formData(),
      FORM_PARSE_TIMEOUT,
      "Chunk upload timeout"
    );

    const chunk = formData.get("chunk") as File | null;
    if (!chunk) {
      return c.json({ error: { message: "No chunk data provided" } }, 400);
    }

    // Verify upload exists and belongs to user
    const metadataPath = join(CHUNKS_DIR, uploadId, "metadata.json");
    if (!existsSync(metadataPath)) {
      return c.json({ error: { message: "Upload not found" } }, 404);
    }

    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
    if (metadata.userId !== user.id) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    // Save chunk to disk
    const chunkPath = join(CHUNKS_DIR, uploadId, `chunk-${chunkIndex.toString().padStart(5, "0")}`);
    const arrayBuffer = await chunk.arrayBuffer();
    await writeFile(chunkPath, Buffer.from(arrayBuffer));

    // Update metadata
    if (!metadata.receivedChunks.includes(chunkIndex)) {
      metadata.receivedChunks.push(chunkIndex);
      await writeFile(metadataPath, JSON.stringify(metadata));
    }

    console.log(`[Upload] Chunk ${chunkIndex + 1}/${metadata.totalChunks} received for ${uploadId}`);

    return c.json({
      data: {
        chunkIndex,
        received: metadata.receivedChunks.length,
        total: metadata.totalChunks,
      },
    });
  } catch (error) {
    console.error(`[Upload] Chunk ${chunkIndex} error for ${uploadId}:`, error);
    return c.json({ error: { message: "Failed to upload chunk" } }, 500);
  }
});

// Complete chunked upload - reassemble and upload to storage
uploadRouter.post("/complete/:uploadId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const uploadId = c.req.param("uploadId");

  try {
    // Verify upload exists
    const metadataPath = join(CHUNKS_DIR, uploadId, "metadata.json");
    if (!existsSync(metadataPath)) {
      return c.json({ error: { message: "Upload not found" } }, 404);
    }

    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
    if (metadata.userId !== user.id) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    // Verify all chunks received
    if (metadata.receivedChunks.length !== metadata.totalChunks) {
      return c.json({
        error: {
          message: `Missing chunks: received ${metadata.receivedChunks.length}/${metadata.totalChunks}`
        }
      }, 400);
    }

    console.log(`[Upload] Assembling ${metadata.totalChunks} chunks for ${uploadId}`);

    // Read and assemble all chunks in order
    const chunksDir = join(CHUNKS_DIR, uploadId);
    const chunkFiles = (await readdir(chunksDir))
      .filter(f => f.startsWith("chunk-"))
      .sort();

    const chunks: Buffer[] = [];
    for (const chunkFile of chunkFiles) {
      const chunkData = await readFile(join(chunksDir, chunkFile));
      chunks.push(chunkData);
    }

    const completeBuffer = Buffer.concat(chunks);
    console.log(`[Upload] Assembled file: ${formatFileSize(completeBuffer.length)}`);

    // Create File object for storage
    const file = new File([completeBuffer], metadata.fileName, { type: "application/pdf" });

    // Upload to storage
    console.log(`[Upload] Uploading to storage...`);
    const uploadResult = await withTimeout(
      storage.upload(file),
      UPLOAD_TIMEOUT,
      "Storage upload timeout"
    );

    // Generate file path
    const timestamp = Date.now();
    const sanitizedName = metadata.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `cookbooks/${user.id}/${timestamp}-${sanitizedName}`;

    // Cleanup chunks
    await cleanupChunks(uploadId);

    console.log(`[Upload] Complete: ${uploadResult.id}`);

    return c.json({
      data: {
        filePath,
        fileId: uploadResult.id,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        url: uploadResult.url,
      },
    });
  } catch (error) {
    console.error(`[Upload] Complete error for ${uploadId}:`, error);
    await cleanupChunks(uploadId);
    return c.json({ error: { message: "Failed to complete upload" } }, 500);
  }
});

// Cancel/abort chunked upload
uploadRouter.delete("/abort/:uploadId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const uploadId = c.req.param("uploadId");
  await cleanupChunks(uploadId);
  console.log(`[Upload] Aborted: ${uploadId}`);
  return c.body(null, 204);
});

// Upload PDF file - for small files (under 10MB), use direct upload
// For larger files, frontend should use chunked upload
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

    // Upload to storage with extended timeout for large files
    console.log(`[Upload] Uploading to storage: ${filePath}`);

    const uploadResult = await withTimeout(
      storage.upload(file),
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
    const result = await storage.list({ limit: 50 });
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
    await storage.delete(id);
    return c.body(null, 204);
  } catch (error) {
    console.error("Delete file error:", error);
    return c.json({ error: { message: "Failed to delete file" } }, 500);
  }
});

export { uploadRouter };
