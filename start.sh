#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If no argument given, prompt the user
if [ -z "$1" ]; then
  echo ""
  echo "  Strong Air — Start Script"
  echo "  ─────────────────────────"
  echo "  1) Development  (frontend :3001, backend :8001, hot reload)"
  echo "  2) Production   (full Docker stack, nginx :80)"
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
    echo "==> [dev] Starting development environment..."

    # Kill any already-running instances so we always get a clean restart
    echo "==> [0/3] Stopping any existing processes..."
    pkill -f "uvicorn server:app" 2>/dev/null && echo "    Previous backend stopped." || true
    pkill -f "react-scripts start" 2>/dev/null && echo "    Previous frontend stopped." || true
    # Also free the ports directly in case a process is still holding them after SIGTERM
    fuser -k 8001/tcp 2>/dev/null || true
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 1

    # Load all env vars from root .env so the frontend dev server picks them up
    set -a
    # shellcheck source=.env
    source "$ROOT_DIR/.env"
    set +a

    # Start only the postgres container
    echo "==> [1/3] Starting PostgreSQL container..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" up postgres -d

    # Install frontend dependencies only when needed
    echo "==> [2/3] Checking frontend dependencies..."
    cd "$ROOT_DIR/frontend"
    if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
      echo "    Installing dependencies..."
      npm install
    else
      echo "    Dependencies up to date, skipping install."
    fi

    # Launch backend + frontend
    echo "==> [3/3] Starting backend (:8001) and frontend (:3001)..."

    cd "$ROOT_DIR/backend"
    uvicorn server:app --reload --port 8001 &
    BACKEND_PID=$!

    cd "$ROOT_DIR/frontend"
    BROWSER=none npm start &
    FRONTEND_PID=$!

    # Clean shutdown on Ctrl+C
    trap "echo ''; echo '==> Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

    echo ""
    echo "  Frontend : http://localhost:3001"
    echo "  Backend  : http://localhost:8001"
    echo "  API docs : http://localhost:8001/docs"
    echo ""
    echo "Press Ctrl+C to stop."

    wait $BACKEND_PID $FRONTEND_PID
    ;;

  # ─── PRODUCTION ───────────────────────────────────────────────────────────
  prod)
    echo "==> [prod] Building and starting production stack..."

    cd "$ROOT_DIR"
    docker compose down --remove-orphans
    docker compose up --build -d

    echo ""
    echo "  App   : http://localhost:3001"
    echo "  Stack : postgres, backend, frontend, nginx"
    echo ""
    echo "Logs: docker compose logs -f"
    ;;

  *)
    usage
    ;;
esac
