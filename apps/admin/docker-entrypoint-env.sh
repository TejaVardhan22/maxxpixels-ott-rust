#!/bin/sh
set -eu
mkdir -p /usr/share/nginx/html/assets
cat <<EOF > /usr/share/nginx/html/assets/env.js
window.__ENV__ = {
  API_HOST: "${ADMIN_API_HOST:-}",
  API_BASE_URL: "${ADMIN_API_BASE_URL:-/api/v1}",
  APP_NAME: "${ADMIN_APP_NAME:-MaxxPixels OTT Admin}"
};
EOF
