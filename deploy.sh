#!/usr/bin/env bash
# ==============================================================================
# MaxxPixels OTT — GitHub Pull + One-Command Docker VPS Deploy Script
#
# Usage:
#   ./deploy.sh                    # Pull main, tear down this stack, rebuild & start all core services
#   ./deploy.sh --with-tools       # Same, but include the optional media-streamer service
#   ./deploy.sh --all-containers   # Also stop/remove EVERY Docker container on the host
#   ./deploy.sh api                # Pull, then rebuild & restart only the Rust API
#
# By default teardown is scoped to this Compose project only. Use
# --all-containers only when you intentionally want to clear the whole host.
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

for cmd in docker git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $cmd is not installed." >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 plugin is required." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: $ROOT_DIR is not a Git repository." >&2
  exit 1
fi

GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

PROFILE_ARGS=()
SERVICES=()
ALL_CONTAINERS=false
for arg in "$@"; do
  case "$arg" in
    --with-tools)
      PROFILE_ARGS+=(--profile tools)
      ;;
    --all-containers)
      ALL_CONTAINERS=true
      ;;
    *)
      SERVICES+=("$arg")
      ;;
  esac
done

echo "==> Pulling latest code from GitHub (${GIT_REMOTE}/${GIT_BRANCH})..."
git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"

# Regenerate the combined .env when the split env sources are present.
# A plain VPS that still manages .env by hand keeps working unchanged.
if [[ -f .env.ott && -f .env.games && -f scripts/combine_env.py ]] && command -v python3 >/dev/null 2>&1; then
  echo "==> Regenerating .env from .env.ott + .env.games..."
  python3 scripts/combine_env.py
fi

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Create .env.ott / .env.games then run: make env-combine" >&2
  exit 1
fi

# Load .env safely without executing values that contain spaces (e.g. "MaxxPixels OTT Admin")
while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip CR and leading/trailing whitespace
  line="${line%$'\r'}"
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[2]}"
    val="${BASH_REMATCH[3]}"
    # Strip matching surrounding single or double quotes
    if [[ "$val" =~ ^\"(.*)\"$ ]]; then
      val="${BASH_REMATCH[1]}"
    elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    export "$key=$val"
  fi
done < .env

if [[ -z "${DATABASE_URL:-}" || "${DATABASE_URL}" == *"CHANGE_ME"* ]]; then
  echo "ERROR: Set a valid DATABASE_URL in .env pointing to host.docker.internal:5432" >&2
  exit 1
fi

if [[ -z "${GAMES_DATABASE_URL:-}" || "${GAMES_DATABASE_URL}" == *"CHANGE_ME"* ]]; then
  echo "WARNING: GAMES_DATABASE_URL is missing or placeholder in .env (games service requires it)." >&2
fi

echo "==> Checking host PostgreSQL reachability from Docker (host.docker.internal:5432)..."
if ! docker run --rm --add-host=host.docker.internal:host-gateway alpine:3.20 \
  sh -c "nc -z -w 3 host.docker.internal 5432" >/dev/null 2>&1; then
  echo "WARNING: Containers cannot reach host.docker.internal:5432 yet." >&2
  echo "         Check postgresql.conf (listen_addresses) and pg_hba.conf (Docker subnet 172.16.0.0/12)." >&2
  echo "         See README.md section 'Host PostgreSQL Setup'." >&2
fi

if (( ${#SERVICES[@]} == 0 )); then
  echo "==> Stopping and removing existing containers for this stack..."
  docker compose "${PROFILE_ARGS[@]}" down --remove-orphans

  if [[ "$ALL_CONTAINERS" == true ]]; then
    echo "==> --all-containers: stopping and removing ALL Docker containers on this host..."
    containers="$(docker ps -aq)"
    if [[ -n "$containers" ]]; then
      # shellcheck disable=SC2086
      docker stop $containers >/dev/null || true
      # shellcheck disable=SC2086
      docker rm -f $containers >/dev/null || true
    fi
  fi
else
  echo "==> Targeted service deploy (${SERVICES[*]}); keeping the rest of the stack running."
fi

echo "==> Building shared Go microservices image..."
docker compose "${PROFILE_ARGS[@]}" build identity-service

echo "==> Building and starting fresh containers..."
docker compose "${PROFILE_ARGS[@]}" up -d --build --remove-orphans "${SERVICES[@]}"

# If PostgreSQL runs in a separate Docker container (e.g. maxxpixels-postgres), attach it to maxxpixels_maxx-net
PG_CONTAINER="${DB_HOST:-maxxpixels-postgres}"
if [[ -n "$PG_CONTAINER" && "$PG_CONTAINER" != "host.docker.internal" && "$PG_CONTAINER" != "localhost" && "$PG_CONTAINER" != "127.0.0.1" ]]; then
  if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    echo "==> Connecting external Postgres container '$PG_CONTAINER' to maxxpixels_maxx-net..."
    docker network connect maxxpixels_maxx-net "$PG_CONTAINER" 2>/dev/null || true
  fi
fi

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

wait_for "API Gateway (Go)" "http://127.0.0.1:${API_PORT}/ping" || true
wait_for "GraphQL (Go Catalog)" "http://127.0.0.1:${API_PORT}/api/v1/graphql" || true
wait_for "Games (Go)" "http://127.0.0.1:${GAMES_PORT}/healthz" || true
wait_for "Web (Next.js)" "http://127.0.0.1:${WEB_PORT}/" || true
wait_for "Admin (Refine)" "http://127.0.0.1:${ADMIN_PORT}/" || true

echo ""
echo "==> Container status:"
docker compose "${PROFILE_ARGS[@]}" ps
