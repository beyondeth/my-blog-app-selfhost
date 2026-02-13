#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-expired}"
TRACE_SECONDS="${MOBILE_IOS_SESSION_TRACE_SECONDS:-25}"
TRACE_LOG="${MOBILE_IOS_SESSION_TRACE_LOG:-/tmp/my-blog-ios-auth-expiry-trace.log}"
REPORT_FILE="${MOBILE_IOS_SESSION_TRACE_REPORT:-/tmp/my-blog-ios-auth-expiry-report.txt}"
TRACE_LOG="$(printf '%s\n' "$TRACE_LOG" | sed 's/^\"//; s/\"$//')"

VALID_MODES=(
  "expired"
  "invalid"
  "expired_refresh"
  "missing_refresh"
  "force_refresh_fail"
)

is_valid_mode=0
for candidate in "${VALID_MODES[@]}"; do
  if [[ "$candidate" == "$MODE" ]]; then
    is_valid_mode=1
    break
  fi
done

if (( is_valid_mode == 0 )); then
  echo "usage: $0 [expired|invalid|expired_refresh|missing_refresh|force_refresh_fail]"
  exit 1
fi

apply_default_fixture() {
  case "$MODE" in
    invalid)
      : "${MOBILE_IOS_FIXTURE_ACCESS_TOKEN:=invalid_access_token_debug}"
      : "${MOBILE_IOS_FIXTURE_REFRESH_TOKEN:=invalid_refresh_token_debug}"
      ;;
    missing_refresh)
      : "${MOBILE_IOS_FIXTURE_ACCESS_TOKEN:=expired_access_token_debug}"
      MOBILE_IOS_FIXTURE_REFRESH_TOKEN=""
      ;;
    force_refresh_fail)
      : "${MOBILE_IOS_FIXTURE_ACCESS_TOKEN:=expired_access_token_debug}"
      : "${MOBILE_IOS_FIXTURE_REFRESH_TOKEN:=expired_refresh_token_debug}"
      ;;
    expired|expired_refresh|*)
      : "${MOBILE_IOS_FIXTURE_ACCESS_TOKEN:=expired_access_token_debug}"
      : "${MOBILE_IOS_FIXTURE_REFRESH_TOKEN:=expired_refresh_token_debug}"
      ;;
  esac
}

apply_default_fixture

export MOBILE_IOS_SESSION_FIXTURE="$MODE"
export MOBILE_IOS_TRACE_SECONDS="$TRACE_SECONDS"
export MOBILE_IOS_TRACE_LOG="$TRACE_LOG"
export MOBILE_IOS_FIXTURE_ACCESS_TOKEN
export MOBILE_IOS_FIXTURE_REFRESH_TOKEN
if [[ -n "${MOBILE_IOS_FIXTURE_EXPIRED_AT:-}" ]]; then
  export MOBILE_IOS_FIXTURE_EXPIRED_AT
fi

has_trace() {
  local pattern="$1"
  grep -qE "$pattern" "$TRACE_LOG"
}

extract_mode_requirements() {
  case "$MODE" in
    expired|invalid)
      REQUIRE_AUTH_EXPIRED="true"
      REQUIRE_TOAST="true"
      REQUIRE_LOGIN_SHOWN="true"
      REQUIRE_REFRESH_STARTED="false"
      REQUIRE_REFRESH_FAILED="false"
      ;;
    expired_refresh|force_refresh_fail)
      REQUIRE_AUTH_EXPIRED="true"
      REQUIRE_TOAST="true"
      REQUIRE_LOGIN_SHOWN="true"
      REQUIRE_REFRESH_STARTED="true"
      REQUIRE_REFRESH_FAILED="true"
      ;;
    missing_refresh)
      REQUIRE_AUTH_EXPIRED="true"
      REQUIRE_TOAST="true"
      REQUIRE_LOGIN_SHOWN="true"
      REQUIRE_REFRESH_STARTED="false"
      REQUIRE_REFRESH_FAILED="false"
      ;;
    *)
      REQUIRE_AUTH_EXPIRED="true"
      REQUIRE_TOAST="true"
      REQUIRE_LOGIN_SHOWN="true"
      REQUIRE_REFRESH_STARTED="false"
      REQUIRE_REFRESH_FAILED="false"
      ;;
  esac
}

