#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  Strong Air — Refresh Script"
echo "  ───────────────────────────"
echo "  1) Development  (clean venv + fresh start)"
echo "  2) Production   (clean venv + Docker rebuild)"
echo ""

if [ -z "$1" ]; then
  read -rp "  Select environment [1/2]: " choice
  case "$choice" in
    1) MODE="dev" ;;
    2) MODE="prod" ;;
    *)
      echo "Invalid choice. Exiting."
      exit 1
      ;;
  esac
else
  MODE="$1"
fi

echo ""
echo "==> Cleaning up..."

# Remove venv so dependencies are reinstalled fresh
if [ -d "$ROOT_DIR/venv" ]; then
  echo "    Removing Python virtual environment..."
  rm -rf "$ROOT_DIR/venv"
fi

if [ "$MODE" = "prod" ]; then
  echo "    Clearing Docker builder cache..."
  docker builder prune -f

  echo "    Removing old Docker images..."
  docker image rm strongair-frontend 2>/dev/null && echo "    Removed strongair-frontend." || echo "    strongair-frontend not found, skipping."
  docker image rm strongair-backend  2>/dev/null && echo "    Removed strongair-backend."  || echo "    strongair-backend not found, skipping."
fi

echo ""
echo "==> Clean complete. Handing off to start.sh..."
echo ""

exec "$ROOT_DIR/start.sh" "$MODE"
