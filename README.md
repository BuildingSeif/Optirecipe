# OptiRecipe

Recipe extraction platform for institutional food service in France (schools, hospitals, cafeterias). Extracts recipes from scanned PDF cookbooks and builds a structured database compatible with OptiMenu.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (port 8000)
- **Backend**: Bun + Hono + Prisma (SQLite) + Better Auth (port 3000)
- **PDF Rendering**: MuPDF (renders pages to JPEG)
- **AI Extraction**: OpenAI GPT-5.2 Vision (extracts recipes from page images)
- **Image Generation**: FAL AI Flux Pro v1.1
- **Email**: Resend API

## Features

### PDF Upload & Extraction
- Upload PDFs up to 500MB (chunked upload for large files)
- Options screen before processing: select recipe type (Prive/Collectivite) and toggle image generation
- MuPDF renders each page as JPEG at 2x resolution
- GPT-5.2 Vision extracts recipes with ingredients, instructions, dietary flags, difficulty
- Temperature detection: Celsius, Fahrenheit, and French thermostat (1-10) with automatic conversion
- Batch processing: 5 pages concurrently with single PDF doc open per batch (memory efficient)
- 90-second timeout per OpenAI API call to prevent hung jobs
- Forced progress saves after every batch for crash recovery on large PDFs (500+ pages)
- Dynamic JPEG quality (80 for large PDFs, 90 for small) to reduce memory pressure
- Max 2000 recipes per PDF (supports large institutional cookbooks)
- Real-time extraction monitor with per-cookbook tabs and live recipe feed
- Pause/resume/stop controls during extraction
- Automatic image generation per recipe via FAL AI (French cuisine style prompt)
- Email notification on completion

### Categories System
9 categories with 55 sub-categories from client's Excel, seeded into the database:
- Entree, Plat protidique, Accompagnement, Produit laitier, Dessert, Petit-dejeuner / Brunch, Gouter, Sauce, Base
- Dynamic category/sub-category dropdowns (sub-categories filtered by selected category)
- API endpoint: GET /api/categories

### Countries & Regions
- 15 countries seeded (France, Italie, Espagne, Maroc, Grece, Liban, Japon, Chine, Thailande, Inde, Mexique, Etats-Unis, Belgique, Suisse, Allemagne)
- 21 French regions seeded (Alsace through Rhone-Alpes)
- Country/region dropdowns in recipe edit (region only shows when France is selected)
- API endpoint: GET /api/countries (with nested regions)

### Recipe Management
- Browse all recipes with filters: search, status, category, type, cookbook
- Search across title, description, ingredients, category, sub-category
- Inline editing: modify title, description, ingredients, instructions, metadata
- Dynamic category/sub-category and country/region dropdowns in edit mode
- Approve/reject workflow with auto-navigation to next pending recipe
- Dietary flags: vegetarian, vegan, gluten-free, lactose-free, halal
- Difficulty levels: facile, moyen, difficile
- Recipe types: prive (home), collectivite (institutional), both
- Temperature display: "180°C (356°F)" in instructions
- Bulk operations: select multiple recipes, approve/reject/delete in batch

### Cookbook Detail
- Stats cards: total, pending, approved, rejected recipe counts
- "Approuver toutes les recettes" bulk action
- "Exporter ce livre" link
- "Supprimer ce livre" with confirmation
- Full recipe list with status indicators

### Export
- JSON export in OptiMenu-compatible format with stats summary
- Stats include: by_category, by_type, by_difficulty, dietary breakdown
- CSV export for spreadsheets
- PDF export for printing (professional A4 format)
- Filter by status, type, category, cookbook before exporting
- Dietary and nutrition data included in exports

### Translations
- French translations file at webapp/src/lib/translations/fr.ts
- All display labels structured for future multi-language support
- Status, type, difficulty, dietary, season translations

### Authentication
- Email/password auth via Better Auth with Bearer token fallback (cross-origin iframe compatible)
- Email whitelist: only approved emails can sign in/sign up
- Whitelisted: saif@highticketkreator.com, nicolas.bertin@opti-marche.com, nouhaila.ezzahr@opti-marche.com

### Premium Glass UI
- Custom GlassButton component with glass morphism effect, compact sizing (10px border-radius)
- 6 variants: default, primary (blue), destructive (red), success (green), warning (amber), ghost
- Conic gradient borders, shine overlay, 3D press effect
- Applied across all primary action buttons in the app

### CryptoTrade-Inspired Design System
- Unicorn Studio aura background (data-us-project yWZ2Tbe094Fsjgy9NRnD)
- `ct-card` system: bg-black/40 + border-white/12 + backdrop-blur-12px + inset top glow
- `ct-card-glow`: radial gradient glow at card top
- `ct-light-bar`: thin white gradient line at card top
- `ct-input`: glass input fields with focus ring
- Sidebar: bg-black/50, CryptoTrade-style navigation with active bg-white/12
- Plus Jakarta Sans for headings (`font-heading`), Inter for body
- Breadcrumb navigation on every page
- Status dots with colored glow shadows
- Skeleton shimmer loading states

## Database Schema

- **Category**: 9 food categories with ordering
- **SubCategory**: 55 sub-categories linked to categories
- **Country**: 15 cuisine countries with code
- **Region**: 21 French regions linked to France
- **Cookbook**: PDF files with type classification (prive/collectivite/both)
- **Recipe**: Extracted recipes with ingredients (JSON), instructions (JSON), dietary booleans, nutrition fields, country/region
- **ProcessingJob**: Tracks extraction progress with pause/resume/cancel
- **ExportHistory**: Records export activity

## API Endpoints

- `POST /api/upload/pdf` - Upload PDF
- `GET /api/categories` - List all categories with sub-categories (public)
- `GET /api/countries` - List all countries with regions (public)
- `GET/POST /api/cookbooks` - CRUD cookbooks
- `GET/POST/PATCH/DELETE /api/recipes` - CRUD recipes with filtering
- `PATCH /api/recipes/bulk/status` - Bulk approve/reject
- `POST /api/processing/start` - Start PDF extraction
- `POST /api/processing/:id/pause` - Pause extraction
- `POST /api/processing/:id/resume` - Resume extraction
- `POST /api/processing/:id/cancel` - Cancel extraction
- `POST /api/export` - Export recipes (JSON/CSV) with stats summary

## All UI in French
The entire interface is in French for the target users in French institutional food service.
