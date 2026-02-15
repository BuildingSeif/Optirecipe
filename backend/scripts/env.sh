#!/bin/bash
# Shared environment setup for backend scripts

# CRITICAL: Put safe sqlite3 wrapper ahead in PATH to intercept VACUUM INTO.
# Without this, scripts/start copies the entire DB on every restart, filling the disk.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${SCRIPT_DIR}:${PATH}"

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
  DATA_DIR="${DATA_DIR:-/data}"
  export DATABASE_FILE="${DATA_DIR}/production.db"
  export DATABASE_URL="file:${DATABASE_FILE}"
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi
