#!/usr/bin/env bash
set -Eeuo pipefail

readonly ENV_FILE="/etc/aigory-blog/.env.production"
readonly APP_DIR="/opt/aigory-blog/app"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Missing production environment: $ENV_FILE" >&2
  exit 2
fi

read_env_value() {
  local name="$1"
  local value
  value="$(sed -n "s/^${name}=//p" "$ENV_FILE" | tail -n 1)"
  if [[ "$value" =~ ^\'(.*)\'$ || "$value" =~ ^\"(.*)\"$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  if [[ ! "$value" =~ ^[A-Za-z0-9_./-]+$ ]]; then
    echo "Unsafe or missing backup setting: $name" >&2
    exit 3
  fi
  printf '%s' "$value"
}

BACKUP_DATA_DIR="$(read_env_value BACKUP_DATA_DIR)"
BACKUP_LOCAL_RETENTION_DAYS="$(read_env_value BACKUP_LOCAL_RETENTION_DAYS)"
DB_USER="$(read_env_value DB_USER)"
DB_NAME="$(read_env_value DB_NAME)"
BACKUP_S3_BUCKET="$(read_env_value BACKUP_S3_BUCKET)"

readonly BACKUP_DIR="${BACKUP_DATA_DIR:-/mnt/data/aigory-blog/backups}"
readonly RETENTION_DAYS="${BACKUP_LOCAL_RETENTION_DAYS:-7}"

case "$BACKUP_DIR" in
  /mnt/data/aigory-blog/backups) ;;
  *) echo "Unexpected backup directory: $BACKUP_DIR" >&2; exit 3 ;;
esac

for name in DB_USER DB_NAME BACKUP_S3_BUCKET; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required backup setting: $name" >&2
    exit 4
  fi
done

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_LOCAL_RETENTION_DAYS must be a positive integer" >&2
  exit 5
fi

cd "$APP_DIR"
umask 077
install -d -m 700 "$BACKUP_DIR"

readonly TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly YEAR="${TIMESTAMP:0:4}"
readonly MONTH="${TIMESTAMP:4:2}"
readonly FILE_NAME="aigory-postgres-${TIMESTAMP}.dump"
readonly PARTIAL_PATH="$BACKUP_DIR/.${FILE_NAME}.partial"
readonly FINAL_PATH="$BACKUP_DIR/$FILE_NAME"
readonly CHECKSUM_PATH="$FINAL_PATH.sha256"
readonly OBJECT_PREFIX="postgres/$YEAR/$MONTH"

compose=(
  docker compose
  --project-name aigory-blog-prod
  --env-file "$ENV_FILE"
  -f docker-compose.prod.oracle.yml
  -f docker-compose.prod.oracle-small.yml
)

cleanup_partial() {
  rm -f -- "$PARTIAL_PATH"
}
trap cleanup_partial EXIT

"${compose[@]}" exec -T postgres \
  pg_dump --username "$DB_USER" --dbname "$DB_NAME" \
  --format=custom --compress=6 --no-owner --no-privileges >"$PARTIAL_PATH"

test -s "$PARTIAL_PATH"
"${compose[@]}" exec -T postgres pg_restore --list <"$PARTIAL_PATH" >/dev/null
mv "$PARTIAL_PATH" "$FINAL_PATH"
sha256sum "$FINAL_PATH" >"$CHECKSUM_PATH"

for local_file in "$FINAL_PATH" "$CHECKSUM_PATH"; do
  object_key="$OBJECT_PREFIX/$(basename "$local_file")"
  "${compose[@]}" run --rm --no-deps --user root \
    --volume "$BACKUP_DIR:/backup:ro" \
    backend node dist/src/commands/upload-backup.command.js \
    "/backup/$(basename "$local_file")" "$object_key"
done

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'aigory-postgres-*.dump' -o -name 'aigory-postgres-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "PostgreSQL backup completed: $FILE_NAME"
