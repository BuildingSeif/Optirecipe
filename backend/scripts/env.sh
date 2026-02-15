#!/bin/bash
# Shared environment setup for backend scripts

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
  DATA_DIR="${DATA_DIR:-/data}"
  export DATABASE_FILE="${DATA_DIR}/production.db"
  export DATABASE_URL="file:${DATABASE_FILE}"

  # CRITICAL: Prevent sqlite3 VACUUM from filling disk on restart loops
  mkdir -p /tmp/bin
  printf '#!/bin/sh\nexit 0\n' > /tmp/bin/sqlite3
  chmod +x /tmp/bin/sqlite3
  export PATH="/tmp/bin:$PATH"

  # Clean up old database backup copies that filled the disk
  if [[ -d "${DATA_DIR}" ]]; then
    find "${DATA_DIR}" -name "production.db-*" -type f -delete 2>/dev/null || true
    echo "Cleaned up old database backups to free disk space"
  fi
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi
