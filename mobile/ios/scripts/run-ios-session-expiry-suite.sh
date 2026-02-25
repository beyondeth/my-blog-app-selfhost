#!/usr/bin/env bash
set -euo pipefail

MODES_INPUT="${MOBILE_IOS_SESSION_EXPIRY_MODES:-expired invalid expired_refresh missing_refresh force_refresh_fail}"
TRACE_SECONDS="${MOBILE_IOS_SESSION_TRACE_SECONDS:-25}"
BACKEND_LOG_DIR="${TMPDIR:-/tmp}/my-blog-ios-session-suite"
SUITE_REPORT="${MOBILE_IOS_SESSION_EXPIRY_SUITE_REPORT:-/tmp/my-blog-ios-session-suite-summary.txt}"

mkdir -p "$BACKEND_LOG_DIR"

MODES=()
read -r -a MODES <<< "$MODES_INPUT"

echo "session expiry suite modes: ${MODES[*]}"
echo "trace seconds: $TRACE_SECONDS"
echo "output: $SUITE_REPORT"

PASS_COUNT=0
FAIL_COUNT=0
REPORT_LINES=()

for mode in "${MODES[@]}"; do
  suite_trace="${BACKEND_LOG_DIR}/suite-${mode}-trace.log"
  suite_report="${BACKEND_LOG_DIR}/suite-${mode}-report.txt"
  mode_log="/tmp/my-blog-ios-session-suite-${mode}.log"

  echo "[suite] mode=$mode"

  if MOBILE_IOS_SESSION_TRACE_SECONDS="$TRACE_SECONDS" \
    MOBILE_IOS_SESSION_TRACE_LOG="$suite_trace" \
    MOBILE_IOS_SESSION_TRACE_REPORT="$suite_report" \
    ./scripts/run-ios-session-expiry-smoke.sh "$mode" > "$mode_log" 2>&1; then
    PASS_COUNT=$((PASS_COUNT + 1))
    if [[ -f "$suite_report" ]]; then
      auth_expired="$(grep 'has_auth_expired:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      toast_shown="$(grep 'has_session_toast_shown:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      login_shown="$(grep 'has_login_shown:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      refresh_started="$(grep 'has_refresh_request:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      refresh_failed="$(grep 'has_refresh_failed:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      REPORT_LINES+=("[PASS] $mode auth_expired=$auth_expired toast=$toast_shown login=$login_shown refresh_start=$refresh_started refresh_failed=$refresh_failed")
    else
      REPORT_LINES+=("[PASS] $mode (report missing)")
    fi
    echo "[suite] PASS mode=$mode"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    if [[ -f "$suite_report" ]]; then
      auth_expired="$(grep 'has_auth_expired:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      toast_shown="$(grep 'has_session_toast_shown:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      login_shown="$(grep 'has_login_shown:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      refresh_started="$(grep 'has_refresh_request:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      refresh_failed="$(grep 'has_refresh_failed:' "$suite_report" | awk '{print $2}' | tail -n 1)"
      REPORT_LINES+=("[FAIL] $mode auth_expired=$auth_expired toast=$toast_shown login=$login_shown refresh_start=$refresh_started refresh_failed=$refresh_failed")
    else
      REPORT_LINES+=("[FAIL] $mode")
    fi
    echo "[suite] FAIL mode=$mode"
    echo "--- mode log ---"
    cat "$mode_log"
  fi
done

{
  echo "[session-expiry-suite] summary"
  echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "modes: ${MODES[*]}"
  echo "pass: $PASS_COUNT"
  echo "fail: $FAIL_COUNT"
  printf '%s\n' "${REPORT_LINES[@]}"
} > "$SUITE_REPORT"

cat "$SUITE_REPORT"

if (( FAIL_COUNT > 0 )); then
  exit 2
fi