extract_mode_requirements

{
  echo "[1/3] run-ios simulator flow with fixture=$MODE"
  cd "$(cd "$(dirname "$0")/.." && pwd)"
  ./scripts/run-simulator-flow.sh
} >/tmp/my-blog-ios-session-expiry-run.log 2>&1

if [[ ! -f "$TRACE_LOG" ]]; then
  echo "[2/3] trace log file missing: $TRACE_LOG"
  echo "[2/3] runner output:"
  cat /tmp/my-blog-ios-session-expiry-run.log
  exit 2
fi

AUTH_EXPIRED=false
TOAST_SHOWN=false
REFRESH_STARTED=false
REFRESH_FAILED=false
LOGIN_SHOWN=false
LOGIN_MESSAGE=false
MAIN_SHOWN=false

if has_trace '\\[IOS-TRACE\\]\\[auth\\] auth\\.expired|\\[auth\\.expired\\]'; then AUTH_EXPIRED=true; fi
if has_trace '\\[IOS-TRACE\\]\\[auth\\] auth\\.toast_shown|\\[auth\\.toast_shown\\]'; then TOAST_SHOWN=true; fi
if has_trace '\\[IOS-TRACE\\]\\[network\\] request\\.refresh_start|request\\.refresh_start'; then REFRESH_STARTED=true; fi
if has_trace '\\[IOS-TRACE\\]\\[network\\] request\\.refresh_failed|request\\.refresh_failed'; then REFRESH_FAILED=true; fi
if has_trace '\\[IOS-TRACE\\]\\[auth\\] auth\\.login_shown|\\[auth\\.login_shown\\]'; then LOGIN_SHOWN=true; fi
if has_trace '세션이 만료|session has expired|다시 로그인'; then LOGIN_MESSAGE=true; fi
if has_trace '\\[IOS-TRACE\\]\\[ui\\] ui\\.main_shown|MainTabShellView'; then MAIN_SHOWN=true; fi

{
  echo "[community-expiry] auth replay report"
  echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "fixture: $MODE"
  echo "trace: $TRACE_LOG"
  echo "has_auth_expired: $AUTH_EXPIRED"
  echo "has_session_toast_shown: $TOAST_SHOWN"
  echo "has_profile_refresh: $(if has_trace '\\[IOS-TRACE\\]\\[profile\\] auth\\.profile_refresh|\\[auth\\.profile_refresh\\]'; then echo true; else echo false; fi)"
  echo "has_refresh_request: $REFRESH_STARTED"
  echo "has_refresh_failed: $REFRESH_FAILED"
  echo "has_login_shown: $LOGIN_SHOWN"
  echo "has_login_message: $LOGIN_MESSAGE"
  echo "has_main_tab_shown: $MAIN_SHOWN"
  echo "trace_bytes: $(wc -c <\"$TRACE_LOG\")"
} > "$REPORT_FILE"

echo "[2/3] result"
cat "$REPORT_FILE"

failures=()
if [[ "$REQUIRE_AUTH_EXPIRED" == "true" && "$AUTH_EXPIRED" == false ]]; then
  failures+=("missing auth.expired trace")
fi
if [[ "$REQUIRE_TOAST" == "true" && "$TOAST_SHOWN" == false ]]; then
  failures+=("missing auth.toast_shown trace")
fi
if [[ "$REQUIRE_LOGIN_SHOWN" == "true" && "$LOGIN_SHOWN" == false ]]; then
  failures+=("missing auth.login_shown trace")
fi
if [[ "$REQUIRE_REFRESH_STARTED" == "true" && "$REFRESH_STARTED" == false ]]; then
  failures+=("missing network.refresh_start trace")
fi
if [[ "$REQUIRE_REFRESH_FAILED" == "true" && "$REFRESH_FAILED" == false ]]; then
  failures+=("missing network.refresh_failed trace")
fi

if (( ${#failures[@]} > 0 )); then
  echo "FAILED: session expiry smoke criteria not met."
  printf ' - %s\n' "${failures[@]}"
  exit 3
fi

echo "PASS: session expiry recovery criteria met."
