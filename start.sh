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
    echo "==> [0/4] Stopping any existing processes..."
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
    echo "==> [1/4] Starting PostgreSQL container..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" up postgres -d

    # Wait for PostgreSQL to be ready before restoring
    echo "    Waiting for PostgreSQL to be ready..."
    for i in {1..15}; do
      if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres \
          pg_isready -U strongair -d strongair_db > /dev/null 2>&1; then
        echo "    PostgreSQL is ready."
        break
      fi
      echo "    Still waiting... ($i/15)"
      sleep 1
    done

    # ── Data file selection ────────────────────────────────────────────────
    echo "==> [2/4] Select data file to restore:"

    DATA_DIR="$ROOT_DIR/frontend/src/data"
    mkdir -p "$DATA_DIR"

    # Collect incremental backup files, sorted by name
    BACKUP_FILES=()
    for f in "$DATA_DIR"/data_backup-*.json; do
      [ -f "$f" ] && BACKUP_FILES+=("$f")
    done
    # Sort (shell glob is alphabetical, but make it explicit)
    IFS=$'\n' BACKUP_FILES=($(printf '%s\n' "${BACKUP_FILES[@]}" | sort)); unset IFS

    echo ""
    echo "  ─────────────────────────────────────"
    echo "  0) Default — data_backup.json"
    for i in "${!BACKUP_FILES[@]}"; do
      echo "  $((i + 1))) $(basename "${BACKUP_FILES[$i]}" .json)"
    done
    echo ""
    read -rp "  Select [0-${#BACKUP_FILES[@]}]: " data_choice

    if [ "$data_choice" = "0" ]; then
      RESTORE_FILE="$DATA_DIR/data_backup.json"
    elif [[ "$data_choice" =~ ^[0-9]+$ ]] && \
         [ "$data_choice" -ge 1 ] && [ "$data_choice" -le "${#BACKUP_FILES[@]}" ]; then
      RESTORE_FILE="${BACKUP_FILES[$((data_choice - 1))]}"
    else
      echo "  Invalid choice. Exiting."
      exit 1
    fi

    if [ ! -f "$RESTORE_FILE" ]; then
      echo "  Error: file not found — $(basename "$RESTORE_FILE")"
      exit 1
    fi

    # ── Python virtual environment ─────────────────────────────────────────
    VENV="$ROOT_DIR/venv"
    if [ ! -f "$VENV/bin/pip" ]; then
      echo "==> [venv] Creating Python virtual environment..."
      python3 -m venv "$VENV"
      echo "==> [venv] Installing backend dependencies..."
      "$VENV/bin/pip" install -r "$ROOT_DIR/backend/requirements.txt"
    fi
    # ──────────────────────────────────────────────────────────────────────

    echo ""
    echo "  Restoring from: $(basename "$RESTORE_FILE")..."
    cd "$ROOT_DIR/backend"
    "$VENV/bin/python3" restore_db.py "$RESTORE_FILE"
    echo ""
    # ──────────────────────────────────────────────────────────────────────

    # Install frontend dependencies only when needed
    echo "==> [3/4] Checking frontend dependencies..."
    cd "$ROOT_DIR/frontend"
    if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
      echo "    Installing dependencies..."
      npm install
    else
      echo "    Dependencies up to date, skipping install."
    fi

    # Launch backend + frontend
    echo "==> [4/4] Starting backend (:8001) and frontend (:3001)..."

    cd "$ROOT_DIR/backend"
    "$VENV/bin/uvicorn" server:app --reload --port 8001 &
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
