# Vibecode Workspace

This workspace contains a mobile app and backend server.

<projects>
  webapp/    — React app (port 8000, environment variable VITE_BASE_URL)
  backend/   — Hono API server (port 3000, environment variable VITE_BACKEND_URL)
</projects>

<agents>
  Use subagents for project-specific work:
  - backend-developer: Changes to the backend API
  - webapp-developer: Changes to the webapp frontend

  Each agent reads its project's CLAUDE.md for detailed instructions.
</agents>

<coordination>
  When a feature needs both frontend and backend:
  1. Define Zod schemas for request/response in backend/src/types.ts (shared contracts)
  2. Implement backend route using the schemas
  3. Test backend with cURL (use $BACKEND_URL, never localhost)
  4. Implement frontend, importing schemas from backend/src/types.ts to parse responses
  5. Test the integration

  <shared_types>
    All API contracts live in backend/src/types.ts as Zod schemas.
    Both backend and frontend can import from this file — single source of truth.
  </shared_types>
</coordination>

<skills>
  Shared skills in .claude/skills/:
  - database-auth: Set up Prisma + Better Auth for user accounts and data persistence
  - ai-apis-like-chatgpt: Use this skill when the user asks you to make an app that requires an AI API.

  Frontend only skills:
  - frontend-app-design: Create distinctive, production-grade web interfaces using React, Tailwind, and shadcn/ui. Use when building pages, components, or styling any web UI.
</skills>

<environment>
  System manages git and dev servers. DO NOT manage these.
  The user views the app through Vibecode Mobile App with a webview preview or Vibecode Web App with an iframe preview.
  The user cannot see code or terminal. Do everything for them.
  Write one-off scripts to achieve tasks the user asks for.
  Communicate in an easy to understand manner for non-technical users.
  Be concise and don't talk too much.
</environment>

<locked_checkpoint date="2026-02-14">
  CRITICAL: The following systems are WORKING PERFECTLY. DO NOT modify these files
  or their core logic unless explicitly asked. Any upgrade must not regress these.

  ## Auth System (cross-origin iframe compatible)
  - backend/src/index.ts: Auth middleware with Bearer token fallback (lines 56-91)
  - backend/src/auth.ts: Better Auth with emailAndPassword, no plugins
  - webapp/src/lib/auth-context.tsx: Custom AuthProvider using localStorage session
  - webapp/src/lib/api.ts: getAuthHeaders() sends Bearer token from localStorage
  - webapp/src/pages/LoginPage.tsx: Direct fetch sign-in, saves session to context
  - webapp/src/pages/SignupPage.tsx: Direct fetch sign-up, saves session to context
  - DO NOT use Better Auth's useSession() hook — it doesn't work in Vibecode iframe
  - DO NOT switch back to cookie-only auth — cookies don't work cross-origin here

  ## PDF Upload Pipeline
  - webapp/src/pages/UploadPage.tsx: Uses api.raw() for upload (NOT XHR)
  - backend/src/routes/upload.ts: Vibecode SDK storage upload
  - CORS config in index.ts: allowHeaders includes "Authorization"
  - DO NOT use XMLHttpRequest for uploads — causes CORS preflight failures

  ## PDF Extraction Pipeline
  - backend/src/services/extraction.ts: MuPDF renders pages to JPEG, sends to GPT-5.2 Vision
  - Uses "mupdf" package (NOT pdfjs-dist, NOT canvas) for PDF page rendering
  - renderPageToJpegBase64(): MuPDF renders at 2x scale, outputs JPEG quality 90
  - callOpenAIVision(): Sends JPEG base64 as image_url to GPT-5.2, temperature 0.1
  - Batch processing: 5 pages concurrently via Promise.allSettled
  - Image generation: FAL AI Flux Pro v1.1 (NOT DALL-E, NOT Gemini)
  - Email notification: Resend API after extraction completes
  - DO NOT replace MuPDF with pdfjs-dist or canvas — they crash in Bun
  - DO NOT send raw PDF to OpenAI — send rendered JPEG images per page

  ## Backend URL
  - webapp/.env VITE_BACKEND_URL must match the actual BACKEND_URL env var
  - Check with: env | grep BACKEND_URL
  - If they don't match, update webapp/.env
</locked_checkpoint>
