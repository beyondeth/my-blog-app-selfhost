#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${MOBILE_BACKEND_URL:-http://localhost:3000}"
FEED_LIMIT="${MOBILE_IOS_FEED_LIMIT:-60}"
MAX_POSTS="${MOBILE_IOS_COMMUNITY_FALLBACK_MAX_POSTS:-12}"
MAX_COMMENT_LIMIT="${MOBILE_IOS_COMMUNITY_FALLBACK_COMMENT_LIMIT:-5}"
REPORT_PATH="${MOBILE_IOS_COMMUNITY_FALLBACK_REPORT:-/tmp/my-blog-ios-community-fallback-report.txt}"
JQ="${MOBILE_IOS_COMMUNITY_FALLBACK_JQ_BIN:-jq}"
TEMP_DIR="${TMPDIR:-/tmp}/my-blog-ios-community-fallback"
ACCESS_TOKEN="${MOBILE_IOS_TEST_ACCESS_TOKEN:-}"
EMAIL="${MOBILE_IOS_TEST_EMAIL:-${MOBILE_IOS_TEST_USERNAME:-}}"
PASSWORD="${MOBILE_IOS_TEST_PASSWORD:-${MOBILE_IOS_TEST_PWD:-}}"

FEED_BODY="${TEMP_DIR}/feed.json"
LAST_HTTP_BODY=""
source_type_stats="[]"

