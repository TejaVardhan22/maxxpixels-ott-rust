#!/usr/bin/env bash
# ==============================================================================
# MaxxPixels OTT — One-Command Docker VPS Deploy Script
# Usage:
#   ./deploy.sh                  # Build & start all core services
#   ./deploy.sh api              # Rebuild & restart only the Rust API
#   ./deploy.sh --with-tools     # Include optional media-streamer service
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 plugin is required." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Run: cp .env.example .env && nano .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" || "${DATABASE_URL}" == *"CHANGE_ME"* ]]; then
  echo "ERROR: Set a valid DATABASE_URL in .env pointing to host.docker.internal:5432" >&2
  exit 1
fi

if [[ -z "${GAMES_DATABASE_URL:-}" || "${GAMES_DATABASE_URL}" == *"CHANGE_ME"* ]]; then
  echo "WARNING: GAMES_DATABASE_URL is missing or placeholder in .env (games service requires it)." >&2
fi

PROFILE_ARGS=()
SERVICES=()
for arg in "$@"; do
  if [[ "$arg" == "--with-tools" ]]; then
    PROFILE_ARGS+=(--profile tools)
  else
    SERVICES+=("$arg")
  fi
done

echo "==> Checking host PostgreSQL reachability from Docker (host.docker.internal:5432)..."
if ! docker run --rm --add-host=host.docker.internal:host-gateway alpine:3.20 \
  sh -c "nc -z -w 3 host.docker.internal 5432" >/dev/null 2>&1; then
  echo "WARNING: Containers cannot reach host.docker.internal:5432 yet." >&2
  echo "         Check postgresql.conf (listen_addresses) and pg_hba.conf (Docker subnet 172.16.0.0/12)." >&2
  echo "         See README.md section 'Host PostgreSQL Setup'." >&2
fi

echo "==> Building and starting Docker services..."
docker compose "${PROFILE_ARGS[@]}" up -d --build --remove-orphans "${SERVICES[@]}"

echo "==> Waiting for health checks..."
API_PORT="${API_PORT:-8081}"
GAMES_PORT="${GAMES_PORT:-8090}"
WEB_PORT="${WEB_PORT:-3001}"
ADMIN_PORT="${ADMIN_PORT:-4200}"

wait_for() {
  local name="$1"
  local url="$2"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      echo "  [OK] $name -> $url"
      return 0
    fi
    sleep 2
  done
  echo "  [FAIL] $name did not respond at $url" >&2
  return 1
}

wait_for "API (Rust)" "http://127.0.0.1:${API_PORT}/ping" || true
wait_for "Games (Rust)" "http://127.0.0.1:${GAMES_PORT}/healthz" || true
wait_for "Web (Next.js)" "http://127.0.0.1:${WEB_PORT}/" || true
wait_for "Admin (Angular)" "http://127.0.0.1:${ADMIN_PORT}/" || true

echo ""
echo "==> Container status:"
docker compose "${PROFILE_ARGS[@]}" ps
