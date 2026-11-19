#!/usr/bin/env bash
set -euo pipefail
origin="${1:-http://127.0.0.1:8081}"
origin="${origin%/}"
for ((attempt=1; attempt<=30; attempt++)); do
  if ping="$(curl -fsS --max-time 3 "$origin/api/v1/ping" 2>/dev/null)" &&
     health="$(curl -fsS --max-time 5 "$origin/api/v1/actuator/health" 2>/dev/null)" &&
     /usr/bin/node -e '
       const ping = JSON.parse(process.argv[1]);
       const health = JSON.parse(process.argv[2]);
       if (!(ping.data ?? ping).service?.includes("NestJS") ||
           health.components?.db?.status !== "UP" ||
           health.components?.redis?.status !== "UP") process.exit(1);
     ' "$ping" "$health"; then
    echo "NestJS, PostgreSQL and Redis are responding via $origin."
    exit 0
  fi
  sleep 2
done
echo "NestJS, PostgreSQL or Redis did not become healthy at $origin." >&2
exit 1