COMMUNITY_ITEM_SELECTOR='
  .items // []
  | .[]
  | select(
      ((.sourceType // "" | ascii_downcase) as $sourceType
        | (.community.slug // "") != ""
        | and(
            $sourceType == "community" or
            $sourceType == "thread" or
            ($sourceType == "" and (.community.slug // "") != "")
          )
      )
      and (((.slug // "") != "" ) or ((.id // "") != ""))
    )
  | {
      slug: (.slug // ""),
      id: (.id // ""),
      communitySlug: (.community.slug // ""),
      communityName: (.community.name // ""),
      title: (.title // ""),
      sourceType: (.sourceType // "")
    }'

COMMUNITY_DETAIL_PREDICATE='
  ((.data.id // .id // .slug // .data.slug) != null)
  or (.success == true)'

COMMUNITY_COMMENT_PREDICATE='
  if type == "array" then
    true
  else
    ((.data.comments // .data.items // .comments // .items) as $arr | ($arr != null and ($arr | type == "array")))
  end'

trap 'rm -f \
  "${FEED_BODY}" \
  "${TEMP_DIR}/login-request.json" \
  "${TEMP_DIR}/login-response.json" \
  "${TEMP_DIR}/response-"* 2>/dev/null || true' EXIT

mkdir -p "$TEMP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

shorten_token() {
  local token="$1"
  if [[ -z "$token" ]]; then
    echo "-"
  else
    echo "${token:0:12}..."
  fi
}

normalize_access_token() {
  local raw="$1"
  echo "${raw}" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g'
}

encode_path() {
  local value="$1"
  python3 - <<'PY' "$value"
import sys
from urllib.parse import quote
print(quote(sys.argv[1]))
PY
}

if ! command -v "$JQ" >/dev/null 2>&1; then
  echo "jq가 필요합니다. brew install jq 로 설치해 주세요."
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3가 필요합니다. python3를 설치해 주세요."
  exit 1
fi

resolve_access_token() {
  if [[ -n "${ACCESS_TOKEN}" ]]; then
    return 0
  fi

  if [[ -z "${EMAIL}" || -z "${PASSWORD}" ]]; then
    log "액세스 토큰이 없습니다. MOBILE_IOS_TEST_ACCESS_TOKEN 또는 MOBILE_IOS_TEST_EMAIL/MOBILE_IOS_TEST_PASSWORD를 설정해 주세요."
    exit 1
  fi

  local login_body="${TEMP_DIR}/login-request.json"
  local login_response="${TEMP_DIR}/login-response.json"
  cat > "$login_body" <<EOF
{
  "email": "${EMAIL}",
  "password": "${PASSWORD}"
}
EOF

  local status
  status="$(curl --silent --show-error \
    --output "$login_response" \
    --write-out '%{http_code}' \
    -H "Content-Type: application/json" \
    --data @"$login_body" \
    "${BACKEND_URL}/api/v1/mobile/auth/login")"

  if [[ "$status" != "200" ]]; then
    log "mobile auth 로그인 실패 (status=${status})."
    cat "$login_response" 2>/dev/null | sed 's/^/LOGIN_RESPONSE: /' || true
    rm -f "$login_body" "$login_response"
    exit 1
  fi

  ACCESS_TOKEN="$(normalize_access_token "$("$JQ" -r '.accessToken // empty' "$login_response")")"
  rm -f "$login_body"
  if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
    log "mobile auth 응답에서 accessToken을 추출하지 못했습니다."
    cat "$login_response" 2>/dev/null | sed 's/^/LOGIN_RESPONSE: /' || true
    rm -f "$login_response"
    exit 1
  fi
  rm -f "$login_response"
  log "테스트 계정 로그인 성공: ${EMAIL}"
}

resolve_access_token
AUTH_HEADERS=(-H "Authorization: Bearer ${ACCESS_TOKEN}")

http_status() {
  local path="$1"
  local code
  local body_file
  body_file="$(mktemp "${TEMP_DIR}/response-XXXXXX.json")"
  code="$(curl --silent --show-error \
    --output "$body_file" \
    --write-out '%{http_code}' \
    "${AUTH_HEADERS[@]}" \
    "${BACKEND_URL}${path}")"
  LAST_HTTP_BODY="$body_file"
  echo "$code"
}

is_success_payload() {
  local mode="$1"
  local body_file="$2"

  case "$mode" in
    detail)
      "$JQ" -e "$COMMUNITY_DETAIL_PREDICATE" "$body_file" >/dev/null 2>&1
      return $?
      ;;
    comments)
      "$JQ" -e "$COMMUNITY_COMMENT_PREDICATE" "$body_file" >/dev/null 2>&1
      return $?
      ;;
    *)
      "$JQ" -e '.' "$body_file" >/dev/null 2>&1
      return $?
      ;;
  esac
}

try_candidates() {
  local mode="$1"
  local payload_mode="$2"
  shift 2
  local -a paths=("$@")
  local path
  local code
  local first_failed_code="000"
  local first_failed_path="none"
  local first_failed_reason="empty_candidates"

  if (( ${#paths[@]} == 0 )); then
    echo "000|none|${mode}|empty_candidates"
    return 1
  fi

  for path in "${paths[@]}"; do
    code="$(http_status "$path")"
    local reason="unknown_failure"

    if [[ "$code" == "200" ]] && is_success_payload "$payload_mode" "$LAST_HTTP_BODY"; then
      echo "200|${path}|${mode}|success"
      return 0
    fi

    if [[ "$code" == "200" ]]; then
      reason="empty_payload"
    else
      reason="$code"
    fi

    if [[ "$first_failed_code" == "000" ]]; then
      first_failed_code="$code"
      first_failed_path="$path"
      first_failed_reason="$reason"
    fi

    if [[ -n "${LAST_HTTP_BODY}" && -f "${LAST_HTTP_BODY}" ]]; then
      rm -f "${LAST_HTTP_BODY}"
      LAST_HTTP_BODY=""
    fi
  done

  echo "${first_failed_code}|${first_failed_path}|${mode}|${first_failed_reason}"
  return 1
}

build_detail_candidates() {
  local community_slug="$1"
  local post_slug="$2"
  local post_id="$3"
  local paths=()
  local encoded_slug=""
  local encoded_post_slug=""
  local encoded_post_id=""

  if [[ -n "$community_slug" ]]; then
    encoded_slug="$(encode_path "$community_slug")"
  fi
  if [[ -n "$post_slug" ]]; then
    encoded_post_slug="$(encode_path "$post_slug")"
  fi
  if [[ -n "$post_id" ]]; then
    encoded_post_id="$(encode_path "$post_id")"
  fi

  if [[ -n "$post_slug" ]]; then
    paths+=("/api/v1/community/${encoded_slug}/posts/${encoded_post_slug}")
    paths+=("/api/v1/community/${encoded_slug}/comments/${encoded_post_slug}")
  fi

  if [[ -n "$post_id" ]]; then
    paths+=("/api/v1/community/${encoded_slug}/posts/id/${encoded_post_id}")
  fi

  if (( ${#paths[@]} == 0 )); then
    echo ""
    return 0
  fi
  printf '%s\n' "${paths[@]}"
}

build_comment_candidates() {
  local community_slug="$1"
  local post_slug="$2"
  local post_id="$3"
  local paths=()
  local encoded_slug=""
  local encoded_post_slug=""
  local encoded_post_id=""

  if [[ -n "$community_slug" ]]; then
    encoded_slug="$(encode_path "$community_slug")"
  fi
  if [[ -n "$post_slug" ]]; then
    encoded_post_slug="$(encode_path "$post_slug")"
  fi
  if [[ -n "$post_id" ]]; then
    encoded_post_id="$(encode_path "$post_id")"
  fi

  if [[ -n "$post_slug" ]]; then
    paths+=("/api/v1/community/${encoded_slug}/posts/${encoded_post_slug}/comments/paginated?limit=${MAX_COMMENT_LIMIT}")
    paths+=("/api/v1/community/${encoded_slug}/comments/${encoded_post_slug}/comments/paginated?limit=${MAX_COMMENT_LIMIT}")
  fi

  if [[ -n "$post_id" ]]; then
    paths+=("/api/v1/community/${encoded_slug}/posts/${encoded_post_id}/comments/paginated?limit=${MAX_COMMENT_LIMIT}")
    paths+=("/api/v1/community/${encoded_slug}/comments/${encoded_post_id}/comments/paginated?limit=${MAX_COMMENT_LIMIT}")
  fi

  if (( ${#paths[@]} == 0 )); then
    echo ""
    return 0
  fi
  printf '%s\n' "${paths[@]}"
}

FEED_STATUS="$(curl --silent --show-error \
  --output "$FEED_BODY" \
  --write-out '%{http_code}' \
  "${AUTH_HEADERS[@]}" \
  "${BACKEND_URL}/api/v1/feed?limit=${FEED_LIMIT}")"

if [[ "$FEED_STATUS" != "200" ]]; then
  log "feed 조회 실패(status=${FEED_STATUS}). 토큰 또는 권한을 확인해 주세요."
  log "response: $(cat \"$FEED_BODY\" 2>/dev/null || true)"
  rm -f "$FEED_BODY"
  exit 2
fi

if ! "$JQ" -e '.items | type == "array"' "$FEED_BODY" > /dev/null 2>&1; then
  log "피드 응답이 예상 형식이 아닙니다. 응답 형식/권한을 확인해 주세요."
  log "response: $(cat "$FEED_BODY")"
  rm -f "$FEED_BODY"
  exit 2
fi

source_type_stats="$(
  "$JQ" -c '.items // [] | map((.sourceType // "") ) | unique' "$FEED_BODY" 2>/dev/null
)"
if [[ -z "${source_type_stats}" ]]; then
  source_type_stats="[]"
fi

mapfile -t COMMUNITY_ITEMS < <("$JQ" -c "$COMMUNITY_ITEM_SELECTOR" "$FEED_BODY")

if (( ${#COMMUNITY_ITEMS[@]} == 0 )); then
  log "커뮤니티 소스 게시물이 없습니다."
  log "feed sourceType 분포: ${source_type_stats}"
  rm -f "$FEED_BODY"
  exit 1
fi

TOTAL=0
DETAIL_OK=0
COMMENTS_OK=0
FAILED=0
SKIPPED=0
REPORT_LINES=()
DETAIL_FAIL_REASONS=()
COMMENT_FAIL_REASONS=()

for raw in "${COMMUNITY_ITEMS[@]}"; do
  if (( TOTAL >= MAX_POSTS )); then
    break
  fi

  post_slug="$(echo "$raw" | "$JQ" -r '.slug // empty')"
  post_id="$(echo "$raw" | "$JQ" -r '.id // empty')"
  community_slug="$(echo "$raw" | "$JQ" -r '.communitySlug // empty')"
  community_name="$(echo "$raw" | "$JQ" -r '.communityName // empty')"
  source_type="$(echo "$raw" | "$JQ" -r '.sourceType // empty')"
  title="$(echo "$raw" | "$JQ" -r '.title // empty')"

  TOTAL=$((TOTAL + 1))

  if [[ -z "$community_slug" ]]; then
    SKIPPED=$((SKIPPED + 1))
    REPORT_LINES+=("[SKIP] sourceType=${source_type} id=${post_id} title=${title} slug=${post_slug} communitySlug=missing communityName=${community_name}")
    continue
  fi

  mapfile -t detail_candidates < <(build_detail_candidates "$community_slug" "$post_slug" "$post_id")
  if (( ${#detail_candidates[@]} == 0 )); then
    detail_code="000"
    detail_path="none"
    detail_reason="no_detail_candidate"
  else
    detail_result="$(try_candidates "detail" "detail" "${detail_candidates[@]}")"
    detail_code="${detail_result%%|*}"
    detail_path="$(echo "$detail_result" | cut -d'|' -f2)"
    detail_reason="$(echo "$detail_result" | cut -d'|' -f4)"
    if (( ${#detail_reason} == 0 )); then
      detail_reason="none"
    fi
  fi

  mapfile -t comment_candidates < <(build_comment_candidates "$community_slug" "$post_slug" "$post_id")
  if (( ${#comment_candidates[@]} == 0 )); then
    comment_code="000"
    comment_path="none"
    comment_reason="no_comment_candidate"
  else
    comment_result="$(try_candidates "comment" "comments" "${comment_candidates[@]}")"
    comment_code="${comment_result%%|*}"
    comment_path="$(echo "$comment_result" | cut -d'|' -f2)"
    comment_reason="$(echo "$comment_result" | cut -d'|' -f4)"
    if (( ${#comment_reason} == 0 )); then
      comment_reason="none"
    fi
  fi

  if [[ "$detail_code" == "200" ]]; then
    DETAIL_OK=$((DETAIL_OK + 1))
  else
    FAILED=$((FAILED + 1))
    DETAIL_FAIL_REASONS+=("${detail_reason}|${community_slug}|${post_id}|${post_slug}|${detail_path}")
  fi

  if [[ "$comment_code" == "200" ]]; then
    COMMENTS_OK=$((COMMENTS_OK + 1))
  else
    FAILED=$((FAILED + 1))
    COMMENT_FAIL_REASONS+=("${comment_reason}|${community_slug}|${post_id}|${post_slug}|${comment_path}")
  fi

  if [[ "$detail_code" == "200" ]]; then
    REPORT_LINES+=( "[OK] detail source=${source_type} title=${title} slug=${post_slug} id=${post_id} community=${community_slug}/${community_name} [code=${detail_code}, path=${detail_path}]")
  else
    REPORT_LINES+=( "[FAIL] detail source=${source_type} title=${title} slug=${post_slug} id=${post_id} community=${community_slug}/${community_name} [code=${detail_code}, path=${detail_path}, reason=${detail_reason}]")
  fi

  if [[ "$comment_code" == "200" ]]; then
    REPORT_LINES+=( "[OK] comments source=${source_type} title=${title} slug=${post_slug} id=${post_id} community=${community_slug}/${community_name} [code=${comment_code}, path=${comment_path}]")
  else
    REPORT_LINES+=( "[FAIL] comments source=${source_type} title=${title} slug=${post_slug} id=${post_id} community=${community_slug}/${community_name} [code=${comment_code}, path=${comment_path}, reason=${comment_reason}]")
  fi
done

{
  echo "[community-fallback] 검증 결과"
  echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "backend: ${BACKEND_URL}"
  if [[ -n "${EMAIL}" ]]; then
    echo "account: ${EMAIL}(credential)"
  else
    echo "account: token-login"
  fi
  echo "feed_limit: ${FEED_LIMIT}"
  echo "tested_limit: ${MAX_POSTS}"
  echo "checked: ${TOTAL}"
  echo "source_filter: sourceType=community/thread 또는 sourceType empty + community.slug"
  echo "sourceType_distribution: ${source_type_stats}"
  echo "skipped: ${SKIPPED}"
  echo "detail_ok: ${DETAIL_OK}"
  echo "comments_ok: ${COMMENTS_OK}"
  echo "failed_cases: ${FAILED}"
  echo "accessToken: $(shorten_token "$ACCESS_TOKEN")"
  if (( ${#DETAIL_FAIL_REASONS[@]} > 0 )); then
    echo "---- detail 실패 케이스"
    printf '%s\n' "${DETAIL_FAIL_REASONS[@]}" | while IFS='|' read -r reason community_slug post_id post_slug path; do
      printf '[detail] community=%s postId=%s postSlug=%s path=%s reason=%s\n' "$community_slug" "$post_id" "$post_slug" "$path" "$reason"
    done
  fi
  if (( ${#COMMENT_FAIL_REASONS[@]} > 0 )); then
    echo "---- comment 실패 케이스"
    printf '%s\n' "${COMMENT_FAIL_REASONS[@]}" | while IFS='|' read -r reason community_slug post_id post_slug path; do
      printf '[comment] community=%s postId=%s postSlug=%s path=%s reason=%s\n' "$community_slug" "$post_id" "$post_slug" "$path" "$reason"
    done
  fi
  echo "----"
  printf '%s\n' "${REPORT_LINES[@]}"
} > "$REPORT_PATH"

cat "$REPORT_PATH"

if (( FAILED > 0 )); then
  echo "[RESULT] FAIL - community detail/comment fallback 실패 케이스가 있습니다."
  exit 2
fi

echo "[RESULT] PASS"
