#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If no argument given, prompt the user
if [ -z "$1" ]; then
  echo ""
  echo "  Strong Air — Stop Script"
  echo "  ────────────────────────"
  echo "  1) Development  (kill uvicorn + npm, stop postgres container)"
  echo "  2) Production   (bring down full Docker stack)"
  echo ""
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

case "$MODE" in

  # ─── LOCAL DEVELOPMENT ────────────────────────────────────────────────────
  dev)
    echo "==> [dev] Stopping development environment..."

    echo "==> Killing uvicorn (backend :8001)..."
    pkill -f "uvicorn server:app" 2>/dev/null && echo "    Backend stopped." || echo "    Backend was not running."

    echo "==> Killing npm start (frontend :3001)..."
    pkill -f "react-scripts start" 2>/dev/null && echo "    Frontend stopped." || echo "    Frontend was not running."

    echo "==> Stopping PostgreSQL container..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" stop postgres

    echo ""
    echo "Development environment stopped."
    ;;

  # ─── PRODUCTION ───────────────────────────────────────────────────────────
  prod)
    echo "==> [prod] Bringing down production stack..."

    cd "$ROOT_DIR"
    docker compose down --remove-orphans

    echo ""
    echo "Production stack stopped."
    ;;

  *)
    echo "Usage: $0 [dev|prod]"
    exit 1
    ;;
esac
