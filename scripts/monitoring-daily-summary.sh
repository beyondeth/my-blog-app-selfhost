#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "missing required env: ${name}" >&2
    exit 1
  fi
}

require_env "MONITOR_SSH_HOST"
require_env "MONITOR_SSH_USER"
require_env "MONITOR_SSH_KEY_PATH"

PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://www.codebase.blog}"
MCP_HEALTH_URL="${MCP_HEALTH_URL:-https://mcp.codebase.blog/health}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-codebase-prod}"

http_code() {
  local url="$1"
  curl -L -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000"
}

public_site_code="$(http_code "$PUBLIC_SITE_URL")"
mcp_health_code="$(http_code "$MCP_HEALTH_URL")"

remote_snapshot="$(
  ssh \
    -i "$MONITOR_SSH_KEY_PATH" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    "${MONITOR_SSH_USER}@${MONITOR_SSH_HOST}" \
    "COMPOSE_PROJECT_NAME='${COMPOSE_PROJECT_NAME}' bash -s" <<'EOF'
set -euo pipefail

project="${COMPOSE_PROJECT_NAME:-codebase-prod}"
backend="${project}-backend"
mcp="${project}-mcp-proxy"
victoria="${project}-victoriametrics"

root_disk="$(df -h / | awk 'NR==2 {print $5}')"
data_disk="$(df -h /mnt/data 2>/dev/null | awk 'NR==2 {print $5}')"
if [ -z "$data_disk" ]; then
  data_disk="n/a"
fi

unhealthy_count="$(
  docker ps --format '{{.Names}}\t{{.Status}}' |
    awk 'BEGIN{count=0} {line=tolower($0); if (line ~ /unhealthy|exited|dead/) count++} END {print count+0}'
)"

container_lines="$(docker ps --format '{{.Names}}|{{.Status}}' | paste -sd ';' -)"
if [ -z "$container_lines" ]; then
  container_lines="none"
fi

image_reclaimable="$(docker system df | awk '$1 == "Images" {print $(NF-1) " " $NF}')"
build_cache_reclaimable="$(docker system df | grep '^Build Cache' | awk '{print $(NF-1) " " $NF}' || true)"
if [ -z "$image_reclaimable" ]; then
  image_reclaimable="n/a"
fi
if [ -z "$build_cache_reclaimable" ]; then
  build_cache_reclaimable="n/a"
fi

backend_error_count="$(docker logs --since 24h "$backend" 2>&1 | grep -Eci 'error|exception|failed' || true)"
mcp_error_count="$(docker logs --since 24h "$mcp" 2>&1 | grep -Eci 'error|exception|failed' || true)"

firing_alerts="$(
  curl -fsS http://127.0.0.1:8428/api/v1/alerts 2>/dev/null |
    python3 - <<'PY'
import json
import sys

raw = sys.stdin.read().strip()
if not raw:
    print(0)
    raise SystemExit

payload = json.loads(raw)
count = 0
for group in payload.get("data", {}).get("groups", []):
    for alert in group.get("alerts", []):
        if str(alert.get("state", "")).lower() == "firing":
            count += 1
print(count)
PY
)" || true
if [ -z "$firing_alerts" ]; then
  firing_alerts="0"
fi

echo "ROOT_DISK=$root_disk"
echo "DATA_DISK=$data_disk"
echo "UNHEALTHY_COUNT=$unhealthy_count"
echo "CONTAINERS=$container_lines"
echo "IMAGE_RECLAIMABLE=$image_reclaimable"
echo "BUILD_CACHE_RECLAIMABLE=$build_cache_reclaimable"
echo "BACKEND_ERRORS_24H=$backend_error_count"
echo "MCP_ERRORS_24H=$mcp_error_count"
echo "FIRING_ALERTS=$firing_alerts"
EOF
)"

ROOT_DISK=""
DATA_DISK=""
UNHEALTHY_COUNT="0"
CONTAINERS="none"
IMAGE_RECLAIMABLE="n/a"
BUILD_CACHE_RECLAIMABLE="n/a"
BACKEND_ERRORS_24H="0"
MCP_ERRORS_24H="0"
FIRING_ALERTS="0"

while IFS='=' read -r key value; do
  case "$key" in
    ROOT_DISK) ROOT_DISK="$value" ;;
    DATA_DISK) DATA_DISK="$value" ;;
    UNHEALTHY_COUNT) UNHEALTHY_COUNT="$value" ;;
    CONTAINERS) CONTAINERS="$value" ;;
    IMAGE_RECLAIMABLE) IMAGE_RECLAIMABLE="$value" ;;
    BUILD_CACHE_RECLAIMABLE) BUILD_CACHE_RECLAIMABLE="$value" ;;
    BACKEND_ERRORS_24H) BACKEND_ERRORS_24H="$value" ;;
    MCP_ERRORS_24H) MCP_ERRORS_24H="$value" ;;
    FIRING_ALERTS) FIRING_ALERTS="$value" ;;
  esac
done <<< "$remote_snapshot"

overall="정상"
if [ "$public_site_code" != "200" ] || [ "$mcp_health_code" != "200" ] || [ "${UNHEALTHY_COUNT:-0}" -gt 0 ] || [ "${FIRING_ALERTS:-0}" -gt 0 ]; then
  overall="위험"
elif [ "${ROOT_DISK:-0%}" != "n/a" ] && [ "${ROOT_DISK%%%}" -ge 85 ] 2>/dev/null; then
  overall="주의"
elif [ "${DATA_DISK:-n/a}" != "n/a" ] && [ "${DATA_DISK%%%}" -ge 85 ] 2>/dev/null; then
  overall="주의"
elif [ "${BACKEND_ERRORS_24H:-0}" -gt 0 ] || [ "${MCP_ERRORS_24H:-0}" -gt 0 ]; then
  overall="주의"
fi

timestamp_kst="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

cat <<EOF
[Codebase Daily Ops] ${timestamp_kst}
overall: ${overall}

Public Health
- ${PUBLIC_SITE_URL}: ${public_site_code}
- ${MCP_HEALTH_URL}: ${mcp_health_code}

Server
- root disk: ${ROOT_DISK:-n/a}
- data disk: ${DATA_DISK:-n/a}
- unhealthy containers: ${UNHEALTHY_COUNT:-0}
- firing alerts: ${FIRING_ALERTS:-0}

Containers
- ${CONTAINERS:-none}

Docker Reclaimable
- images: ${IMAGE_RECLAIMABLE:-n/a}
- build cache: ${BUILD_CACHE_RECLAIMABLE:-n/a}

Logs (24h)
- backend errors: ${BACKEND_ERRORS_24H:-0}
- mcp-proxy errors: ${MCP_ERRORS_24H:-0}
EOF
