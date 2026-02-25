#!/usr/bin/env bash
set -euo pipefail

IOS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SCHEME="${MOBILE_IOS_SCHEME:-MyBlogIOSApp}"
UDID="${MOBILE_IOS_SIMULATOR_UDID:-AF9D69C4-9D68-4063-9B90-B72CBFED028E}"
BUNDLE_ID="${MOBILE_IOS_BUNDLE_ID:-kr.sihyung.MyBlogIOSApp}"
BACKEND_URL="${MOBILE_BACKEND_URL:-http://localhost:3000}"
API_BASE_URL="${MOBILE_API_BASE_URL:-${BACKEND_URL%/}/api/v1}"
FRONTEND_URL="${MOBILE_FRONTEND_URL:-http://localhost:3001}"
SOCKET_URL="${MOBILE_SOCKET_URL:-${API_BASE_URL}}"
OAUTH_CALLBACK_URL="${MOBILE_OAUTH_CALLBACK_URL:-codebase://auth/callback}"
TRACE_SECONDS="${MOBILE_IOS_TRACE_SECONDS:-0}"
TRACE_LOG="${MOBILE_IOS_TRACE_LOG:-}"
SESSION_FIXTURE="${MOBILE_IOS_SESSION_FIXTURE:-}"
SESSION_FIXTURE_ACCESS_TOKEN="${MOBILE_IOS_FIXTURE_ACCESS_TOKEN:-}"
SESSION_FIXTURE_REFRESH_TOKEN="${MOBILE_IOS_FIXTURE_REFRESH_TOKEN:-}"
SESSION_FIXTURE_EXPIRED_AT="${MOBILE_IOS_FIXTURE_EXPIRED_AT:-}"

TRACE_LOG="${TRACE_LOG%\"}"
TRACE_LOG="${TRACE_LOG#\"}"
if [[ -z "${BUNDLE_ID}" ]]; then
  echo "MOBILE_IOS_BUNDLE_ID 환경변수 또는 기본값이 비어 있습니다."
  exit 1
fi

OAUTH_CALLBACK_SCHEME="${OAUTH_CALLBACK_URL%%:*}"
if [[ -z "${OAUTH_CALLBACK_SCHEME}" || "${OAUTH_CALLBACK_SCHEME}" == "${OAUTH_CALLBACK_URL}" ]]; then
  echo "MOBILE_OAUTH_CALLBACK_URL이 올바르지 않습니다: ${OAUTH_CALLBACK_URL}"
  exit 1
fi

WRAP_APP_PATH="/tmp/${SCHEME}.runtime.app"

resolve_run_build_root() {
  local binary_path
  binary_path="$(find "$HOME/Library/Developer/Xcode/DerivedData" -type f -path '*/Build/Products/Debug-iphonesimulator/MyBlogIOSApp' | head -n 1)"
  if [[ -z "${binary_path}" ]]; then
    echo ""
    return
  fi
  dirname "${binary_path}"
}

BACKEND_HEALTH_ENDPOINTS=(
  "${BACKEND_URL}/health"
  "${BACKEND_URL}/api/v1/health"
  "${BACKEND_URL}/api/v1"
  "${BACKEND_URL}/api/v1/feed?limit=1"
  "${BACKEND_URL}"
)

TRACE_PID=""
cleanup_trace_stream() {
  if [[ -n "${TRACE_PID}" ]]; then
    kill "${TRACE_PID}" >/dev/null 2>&1 || true
    wait "${TRACE_PID}" >/dev/null 2>&1 || true
    TRACE_PID=""
  fi
}
trap cleanup_trace_stream EXIT

echo "[1/4] backend health check"
if ! (for url in "${BACKEND_HEALTH_ENDPOINTS[@]}"; do
  if curl --fail --silent --show-error "$url" > /dev/null; then
    echo "backend healthy ($url)"
    exit 0
  fi
done
exit 1); then
  echo "backend health check failed: ${BACKEND_URL} (api/v1/health, api/v1, root) all unreachable"
  echo "계속하려면 backend를 먼저 기동해 주세요."
  exit 1
fi

echo "[2/4] xcode build"
cd "$IOS_ROOT/app/ios-app"
xcodebuild -scheme "$SCHEME" -configuration Debug \
  -destination "platform=iOS Simulator,id=${UDID}" \
  build

RUN_BUILD_ROOT="$(resolve_run_build_root)"
if [[ -z "${RUN_BUILD_ROOT}" ]]; then
  echo "빌드 산출물 경로를 찾을 수 없습니다."
  echo "xcodebuild를 다시 실행한 뒤 재시도해 주세요."
  exit 1
fi

if [[ ! -x "${RUN_BUILD_ROOT}/MyBlogIOSApp" ]]; then
  echo "빌드 결과를 찾을 수 없습니다: ${RUN_BUILD_ROOT}/MyBlogIOSApp"
  exit 1
fi

