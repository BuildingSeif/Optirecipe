#!/bin/bash
# Shared environment setup for backend scripts

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
  DATA_DIR="${DATA_DIR:-/data}"
  export DATABASE_FILE="${DATA_DIR}/production.db"
  export DATABASE_URL="file:${DATABASE_FILE}"

  # Ensure sqlite3 CLI is available for DB backup in start script.
  # If not installed, create a no-op wrapper so the backup step doesn't crash.
  if ! command -v sqlite3 &>/dev/null; then
    echo "Warning: sqlite3 not found, creating no-op wrapper"
    mkdir -p /tmp/bin
    printf '#!/bin/sh\necho "sqlite3 not available, skipping"\n' > /tmp/bin/sqlite3
    chmod +x /tmp/bin/sqlite3
    export PATH="/tmp/bin:$PATH"
  fi
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi
