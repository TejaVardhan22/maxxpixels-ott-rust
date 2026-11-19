#!/usr/bin/env bash
# ==============================================================================
# MaxxPixels OTT - Automated Daily AWS RDS PostgreSQL Backup to Bunny.net Storage
# Schedule with crontab (1:00 AM Daily, server time):
#   0 1 * * * /bin/bash /absolute/path/to/deploy/aws_to_bunny_daily_backup.sh >> /var/log/aws_bunny_backup.log 2>&1
# (1 AM IST on a UTC server: 30 19 * * *)
# ==============================================================================

set -euo pipefail

# --- Configuration from the environment ---
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-${DB_USER:-postgres}}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-${DB_NAME:?Set DB_DATABASE or DB_NAME}}"

BUNNY_STORAGE_ZONE_NAME="${BUNNY_STORAGE_ZONE_NAME:-maxxpixels-images}"
BUNNY_STORAGE_ZONE_PASSWORD="${BUNNY_STORAGE_ZONE_PASSWORD:?Set the Bunny storage password}"
BUNNY_STORAGE_REGION="${BUNNY_STORAGE_REGION:-de}"
BUNNY_PULL_ZONE_DOMAIN="${BUNNY_PULL_ZONE_DOMAIN:-https://maxxpixels-images.b-cdn.net}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Storage Endpoint mapping based on region
case "${BUNNY_STORAGE_REGION}" in
  "ny"|"us") BUNNY_STORAGE_HOST="ny.storage.bunny.net" ;;
  "la") BUNNY_STORAGE_HOST="la.storage.bunny.net" ;;
  "sg") BUNNY_STORAGE_HOST="sg.storage.bunny.net" ;;
  "syd") BUNNY_STORAGE_HOST="syd.storage.bunny.net" ;;
  "jh") BUNNY_STORAGE_HOST="jh.storage.bunny.net" ;;
  "br") BUNNY_STORAGE_HOST="br.storage.bunny.net" ;;
  *) BUNNY_STORAGE_HOST="storage.bunny.net" ;;
esac

TIMESTAMP=$(date -u +'%Y-%m-%d_%H%M%S')
BACKUP_FILENAME="maxxpixels_db_backup_${TIMESTAMP}.sql.gz"
REMOTE_PATH="db-backups/${BACKUP_FILENAME}"
TEMP_DIR="/tmp/db_backups"

mkdir -p "${TEMP_DIR}"
LOCAL_DUMP_FILE="${TEMP_DIR}/${BACKUP_FILENAME}"

echo "=============================================================================="
echo "🚀 [$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Starting Daily AWS RDS DB Backup..."
echo "📍 DB Host: ${DB_HOST}:${DB_PORT} / Database: ${DB_NAME}"
echo "📦 Target Bunny Storage: https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE_NAME}/${REMOTE_PATH}"
echo "=============================================================================="

# 1. Perform PostgreSQL dump compressed with gzip
echo "[1/4] Running pg_dump and compressing..."
if [[ -n "$DB_PASSWORD" ]]; then export PGPASSWORD="$DB_PASSWORD"; fi

command -v pg_dump >/dev/null || { echo "Install PostgreSQL client tools." >&2; exit 1; }
  pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    | gzip -9 > "${LOCAL_DUMP_FILE}"

FILE_SIZE=$(du -h "${LOCAL_DUMP_FILE}" | cut -f1)
FILE_BYTES=$(wc -c < "${LOCAL_DUMP_FILE}")

if [ "${FILE_BYTES}" -le 50 ]; then
  echo "❌ Error: Backup file size is too small (${FILE_BYTES} bytes). Backup failed!"
  rm -f "${LOCAL_DUMP_FILE}"
  exit 1
fi

# Compute SHA-256 Hash
if command -v sha256sum &> /dev/null; then
  CHECKSUM=$(sha256sum "${LOCAL_DUMP_FILE}" | awk '{print $1}')
else
  CHECKSUM=$(shasum -a 256 "${LOCAL_DUMP_FILE}" | awk '{print $1}')
fi

echo "✅ Backup created successfully! Size: ${FILE_SIZE} (${FILE_BYTES} bytes)"
echo "🔑 SHA-256 Checksum: ${CHECKSUM}"

# 2. Upload file to Bunny.net Storage REST API
echo "[2/4] Uploading to Bunny.net Edge Storage..."
UPLOAD_URL="https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE_NAME}/${REMOTE_PATH}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${UPLOAD_URL}" \
  -H "AccessKey: ${BUNNY_STORAGE_ZONE_PASSWORD}" \
  -H "Content-Type: application/gzip" \
  --data-binary "@${LOCAL_DUMP_FILE}")

if [ "${HTTP_CODE}" -eq 201 ] || [ "${HTTP_CODE}" -eq 200 ]; then
  PULL_URL="${BUNNY_PULL_ZONE_DOMAIN}/${REMOTE_PATH}"
  echo "✅ Upload SUCCESSful! HTTP Status: ${HTTP_CODE}"
  echo "🔗 Public CDN URL: ${PULL_URL}"
else
  echo "❌ Upload FAILED with HTTP Status Code: ${HTTP_CODE}"
  rm -f "${LOCAL_DUMP_FILE}"
  exit 1
fi

# 3. Clean local temporary dump file
echo "[3/4] Cleaning local temporary dump file..."
rm -f "${LOCAL_DUMP_FILE}"

# 4. Retention Policy: List & purge backups older than RETENTION_DAYS
echo "[4/4] Checking backup retention policy (${RETENTION_DAYS} days cutoff)..."
LIST_URL="https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE_NAME}/db-backups/"

FILES_JSON=$(curl -s -H "AccessKey: ${BUNNY_STORAGE_ZONE_PASSWORD}" "${LIST_URL}" || echo "[]")

if command -v python3 &> /dev/null; then
  python3 - <<EOF
import json, sys, datetime, urllib.request

retention_days = int("${RETENTION_DAYS}")
storage_host = "${BUNNY_STORAGE_HOST}"
storage_zone = "${BUNNY_STORAGE_ZONE_NAME}"
access_key = "${BUNNY_STORAGE_ZONE_PASSWORD}"

cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention_days)

try:
    raw_data = '''${FILES_JSON}'''
    files = json.loads(raw_data)
    deleted_count = 0
    for f in files:
        if f.get('IsDirectory'): continue
        name = f.get('ObjectName', '')
        if not name.endswith('.sql.gz'): continue
        
        last_changed = f.get('LastChanged') or f.get('DateCreated')
        if last_changed:
            dt = datetime.datetime.strptime(last_changed.split('.')[0], '%Y-%m-%dT%H:%M:%S')
            if dt < cutoff:
                del_url = f"https://{storage_host}/{storage_zone}/db-backups/{name}"
                req = urllib.request.Request(del_url, method='DELETE', headers={'AccessKey': access_key})
                try:
                    urllib.request.urlopen(req)
                    print(f"🗑️ Deleted expired backup (> {retention_days} days): {name}")
                    deleted_count += 1
                except Exception as ex:
                    print(f"⚠️ Failed to delete expired backup {name}: {ex}")
    if deleted_count == 0:
        print("✅ No expired backups found to clean up.")
except Exception as e:
    print(f"Notice: Retention check skipped: {e}")
EOF
fi

echo "=============================================================================="
echo "🎉 Daily Database Backup completed successfully at $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "=============================================================================="
