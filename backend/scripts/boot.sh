#!/bin/bash
# Boot wrapper: runs BEFORE scripts/start to fix production disk issues
# This script is NOT managed by the Vibecode template system

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  DATA_DIR="${DATA_DIR:-/data}"

  # 1. Clean up old database backup copies that filled the disk
  if [[ -d "${DATA_DIR}" ]]; then
    backup_count=$(find "${DATA_DIR}" -name "production.db-*" -type f 2>/dev/null | wc -l)
    if [[ "$backup_count" -gt 0 ]]; then
      echo "[Boot] Cleaning up ${backup_count} old database backup(s) to free disk space..."
      find "${DATA_DIR}" -name "production.db-*" -type f -delete 2>/dev/null || true
    fi
  fi

  # 2. Override sqlite3 with a no-op to prevent VACUUM from creating new backups
  #    scripts/start runs: echo "VACUUM INTO ..." | sqlite3 "$DATABASE_FILE"
  #    Each VACUUM creates a full copy of the DB. On crash loops this fills the disk.
  mkdir -p /tmp/bin
  printf '#!/bin/sh\nexit 0\n' > /tmp/bin/sqlite3
  chmod +x /tmp/bin/sqlite3
  export PATH="/tmp/bin:$PATH"
  echo "[Boot] sqlite3 VACUUM override active, disk protection enabled"
fi

# Now run the actual start script
exec bash "$(dirname "$0")/start"
