#!/usr/bin/env bash
# Build a release as a regular user. Pass the printed path to setup.sh.
set -euo pipefail
if (( EUID == 0 )); then
  echo "Build as a regular user; use sudo only for setup.sh." >&2
  exit 1
fi
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$root/.releases"
release="$(mktemp -d "$root/.releases/release.XXXXXXXX")"
cd "$root"

(
  cd backend
  npm ci --include=dev --legacy-peer-deps --no-audit --no-fund
  npm run build
  npm test -- --runInBand
  test -f dist/main.js
  mkdir -p "$release/backend"
  cp -a dist package.json package-lock.json "$release/backend/"
  cd "$release/backend"
  npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund
)
(
  cd admin
  npm ci --include=dev --legacy-peer-deps --no-audit --no-fund
  npm run build -- --configuration production
  test -f dist/ott-admin/browser/index.html
  cp -a dist/ott-admin/browser "$release/admin"
)
(
  cd web/web
  npm ci --include=dev --legacy-peer-deps --no-audit --no-fund
  API_BACKEND_URL=http://127.0.0.1:8081 NEXT_PUBLIC_API_BASE_URL=/api/v1 \
    NEXT_TELEMETRY_DISABLED=1 npm run build
  test -f .next/standalone/server.js
  cp -a .next/standalone "$release/web"
  mkdir -p "$release/web/.next"
  cp -a .next/static "$release/web/.next/"
  cp -a public "$release/web/"
  # Standalone may copy the build environment; the service has a separate config.
  find "$release/web" -maxdepth 1 -type f -name '.env*' -delete
)
touch "$release/.ready"
printf '\nRelease built: %s\n' "$release"
printf 'Install on the VPS: sudo bash %q %q\n' "$root/deploy/bare-metal/setup.sh" "$release"
