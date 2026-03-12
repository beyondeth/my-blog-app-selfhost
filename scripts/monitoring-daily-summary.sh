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

humanize_http_status() {
  case "$1" in
    200) echo "정상 (200)" ;;
    000) echo "응답 없음" ;;
    *) echo "이상 ($1)" ;;
  esac
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

root_disk="$(df -h / | awk 'NR==2 {print $5}')"
data_disk="$(df -h /mnt/data 2>/dev/null | awk 'NR==2 {print $5}')"
if [ -z "$data_disk" ]; then
  data_disk="n/a"
fi

unhealthy_containers="$(
  docker ps -a --filter "name=${project}-" --format '{{.Names}}|{{.Status}}' |
    awk 'BEGIN{out=""} {
      line=tolower($0);
      if (line ~ /unhealthy|exited|dead/) {
        if (out != "") out=out "; ";
        out=out $1;
      }
    } END {
      if (out == "") print "none";
      else print out;
    }'
)"
if [ "$unhealthy_containers" = "none" ]; then
  unhealthy_count="0"
else
  unhealthy_count="$(printf '%s' "$unhealthy_containers" | awk -F'; ' '{print NF}')"
fi

image_reclaimable="$(docker system df | awk '$1 == "Images" {print $(NF-1) " " $NF}')"
build_cache_reclaimable="$(docker system df | grep '^Build Cache' | awk '{print $NF}' || true)"
if [ -z "$image_reclaimable" ]; then
  image_reclaimable="n/a"
fi
if [ -z "$build_cache_reclaimable" ]; then
  build_cache_reclaimable="n/a"
fi

backend_error_count="$(docker logs --since 24h "$backend" 2>&1 | grep -Eci 'error|exception|failed' || true)"
mcp_error_count="$(docker logs --since 24h "$mcp" 2>&1 | grep -Eci 'error|exception|failed' || true)"

alerts_json="$(curl -fsS http://127.0.0.1:8428/api/v1/alerts 2>/dev/null || true)"
alerts_json_b64="$(printf '%s' "$alerts_json" | base64 | tr -d '\n')"

echo "ROOT_DISK=$root_disk"
echo "DATA_DISK=$data_disk"
echo "UNHEALTHY_COUNT=$unhealthy_count"
echo "UNHEALTHY_CONTAINERS=$unhealthy_containers"
echo "IMAGE_RECLAIMABLE=$image_reclaimable"
echo "BUILD_CACHE_RECLAIMABLE=$build_cache_reclaimable"
echo "BACKEND_ERRORS_24H=$backend_error_count"
echo "MCP_ERRORS_24H=$mcp_error_count"
echo "ALERTS_JSON_B64=$alerts_json_b64"
EOF
)"

ROOT_DISK="n/a"
DATA_DISK="n/a"
UNHEALTHY_COUNT="0"
UNHEALTHY_CONTAINERS="none"
IMAGE_RECLAIMABLE="n/a"
BUILD_CACHE_RECLAIMABLE="n/a"
BACKEND_ERRORS_24H="0"
MCP_ERRORS_24H="0"
FIRING_ALERTS="0"
FIRING_ALERTS_JSON="[]"
ALERTS_JSON_B64=""

while IFS='=' read -r key value; do
  case "$key" in
    ROOT_DISK) ROOT_DISK="$value" ;;
    DATA_DISK) DATA_DISK="$value" ;;
    UNHEALTHY_COUNT) UNHEALTHY_COUNT="$value" ;;
    UNHEALTHY_CONTAINERS) UNHEALTHY_CONTAINERS="$value" ;;
    IMAGE_RECLAIMABLE) IMAGE_RECLAIMABLE="$value" ;;
    BUILD_CACHE_RECLAIMABLE) BUILD_CACHE_RECLAIMABLE="$value" ;;
    BACKEND_ERRORS_24H) BACKEND_ERRORS_24H="$value" ;;
    MCP_ERRORS_24H) MCP_ERRORS_24H="$value" ;;
    ALERTS_JSON_B64) ALERTS_JSON_B64="$value" ;;
  esac
done <<< "$remote_snapshot"

parsed_alerts="$(
  ALERTS_JSON_B64="$ALERTS_JSON_B64" python3 - <<'PY'
import base64
import json
import os