echo "[3/4] create runtime bundle"
rm -rf "$WRAP_APP_PATH"
mkdir -p "$WRAP_APP_PATH"
cp "${RUN_BUILD_ROOT}/MyBlogIOSApp" "$WRAP_APP_PATH/MyBlogIOSApp"
if [[ -d "${RUN_BUILD_ROOT}/MyBlogIOSApp_MyBlogIOSApp.bundle" ]]; then
  cp -R "${RUN_BUILD_ROOT}/MyBlogIOSApp_MyBlogIOSApp.bundle" "$WRAP_APP_PATH/"
fi
cat > "$WRAP_APP_PATH/Info.plist" <<EOF2
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleExecutable</key>
    <string>MyBlogIOSApp</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>MyBlogIOSApp</string>
    <key>CFBundleDisplayName</key>
    <string>MyBlog</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>MOBILE_API_BASE_URL</key>
    <string>${API_BASE_URL}</string>
    <key>MOBILE_FRONTEND_URL</key>
    <string>${FRONTEND_URL}</string>
    <key>MOBILE_SOCKET_URL</key>
    <string>${SOCKET_URL}</string>
    <key>MOBILE_OAUTH_CALLBACK_URL</key>
    <string>${OAUTH_CALLBACK_URL}</string>
    <key>CFBundleURLTypes</key>
    <array>
      <dict>
        <key>CFBundleURLName</key>
        <string>${BUNDLE_ID}.oauth</string>
        <key>CFBundleURLSchemes</key>
        <array>
          <string>${OAUTH_CALLBACK_SCHEME}</string>
        </array>
      </dict>
    </array>
    <key>MinimumOSVersion</key>
    <string>17.0</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
      <string>UIInterfaceOrientationPortrait</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
      <string>UIInterfaceOrientationPortrait</string>
      <string>UIInterfaceOrientationLandscapeLeft</string>
      <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
  </dict>
</plist>
EOF2
chmod +x "$WRAP_APP_PATH/MyBlogIOSApp"

if (( TRACE_SECONDS > 0 )); then
  if [[ -z "${TRACE_LOG}" ]]; then
    TRACE_LOG="${HOME}/Library/Logs/MyBlogIOSApp/runtime-trace-$(date +%Y%m%d-%H%M%S).log"
  fi
  mkdir -p "$(dirname "$TRACE_LOG")"
  rm -f "$TRACE_LOG"
  echo "[3.5/4] trace capture start (${TRACE_SECONDS}s)"
  xcrun simctl spawn "$UDID" log stream --style compact --level debug \
    --predicate 'subsystem == "com.myblog.IOSRunTrace" OR eventMessage CONTAINS "[IOS-TRACE]"' > "$TRACE_LOG" 2>&1 &
  TRACE_PID=$!
  sleep 1
fi

echo "[4/4] simulator boot + install + launch"
if xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1; then
  :
else
  xcrun simctl boot "$UDID"
fi

xcrun simctl uninstall "$UDID" "$BUNDLE_ID" || true
xcrun simctl install "$UDID" "$WRAP_APP_PATH"

LAUNCH_ARGS=()
LAUNCH_ARGS+=(--env MOBILE_API_BASE_URL="${API_BASE_URL}")
LAUNCH_ARGS+=(--env MOBILE_FRONTEND_URL="${FRONTEND_URL}")
LAUNCH_ARGS+=(--env MOBILE_SOCKET_URL="${SOCKET_URL}")
LAUNCH_ARGS+=(--env MOBILE_OAUTH_CALLBACK_URL="${OAUTH_CALLBACK_URL}")
if [[ -n "${SESSION_FIXTURE}" ]]; then
  LAUNCH_ARGS+=(--env MOBILE_IOS_SESSION_FIXTURE="${SESSION_FIXTURE}")
fi
if [[ -n "${SESSION_FIXTURE_ACCESS_TOKEN}" ]]; then
  LAUNCH_ARGS+=(--env MOBILE_IOS_FIXTURE_ACCESS_TOKEN="${SESSION_FIXTURE_ACCESS_TOKEN}")
fi
if [[ -n "${SESSION_FIXTURE_REFRESH_TOKEN}" ]]; then
  LAUNCH_ARGS+=(--env MOBILE_IOS_FIXTURE_REFRESH_TOKEN="${SESSION_FIXTURE_REFRESH_TOKEN}")
fi
if [[ -n "${SESSION_FIXTURE_EXPIRED_AT}" ]]; then
  LAUNCH_ARGS+=(--env MOBILE_IOS_FIXTURE_EXPIRED_AT="${SESSION_FIXTURE_EXPIRED_AT}")
fi

if (( ${#LAUNCH_ARGS[@]} > 0 )); then
  xcrun simctl launch "$UDID" "$BUNDLE_ID" "${LAUNCH_ARGS[@]}"
else
  xcrun simctl launch "$UDID" "$BUNDLE_ID"
fi
echo "launch request sent"

if (( TRACE_SECONDS > 0 )); then
  sleep "$TRACE_SECONDS"
  cleanup_trace_stream
  echo "[trace] saved: $TRACE_LOG"
  if [[ -s "$TRACE_LOG" ]]; then
    echo "---- trace tail ----"
    tail -n 40 "$TRACE_LOG"
  else
    echo "[trace] 로그가 비어있습니다."
  fi
fi
