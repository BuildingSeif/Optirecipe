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

<deployment_rule>
  CRITICAL DEPLOYMENT WORKFLOW — ALWAYS FOLLOW THIS:
  - Editing/development happens in Vibecode (this sandbox)
  - Production deployment goes through GitHub → Railway (auto-deploy)
  - After ANY code changes, ALWAYS push to GitHub so Railway picks them up
  - GitHub repo: BuildingSeif/Optirecipe (main branch)
  - GitHub token is stored in /.github-token (gitignored, NEVER commit to repo)
  - NEVER put GITHUB_TOKEN in backend/.env — GitHub secret scanning will revoke it
  - Remote "github" is configured with the token in its URL
  - To update token: git remote set-url github "https://x-access-token:<TOKEN>@github.com/BuildingSeif/Optirecipe.git"
  - DO NOT tell the user to click Deploy on Vibecode — Vibecode does NOT handle the database
  - DO NOT forget to push — if it's not on GitHub, it's not live for Nicolas
  - Railway auto-deploys from the main branch on every push
  - Production database: PostgreSQL on Railway (see DATABASE_PUBLIC_URL in backend/.env)
  - Railway volume "optirecipe-volume" mounted at /data/uploads for persistent PDF storage
</deployment_rule>

<railway_api_rule>
  CRITICAL SELF-SERVICE RULE — DO EVERYTHING YOURSELF:
  - Railway API token is stored in /.railway-token (gitignored, NEVER commit to repo)
  - NEVER ask the user to do Railway tasks manually — use the Railway GraphQL API
  - API endpoint: https://backboard.railway.com/graphql/v2
  - Auth header: Project-Access-Token (NOT Bearer)
  - Project ID: c30116c5-de38-4f77-8a7b-42b48d93a183
  - Environment ID: 1a7bebcf-7b44-460d-9039-3ba47d9ec68c
  - Service ID: d77329c6-d4a7-42f3-b3b5-189ff355a024
  - Volume ID: f423327f-54cf-4a0e-abe9-45de80b11a64 (mounted at /data/uploads)
  - Use the API to: create volumes, trigger redeploys, check deployment status, manage variables
  - If you need a token or API key to do something, ask the user for it ONCE, save it in a gitignored file, and use it forever
  - The goal: user should never need to touch Railway dashboard — you handle everything
</railway_api_rule>

