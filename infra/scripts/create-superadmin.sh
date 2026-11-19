#!/usr/bin/env bash
# Set PGHOST, PGPORT, PGUSER and PGDATABASE (use .pgpass for the DB password).
set -euo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
read -rp 'Super admin email: ' email
read -rp 'Full name [Super Admin]: ' full_name
read -rp 'Phone number (optional): ' phone
read -rsp 'Super admin password: ' password
printf '\n'
printf '%s' "$password" | node "$here/create-superadmin.js" "$email" "${full_name:-Super Admin}" "$phone"
