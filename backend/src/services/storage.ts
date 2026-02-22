import { writeFile, readFile, unlink, readdir, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const isRailway = !!process.env.RAILWAY_STATIC_URL || !!process.env.RAILWAY_ENVIRONMENT;
const UPLOADS_DIR = process.env.UPLOADS_DIR || (isRailway ? "/data/uploads" : "/app/uploads");

interface StorageFile {
  id: string;
  url: string;
}

interface StorageListResult {
  files: StorageFile[];
}

function getBaseUrl(): string {
  const raw = process.env.BACKEND_URL || process.env.RAILWAY_STATIC_URL || "http://localhost:3000";
  // Ensure URL has protocol
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return `https://${raw}`;
  }
  return raw;
}

class StorageService {
  private vibecode: any = null;

  constructor() {
    if (!isRailway) {
      try {
        // Dynamic import to avoid crash when SDK is not available
        const { createVibecodeSDK } = require("@vibecodeapp/backend-sdk");
        this.vibecode = createVibecodeSDK();
      } catch (e) {
        console.warn("[Storage] Vibecode SDK not available, using local storage");
      }
    }
    // Ensure uploads dir exists for local storage
    if (!existsSync(UPLOADS_DIR)) {
      mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});
    }
  }

  async upload(file: File): Promise<StorageFile> {
    if (this.vibecode) {
      return this.vibecode.storage.upload(file);
    }

    // Local filesystem storage
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${id}.${ext}`;
    const filePath = join(UPLOADS_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/uploads/${fileName}`;

    return { id: fileName, url };
  }

  async list(options?: { limit?: number }): Promise<StorageListResult> {
    if (this.vibecode) {
      return this.vibecode.storage.list(options);
    }

    const files: StorageFile[] = [];
    if (existsSync(UPLOADS_DIR)) {
      const entries = await readdir(UPLOADS_DIR);
      const baseUrl = getBaseUrl();
      for (const entry of entries.slice(0, options?.limit || 50)) {
        files.push({
          id: entry,
          url: `${baseUrl}/uploads/${entry}`,
        });
      }
    }
    return { files };
  }

  async delete(id: string): Promise<void> {
    if (this.vibecode) {
      return this.vibecode.storage.delete(id);
    }

    const filePath = join(UPLOADS_DIR, id);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  async getBuffer(urlOrId: string): Promise<Buffer | null> {
    // If it's a local file reference
    const fileName = urlOrId.split("/").pop() || "";
    const filePath = join(UPLOADS_DIR, fileName);
    if (existsSync(filePath)) {
      return readFile(filePath);
    }

    // If it's a URL, fetch it
    try {
      const resp = await fetch(urlOrId);
      if (resp.ok) {
        return Buffer.from(await resp.arrayBuffer());
      }
    } catch {
      // Fetch failed
    }

    return null;
  }
}

export const storage = new StorageService();
