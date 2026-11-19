#!/usr/bin/env bash
# Install a release on Linux; does not modify Nginx or shared services.
set -euo pipefail
if (( EUID != 0 )) || (( $# != 1 )); then
  echo "Usage: sudo bash deploy/bare-metal/setup.sh /absolute/path/to/release" >&2
  exit 2
fi
src="$(realpath -- "$1")"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
base=/opt/maxxpixels-ott
api_unit=maxxpixels-nestjs.service
web_unit=maxxpixels-next.service
api_env=/etc/maxxpixels-ott/backend.env

for f in .ready backend/dist/main.js web/server.js admin/index.html; do
  [[ -f "$src/$f" ]] || { echo "Incomplete release: $src/$f" >&2; exit 1; }
done
[[ -x /usr/bin/node && -r "$api_env" ]] || {
  echo "Install Node at /usr/bin/node and configure $api_env first." >&2
  exit 1
}
# Values must come from the new NestJS environment, not the existing Rust unit.
for key in DB_HOST DB_DATABASE DB_USERNAME DB_PASSWORD JWT_SECRET; do
  grep -Eq "^${key}=.+" "$api_env" || { echo "Set $key in $api_env" >&2; exit 1; }
done
if grep -Eq '=(replace-me|change-me)$' "$api_env"; then
  echo "Replace the example credentials in $api_env." >&2
  exit 1
fi

for cmd in curl ss systemctl flock; do command -v "$cmd" >/dev/null; done
if [[ -e "$base/current" && ! -L "$base/current" ]]; then
  echo "$base/current already exists and is not a release symlink." >&2
  exit 1
fi
exec 9>/run/lock/maxxpixels-ott-deploy.lock
flock -n 9 || { echo "Another MaxxPixels release is being installed." >&2; exit 1; }
for pair in "8081:$api_unit" "3001:$web_unit"; do
  port="${pair%%:*}"
  unit="${pair#*:}"
  if [[ -n "$(ss -H -ltn "sport = :$port")" ]] && ! systemctl is-active --quiet "$unit"; then
    echo "Port $port is occupied. Leave the existing service running and resolve the conflict before deploying." >&2
    exit 1
  fi
done
for user in maxx-nestjs maxx-next; do
  id "$user" >/dev/null 2>&1 || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "$user"
done

install -d -m 0755 "$base/releases"
release="$(mktemp -d "$base/releases/release.XXXXXXXX")"
chmod 0755 "$release"
# Copy only build artifacts from your trusted checkout. Release directories are kept for rollback.
cp -a --no-preserve=ownership "$src/backend" "$src/web" "$src/admin" "$release/"
chmod -R a+rX "$release/admin" "$release/backend" "$release/web"
install -d -o maxx-next -g maxx-next "$release/web/.next/cache"
chown -R maxx-next:maxx-next "$release/web/.next/cache" "$release/web/.next/server/app"

for unit in "$api_unit" "$web_unit"; do
  install -m 0644 "$script_dir/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
previous="$(readlink "$base/current" || true)"

switch_release() {
  ln -sfn -- "$1" "$base/.current-next"
  mv -Tf -- "$base/.current-next" "$base/current"
}
rollback() {
  status=$?
  trap - EXIT
  if (( status != 0 )); then
    echo "Release failed health checks. Restoring the previous app release if available." >&2
    if [[ -n "$previous" ]]; then
      switch_release "$previous"
      systemctl restart "$api_unit" "$web_unit" || true
    else
      systemctl stop "$api_unit" "$web_unit" || true
      unlink "$base/current"
    fi
  fi
  exit "$status"
}

trap rollback EXIT
switch_release "$release"
systemctl restart "$api_unit"
bash "$script_dir/check-api.sh" http://127.0.0.1:8081
systemctl restart "$web_unit"
curl --silent --show-error --fail --retry 15 --retry-delay 2 --retry-connrefused \
  --max-time 10 http://127.0.0.1:3001/api/v1/ping >/dev/null
curl --silent --show-error --fail --max-time 30 http://127.0.0.1:3001/ >/dev/null
systemctl enable "$api_unit" "$web_unit"
trap - EXIT
printf '\nRelease %s is running. Check the cutover steps before switching the public Nginx routes.\n' "$release"