<locked_checkpoint date="2026-02-22">
  CRITICAL: The following systems are WORKING PERFECTLY. DO NOT modify these files
  or their core logic unless explicitly asked. Any upgrade must not regress these.

  ## Auth System — OTP Login (cross-origin iframe compatible)
  - backend/src/routes/otp.ts: OTP request + verify endpoints (NEVER modify or delete)
    - POST /api/otp/request-otp: validates whitelist, generates 6-digit code, sends via Resend
    - POST /api/otp/verify-otp: validates code, creates/finds user, creates session, returns token
    - Email whitelist (case-insensitive): saif@highticketkreator.com, nicolas.bertin@opti-marche.com, nouhaila.ezzahr@opti-marche.com
    - OtpCode table in Prisma schema: stores email, code, expiresAt (5 min), used flag
  - backend/src/index.ts: Mounts otpRouter at /api/otp + auth middleware with Bearer token fallback
  - backend/src/auth.ts: Better Auth with emailAndPassword (kept for session infrastructure)
  - backend/src/services/email.ts: sendOTPEmail() sends OTP via Resend API
  - webapp/src/pages/LoginPage.tsx: Email-only form, calls /api/otp/request-otp, navigates to /verify-otp
  - webapp/src/pages/VerifyOtpPage.tsx: 6-digit OTP input, calls /api/otp/verify-otp, saves session
  - webapp/src/lib/auth-context.tsx: Custom AuthProvider using localStorage session
  - webapp/src/lib/api.ts: getAuthHeaders() sends Bearer token from localStorage
  - DO NOT switch to password-based login — OTP is the only login method
  - DO NOT use Better Auth's useSession() hook — it doesn't work in Vibecode iframe
  - DO NOT switch back to cookie-only auth — cookies don't work cross-origin here
  - DO NOT modify the email whitelist without explicit user request
  - DO NOT change the OTP flow (request code → enter code → session created)
  - DO NOT delete or rename the OtpCode table in the Prisma schema

  ## Background
  - webapp/src/components/layout/PersistentBackground.tsx: Unicorn Studio aura background
  - Uses data-us-project="yWZ2Tbe094Fsjgy9NRnD" with UnicornStudio.js v1.4.29
  - DO NOT replace with Spline or other 3D backgrounds

  ## UI Design System
  - New ct-card system: bg-black/40, border-white/12, backdrop-blur-12px, inset top glow
  - ct-card-glow: radial gradient glow at top
  - ct-light-bar: thin white gradient line at top of cards
  - ct-input: glass input styling
  - sidebar-nav-item: CryptoTrade-style sidebar navigation
  - Plus Jakarta Sans for headings (font-heading class)
  - DO NOT revert to glass-card-static or gradient text on section headings

  ## PDF Upload Pipeline
  - webapp/src/pages/UploadPage.tsx: Uses api.raw() for ALL uploads (direct + chunked)
  - Chunked upload (>10MB): api.raw() for init/chunk/complete endpoints (NOT direct fetch)
  - Direct upload (<10MB): api.raw() for /api/upload/pdf
  - Max 5 PDFs per batch, uploads run concurrently, extraction queued sequentially
  - backend/src/routes/upload.ts: Vibecode SDK storage upload
  - CORS config in index.ts: allowHeaders includes "Authorization"
  - DO NOT use XMLHttpRequest for uploads — causes CORS preflight failures
  - DO NOT use direct fetch() for chunked uploads — must use api.raw() for auth + CORS

  ## Extraction Queue & Recovery (MULTI-USER SCALE)
  - backend/src/services/extraction.ts: Concurrent extraction with smart priority
  - Small PDFs (≤20 pages OR <5MB): fast lane, max 5 concurrent (MAX_SMALL_CONCURRENT)
  - Large PDFs: queued, max 3 concurrent (MAX_LARGE_CONCURRENT)
  - extractRecipesFromPDF() checks size, routes to fast lane or queue
  - Progress writes throttled to max 1 per 3s per job (PROGRESS_UPDATE_INTERVAL_MS)
  - backend/src/index.ts: recoverOrphanedJobs() runs 3s after startup
    - Jobs with progress: auto-resumed from currentPage
    - Jobs without progress: marked as failed with French error message
  - Frontend polls every 5s during processing, 15s when paused
  - DO NOT remove the extraction queue — uncontrolled concurrency floods OpenAI
  - DO NOT remove startup recovery — orphaned jobs cause infinite frontend polling
  - DO NOT remove the small PDF fast-track — users expect quick results on small files
  - DO NOT remove progress write throttling — SQLite locks under concurrent writes

  ## PDF Extraction Pipeline (HARDENED — DO NOT MODIFY)
  - backend/src/services/extraction.ts: MuPDF renders pages to JPEG, sends to GPT-5.2 Vision
  - Uses "mupdf" package (NOT pdfjs-dist, NOT canvas) for PDF page rendering
  - renderPageToJpegBase64(): MuPDF renders at 2x scale, outputs JPEG quality 90, doc.destroy() in finally
  - getPdfPageCount(): MuPDF page count with doc.destroy() in finally
  - callOpenAIVision(): Sends JPEG base64 as image_url to GPT-5.2, temperature 0.1
    - 401 (invalid API key) fails fast — no retries, clear French error message
    - 402 (credit exhaustion) fails fast — no retries, clear error message
    - 429 (rate limit) retries with 5s * attempt backoff
    - Other errors retry up to MAX_RETRIES=3 with 2s * attempt backoff
  - Batch processing: BATCH_SIZE=5 base, adaptive (8 for 200+ pages, 10 for 500+ pages)
  - PDF buffer read ONCE from disk, reused across all batches, freed after extraction
  - Pipeline architecture: pre-renders next batch while current batch processes via OpenAI
  - Pre-filter: classifyPageCheap() uses GPT-4o-mini to skip non-recipe pages
  - First-batch all-fail detection: aborts immediately if ALL pages in first batch fail (bad API key)
  - Zero-recipes final check: marks job as "failed" if 0 recipes and failed pages > 0
  - Error pages: page_type="error" goes to errorLog, NOT stored as NonRecipeContent
  - Image generation: FAL AI Flux Pro v1.1 via throttled queue (2 at a time, 1s between batches)
  - Email notification: Resend API after extraction completes (non-blocking)
  - Re-extract endpoint: POST /api/processing/re-extract cleans old data and re-runs
  - Pause/Resume: pausedJobs Set controls loop, resume re-launches from currentPage
  - Recipe deduplication: Jaccard similarity > 0.8 on normalized titles, keeps richer version
  - Recipe validation: checks ingredients, instructions, title, category, servings
  - Multi-page continuations: is_continuation merges with previous recipe
  - Processing log cap: 100 entries max, keeps last 50 when trimming
  - Constants: MAX_RETRIES=3, BATCH_SIZE=5, MAX_RECIPES_PER_PDF=2000, RATE_LIMIT_DELAY_MS=500
  - DO NOT replace MuPDF with pdfjs-dist or canvas — they crash in Bun
  - DO NOT send raw PDF to OpenAI — send rendered JPEG images per page
  - DO NOT remove doc.destroy() calls — causes memory leaks on large PDFs
  - DO NOT fire image generation synchronously — must use the throttled queue
  - DO NOT retry 401 or 402 errors — they indicate permanent failures, not transient
  - DO NOT store error pages as NonRecipeContent — they pollute real content
  - DO NOT re-read the PDF file from disk on every batch — use the single buffer
  - DO NOT remove the pre-filter — it saves significant OpenAI costs on large PDFs
  - DO NOT remove first-batch abort — it prevents wasting API calls on bad keys
  - DO NOT remove the pipeline pre-rendering — it overlaps I/O with API calls
  - DO NOT change adaptive batch sizing — it's tuned for 1000-page PDFs

  ## Storage & File Serving (Railway Volume)
  - backend/src/services/storage.ts: Saves uploads to /data/uploads on Railway, /app/uploads locally
  - backend/src/index.ts: Serves /uploads/:filename from the SAME directory as storage
  - Both use isRailway detection: !!process.env.RAILWAY_STATIC_URL || !!process.env.RAILWAY_ENVIRONMENT
  - Railway volume "optirecipe-volume" (ID: f423327f-54cf-4a0e-abe9-45de80b11a64) mounted at /data/uploads
  - backend/Dockerfile: mkdir -p /app/uploads /data/uploads /tmp/pdf-chunks
  - DO NOT change the upload directory without also changing the serving directory — they MUST match
  - DO NOT use /app/uploads on Railway — it's ephemeral and wiped on every deploy
  - DO NOT remove the Railway volume — uploaded PDFs will be lost permanently

  ## Export System
  - backend/src/routes/export.ts: CSV (UTF-8 BOM for Excel), JSON (OptiRecipe format), PDF (client-side)
  - CSV: proper escaping, ingredient formatting, nutrition info, dietary tags, tips
  - JSON: safe JSON parsing with try/catch for ingredients/instructions
  - webapp/src/pages/ExportPage.tsx: CSV error handling, PDF print with load event + 2s fallback
  - DO NOT remove UTF-8 BOM from CSV — Excel will show garbled French characters

  ## Ingredient Image System
  - backend/src/routes/ingredient-images.ts: POST /batch generates + caches ingredient photos
  - Uses FAL AI Flux Pro v1.1 with white background prompt
  - IngredientImage table caches by normalized lowercase name (generate once, serve forever)
  - Chunks of 3 concurrent generations, graceful error handling per ingredient
  - Frontend queries via useQuery with 1-hour staleTime
  - DO NOT move generation to extraction pipeline (too slow, would block extraction)

  ## Backend URL
  - webapp/.env VITE_BACKEND_URL must match the actual BACKEND_URL env var
  - Check with: env | grep BACKEND_URL
  - If they don't match, update webapp/.env
</locked_checkpoint>
