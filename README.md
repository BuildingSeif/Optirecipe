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
- Real-time progress tracking
- Automatic image generation per recipe via FAL AI
- Email notification on completion

### Recipe Management
- Browse all recipes with filters: search, status, category, type, cookbook
- Inline editing: modify title, description, ingredients, instructions, metadata
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

## Database Schema

- **Cookbook**: PDF files with type classification (prive/collectivite/both)
- **Recipe**: Extracted recipes with ingredients (JSON), instructions (JSON), dietary booleans, nutrition fields
- **ProcessingJob**: Tracks extraction progress with pause/resume/cancel
- **ExportHistory**: Records export activity

## API Endpoints

- `POST /api/upload/pdf` - Upload PDF
- `GET/POST /api/cookbooks` - CRUD cookbooks
- `GET/POST/PATCH/DELETE /api/recipes` - CRUD recipes with filtering
- `PATCH /api/recipes/bulk/status` - Bulk approve/reject
- `POST /api/processing/start` - Start PDF extraction
- `POST /api/export` - Export recipes (JSON/CSV)

## All UI in French
The entire interface is in French for the target users in French institutional food service.
