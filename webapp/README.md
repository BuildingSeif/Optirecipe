# OptiRecipe

Professional recipe extraction system for OptiMenu's 1000CHEFS database.

## Overview

OptiRecipe is a production-grade web application for extracting, processing, and standardizing recipes from scanned cookbook PDFs. It outputs recipes in a specific format for import into the 1000CHEFS database, which powers OptiMenu - a meal planning platform for French institutional food service (schools, hospitals, corporate cafeterias).

## Features

- **PDF Upload**: Upload cookbook PDFs up to 100MB
- **AI Extraction**: Automatic recipe extraction using GPT-4 Vision
- **Quantity Conversion**: All quantities converted to grams for accurate cost calculation
- **Copyright Reformulation**: Instructions reformulated to avoid plagiarism
- **Review Workflow**: Approve, reject, or edit extracted recipes
- **Export**: Export approved recipes in 1000CHEFS JSON or CSV format

## Tech Stack

### Frontend (webapp/)
- React with Vite
- TypeScript
- Tailwind CSS with shadcn/ui components
- React Query for server state
- React Router for navigation
- React Dropzone for file uploads

### Backend (backend/)
- Bun runtime
- Hono web framework
- Prisma ORM with SQLite
- Better Auth for authentication (Email OTP)
- Zod for validation

## Pages

- `/login` - Email login
- `/verify-otp` - OTP verification
- `/dashboard` - Overview with stats and recent activity
- `/upload` - Upload new cookbook PDFs
- `/cookbooks` - List all uploaded cookbooks
- `/cookbooks/:id` - Cookbook details and recipes
- `/recipes` - All recipes with filtering
- `/recipes/:id` - Recipe detail and editing
- `/export` - Export recipes to 1000CHEFS format
- `/settings` - User settings

## API Routes

### Auth
- `POST /api/auth/email-otp/send-verification-otp` - Send OTP
- `POST /api/auth/sign-in/email-otp` - Verify OTP and sign in
- `GET /api/auth/session` - Get current session

### Cookbooks
- `GET /api/cookbooks` - List cookbooks
- `GET /api/cookbooks/:id` - Get cookbook details
- `POST /api/cookbooks` - Create cookbook
- `PATCH /api/cookbooks/:id` - Update cookbook
- `DELETE /api/cookbooks/:id` - Delete cookbook

### Recipes
- `GET /api/recipes` - List recipes with filters
- `GET /api/recipes/:id` - Get recipe details
- `POST /api/recipes` - Create recipe
- `PATCH /api/recipes/:id` - Update recipe
- `PATCH /api/recipes/bulk/status` - Bulk update recipe status
- `DELETE /api/recipes/:id` - Delete recipe

### Processing
- `GET /api/processing` - List processing jobs
- `GET /api/processing/:id` - Get job details
- `POST /api/processing/start` - Start processing a cookbook
- `POST /api/processing/:id/cancel` - Cancel processing

### Export
- `POST /api/export` - Generate export
- `GET /api/export/history` - Export history

### Stats
- `GET /api/stats` - Dashboard stats
- `GET /api/stats/recent` - Recent activity

### Upload
- `POST /api/upload/pdf` - Upload PDF file
- `GET /api/upload/files` - List files
- `DELETE /api/upload/:id` - Delete file

## Database Schema

Key tables:
- `User` - User accounts (Better Auth)
- `Cookbook` - Uploaded PDF cookbooks
- `Recipe` - Extracted recipes
- `ProcessingJob` - Processing job tracking
- `ExportHistory` - Export records

## Development

The app runs automatically on Vibecode:
- Frontend: http://localhost:8000
- Backend: http://localhost:3000

## Design System

Brand colors (OptiPro/OptiMenu):
- Primary: #1E3A5F (dark blue)
- Accent: #FF6B35 (orange)
- Success: #10B981 (green)
- Warning: #F59E0B (amber)
- Error: #EF4444 (red)

Typography: Inter font family
