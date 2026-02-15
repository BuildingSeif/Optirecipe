#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

# Boot script: identical to scripts/start but with disk protection.
# The template system reverts scripts/start and scripts/env.sh,
# so this file exists as an unmanaged alternative.

# === Environment Setup (mirrors env.sh) ===
ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
  DATA_DIR="${DATA_DIR:-/data}"
  export DATABASE_FILE="${DATA_DIR}/production.db"
  export DATABASE_URL="file:${DATABASE_FILE}"

  # === Disk Protection ===
  # Clean up old database backup copies that may have filled the disk
  if [[ -d "${DATA_DIR}" ]]; then
    backup_count=$(find "${DATA_DIR}" -name "production.db-*" -type f 2>/dev/null | wc -l)
    if [[ "$backup_count" -gt 0 ]]; then
      echo "[Boot] Cleaning up ${backup_count} old database backup(s) to free disk space..."
      find "${DATA_DIR}" -name "production.db-*" -type f -delete 2>/dev/null || true
    fi
  fi

  # Skip the VACUUM backup entirely — it fills disk on crash loops
  echo "[Boot] Skipping database VACUUM backup (disk protection)"
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi

# === Install Dependencies ===
echo "Installing dependencies..."
bun install

# === Prisma Setup ===
if [[ -f "prisma/schema.prisma" ]]; then
  echo "Generating Prisma client..."
  bunx prisma generate
  echo "Pushing schema to database..."
  bunx prisma db push --accept-data-loss

  # Enable DB viewer (idempotent, safe to call multiple times)
  if [[ -n "${VIBECODE_PROJECT_ID:-}" ]]; then
    echo "Enabling database viewer..."
    curl -s -X POST "https://api.vibecodeapp.com/api/projects/${VIBECODE_PROJECT_ID}/cloud/db/enable" || true
  fi
fi

# === Start Server ===
if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting server in production mode..."
  exec bun src/index.ts
else
  echo "Starting server in dev mode with hot reload..."
  exec bun --hot src/index.ts
fi
