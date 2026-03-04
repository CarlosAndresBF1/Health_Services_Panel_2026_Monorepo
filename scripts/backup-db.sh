#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HealthPanel - PostgreSQL Backup Script
#
# Creates a timestamped backup of the HealthPanel database.
# Designed to run on the Docker host or inside a container with pg_dump.
#
# Usage:
#   ./scripts/backup-db.sh                    # Uses .env defaults
#   DB_HOST=localhost DB_PORT=5433 ./scripts/backup-db.sh
#
# Restore:
#   gunzip -c backups/healthpanel_20260304_120000.sql.gz | \
#     docker exec -i healthpanel_postgres psql -U healthpanel -d healthpanel
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Configuration with defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USERNAME="${DB_USERNAME:-healthpanel}"
DB_PASSWORD="${DB_PASSWORD:-healthpanel_secret}"
DB_DATABASE="${DB_DATABASE:-healthpanel}"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_DATABASE}_${TIMESTAMP}.sql.gz"

echo "╔═══════════════════════════════════════════════════╗"
echo "║         HealthPanel Database Backup               ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "  Database: ${DB_DATABASE}@${DB_HOST}:${DB_PORT}"
echo "  Output:   ${BACKUP_FILE}"
echo ""

# Run backup via Docker container (uses the same postgres image)
export PGPASSWORD="$DB_PASSWORD"

if command -v pg_dump &>/dev/null; then
  # pg_dump available locally
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" \
    --no-owner --no-privileges --clean --if-exists | gzip >"$BACKUP_FILE"
else
  # Use Docker container
  docker exec healthpanel_postgres pg_dump \
    -U "$DB_USERNAME" -d "$DB_DATABASE" \
    --no-owner --no-privileges --clean --if-exists | gzip >"$BACKUP_FILE"
fi

unset PGPASSWORD

# Verify backup
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "  ✅ Backup completed: ${BACKUP_SIZE}"

# Cleanup old backups
if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l | xargs)
  if [[ "$DELETED" -gt 0 ]]; then
    echo "  🗑  Removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
  fi
fi

echo ""
echo "Done."
