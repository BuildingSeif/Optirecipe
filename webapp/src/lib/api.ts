// Backend URL resolution with automatic fallback.
// Tries same-origin first (production proxy), then the build-time env var (dev preview).
// Caches the working URL after first successful request.

let _cachedBaseUrl: string | null = null;

function getCandidateUrls(): string[] {
  const envUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_VIBECODE_BACKEND_URL;
  const origin =
    typeof window !== "undefined" && window.location.origin !== "null"
      ? window.location.origin
      : null;

  // In dev sandbox, the env var is the correct backend preview URL
  if (origin?.includes(".dev.vibecode.run") && envUrl) {
    return [envUrl];
  }

  // In production: try same-origin first, then fall back to env var
  const urls: string[] = [];
  if (origin) urls.push(origin);
  if (envUrl && envUrl !== origin) urls.push(envUrl);
  if (urls.length === 0) urls.push("http://localhost:3000");
  return urls;
}

export function resolveBackendUrl(): string {
  if (_cachedBaseUrl) return _cachedBaseUrl;
  return getCandidateUrls()[0]!;
}

// Probe the backend and cache whichever URL responds
async function probeAndCacheUrl(): Promise<string> {
  if (_cachedBaseUrl) return _cachedBaseUrl;
  const candidates = getCandidateUrls();
  for (const url of candidates) {
    try {
      const resp = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        _cachedBaseUrl = url;
        console.log(`[API] Using backend: ${url}`);
        return url;
      }
    } catch {
      // This candidate didn't work, try next
    }
  }
  // Nothing worked — default to first candidate and let errors surface naturally
  _cachedBaseUrl = candidates[0]!;
  console.warn(`[API] No backend responded, defaulting to: ${_cachedBaseUrl}`);
  return _cachedBaseUrl;
}

// Start probing immediately on module load
const _probePromise = probeAndCacheUrl();

// Get the resolved backend URL (async — waits for probe)
export async function getBackendUrl(): Promise<string> {
  return _probePromise;
}

class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const raw = localStorage.getItem("optirecipe_session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.session?.token) {
        headers["Authorization"] = `Bearer ${session.session.token}`;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Wait for probe to finish (instant if already resolved)
  const baseUrl = await _probePromise;
  const url = `${baseUrl}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: "include",
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(
      json?.error?.message || json?.message || `Request failed with status ${response.status}`,
      response.status,
      json?.error || json
    );
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 2. JSON responses: parse and unwrap { data }
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  // 3. Non-JSON: return undefined (caller should use api.raw() for these)
  return undefined as T;
}

// Raw request for non-JSON endpoints (uploads, downloads, streams)
async function rawRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = await _probePromise;
  const url = `${baseUrl}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: "include",
  };
  return fetch(url, config);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  // Escape hatch for non-JSON endpoints
  raw: rawRequest,
};

// Sample endpoint types (extend as needed)
export interface SampleResponse {
  message: string;
  timestamp: string;
}

// Sample API functions
export const sampleApi = {
  getSample: () => api.get<SampleResponse>("/api/sample"),
};

export { ApiError };
