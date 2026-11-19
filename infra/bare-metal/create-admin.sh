#!/usr/bin/env bash
set -euo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export MAXX_BACKEND_DIR="${MAXX_BACKEND_DIR:-/opt/maxxpixels-ott/current/backend}"
exec bash "$here/../create-superadmin.sh" "$@"
