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
- Batch processing: 5 pages concurrently
- Real-time extraction monitor with per-cookbook tabs and live recipe feed
- Pause/resume/stop controls during extraction
- Automatic image generation per recipe via FAL AI
- Email notification on completion

### Categories System
9 categories with 55 sub-categories from client's Excel, seeded into the database:
- Entree, Plat protidique, Accompagnement, Produit laitier, Dessert, Petit-dejeuner / Brunch, Gouter, Sauce, Base
- Dynamic category/sub-category dropdowns (sub-categories filtered by selected category)
- API endpoint: GET /api/categories

### Recipe Management
- Browse all recipes with filters: search, status, category, type, cookbook
- Inline editing: modify title, description, ingredients, instructions, metadata
- Dynamic category/sub-category dropdowns in edit mode
- Approve/reject workflow with auto-navigation to next pending recipe
- Dietary flags: vegetarian, vegan, gluten-free, lactose-free, halal
- Difficulty levels: facile, moyen, difficile
- Recipe types: prive (home), collectivite (institutional), both

### Export
- JSON export in OptiMenu-compatible format
- CSV export for spreadsheets
- PDF export for printing
- Filter by status, type, category, cookbook before exporting
- Dietary and nutrition data included in exports

### Authentication
- Email/password auth via Better Auth with Bearer token fallback (cross-origin iframe compatible)
- Email whitelist: only approved emails can sign in/sign up
- Whitelisted: saif@highticketkreator.com, nicolas.bertin@opti-marche.com, nouhaila.ezzahr@opti-marche.com

## Database Schema

- **Category**: 9 food categories with ordering
- **SubCategory**: 55 sub-categories linked to categories
- **Cookbook**: PDF files with type classification (prive/collectivite/both)
- **Recipe**: Extracted recipes with ingredients (JSON), instructions (JSON), dietary booleans, nutrition fields
- **ProcessingJob**: Tracks extraction progress with pause/resume/cancel
- **ExportHistory**: Records export activity

## API Endpoints

- `POST /api/upload/pdf` - Upload PDF
- `GET /api/categories` - List all categories with sub-categories (public)
- `GET/POST /api/cookbooks` - CRUD cookbooks
- `GET/POST/PATCH/DELETE /api/recipes` - CRUD recipes with filtering
- `PATCH /api/recipes/bulk/status` - Bulk approve/reject
- `POST /api/processing/start` - Start PDF extraction
- `POST /api/processing/:id/pause` - Pause extraction
- `POST /api/processing/:id/resume` - Resume extraction
- `POST /api/processing/:id/cancel` - Cancel extraction
- `POST /api/export` - Export recipes (JSON/CSV)

## All UI in French
The entire interface is in French for the target users in French institutional food service.