raw_b64 = os.environ.get("ALERTS_JSON_B64", "").strip()
alerts = []
if raw_b64:
    raw = base64.b64decode(raw_b64).decode("utf-8")
    if raw.strip():
        payload = json.loads(raw)
        for group in payload.get("data", {}).get("groups", []):
            for alert in group.get("alerts", []):
                if str(alert.get("state", "")).lower() != "firing":
                    continue
                annotations = alert.get("annotations", {}) or {}
                summary = annotations.get("summary") or alert.get("name") or "이름 없는 경보"
                impact = annotations.get("impact") or "영향 정보 없음"
                action = annotations.get("action") or "조치 정보 없음"
                alerts.append(
                    {
                        "summary": summary.replace("\n", " "),
                        "impact": impact.replace("\n", " "),
                        "action": action.replace("\n", " "),
                    }
                )

print(f"COUNT={len(alerts)}")
print("JSON=" + json.dumps(alerts, ensure_ascii=False))
PY
)"

while IFS='=' read -r key value; do
  case "$key" in
    COUNT) FIRING_ALERTS="$value" ;;
    JSON) FIRING_ALERTS_JSON="$value" ;;
  esac
done <<< "$parsed_alerts"

overall="정상"
if [ "$public_site_code" != "200" ] || [ "$mcp_health_code" != "200" ] || [ "${UNHEALTHY_COUNT:-0}" -gt 0 ] || [ "${FIRING_ALERTS:-0}" -gt 0 ]; then
  overall="위험"
elif [ "${ROOT_DISK:-n/a}" != "n/a" ] && [ "${ROOT_DISK%%%}" -ge 85 ] 2>/dev/null; then
  overall="주의"
elif [ "${DATA_DISK:-n/a}" != "n/a" ] && [ "${DATA_DISK%%%}" -ge 85 ] 2>/dev/null; then
  overall="주의"
fi

timestamp_kst="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

echo "[Codebase Daily Ops] ${timestamp_kst}"
echo "판정: ${overall}"
echo
echo "현재 상태"
echo "- 공개 사이트: $(humanize_http_status "$public_site_code")"
echo "- MCP 헬스: $(humanize_http_status "$mcp_health_code")"
echo "- 비정상 컨테이너: ${UNHEALTHY_COUNT:-0}"
echo "- 신뢰 경보: ${FIRING_ALERTS:-0}"
echo

echo "운영 체크"
echo "- 루트 디스크: ${ROOT_DISK:-n/a}"
echo "- 데이터 디스크: ${DATA_DISK:-n/a}"
echo "- 최근 24시간 오류: backend ${BACKEND_ERRORS_24H:-0}건, mcp-proxy ${MCP_ERRORS_24H:-0}건"
echo "- 정리 가능 용량: 이미지 ${IMAGE_RECLAIMABLE:-n/a}, 빌드 캐시 ${BUILD_CACHE_RECLAIMABLE:-n/a}"
echo

echo "즉시 확인 항목"
issues_printed=0

if [ "$public_site_code" != "200" ]; then
  echo "- 공개 사이트 응답 이상"
  echo "  영향: 사용자 웹 접속이 실패하거나 불안정할 수 있습니다."
  echo "  조치: frontend 컨테이너와 https 응답을 확인하세요."
  issues_printed=1
fi

if [ "$mcp_health_code" != "200" ]; then
  echo "- MCP 헬스 응답 이상"
  echo "  영향: 자동포스팅과 ChatGPT 연동이 실패할 수 있습니다."
  echo "  조치: mcp-proxy 컨테이너와 /health 응답을 확인하세요."
  issues_printed=1
fi

if [ "${UNHEALTHY_COUNT:-0}" -gt 0 ]; then
  echo "- 비정상 컨테이너 감지: ${UNHEALTHY_CONTAINERS}"
  echo "  영향: 일부 서비스 기능이 중단되었을 수 있습니다."
  echo "  조치: 해당 컨테이너의 health/status와 최근 로그를 확인하세요."
  issues_printed=1
fi

if [ "${FIRING_ALERTS_JSON:-[]}" != "[]" ]; then
  while IFS=$'\t' read -r summary impact action; do
    [ -z "$summary" ] && continue
    echo "- ${summary}"
    echo "  영향: ${impact}"
    echo "  조치: ${action}"
    issues_printed=1
  done < <(
    FIRING_ALERTS_JSON="$FIRING_ALERTS_JSON" python3 - <<'PY'
import json
import os

for alert in json.loads(os.environ.get("FIRING_ALERTS_JSON", "[]")):
    print(
        "\t".join(
            [
                alert.get("summary", ""),
                alert.get("impact", ""),
                alert.get("action", ""),
            ]
        )
    )
PY
  )
fi

if [ "$issues_printed" -eq 0 ]; then
  echo "- 즉시 대응이 필요한 항목이 없습니다."
fi
