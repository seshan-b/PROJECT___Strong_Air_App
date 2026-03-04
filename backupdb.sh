#!/bin/bash
# backupdb.sh — Dump the current database to an incremental JSON backup.
# Backups are saved to frontend/src/data/data_backup-NN.json (e.g. data_backup-01.json).
# Run from the project root: ./backupdb.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$ROOT_DIR/frontend/src/data"

# Load env vars so DATABASE_URL is available if set
set -a
# shellcheck source=.env
[ -f "$ROOT_DIR/.env" ] && source "$ROOT_DIR/.env"
set +a

mkdir -p "$DATA_DIR"

# Find the highest existing incremental number
LAST_NUM=0
for f in "$DATA_DIR"/data_backup-*.json; do
  [ -f "$f" ] || continue
  NUM=$(basename "$f" .json | sed 's/data_backup-//')
  # Strip leading zeros so bash treats it as decimal
  NUM=$((10#$NUM))
  if [ "$NUM" -gt "$LAST_NUM" ]; then
    LAST_NUM=$NUM
  fi
done

NEXT_NUM=$((LAST_NUM + 1))
PADDED=$(printf "%02d" "$NEXT_NUM")
OUTPUT="$DATA_DIR/data_backup-${PADDED}.json"

echo ""
echo "  Strong Air — Database Backup"
echo "  ─────────────────────────────"
echo "  Creating: data_backup-${PADDED}.json"
echo ""

cd "$ROOT_DIR/backend"
python3 backup_db.py "$OUTPUT"

echo ""
echo "  Saved to: frontend/src/data/data_backup-${PADDED}.json"
echo ""
