#!/usr/bin/env bash
set -euo pipefail

IOS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$IOS_ROOT/../.." && pwd)"
PUBLIC_ROOT="$REPO_ROOT/frontend/public"
FRONTEND_ASSETS="$PUBLIC_ROOT/assets"
FRONTEND_CHARACTERS="$PUBLIC_ROOT/character"
FRONTEND_USER_IMAGES="$PUBLIC_ROOT/user_images"
TARGET_RESOURCES="$IOS_ROOT/app/ios-app/Sources/MyBlogIOSApp/Resources"
TARGET_AUTH="$TARGET_RESOURCES/Auth"
TARGET_APP="$TARGET_RESOURCES/App"
TARGET_CHARACTER="$TARGET_RESOURCES/Character"
TARGET_SAMPLE_PROFILES="$TARGET_RESOURCES/SampleProfiles"

mkdir -p "$TARGET_AUTH" "$TARGET_APP" "$TARGET_CHARACTER" "$TARGET_SAMPLE_PROFILES"

cp "$FRONTEND_ASSETS/auth_login/github/GitHub_Logo_White.png" "$TARGET_AUTH/GitHub_Logo_White.png"
cp "$FRONTEND_ASSETS/auth_login/github/GitHub_Logo.png" "$TARGET_AUTH/GitHub_Logo.png"
cp "$FRONTEND_ASSETS/auth_login/github/github-mark-white.png" "$TARGET_AUTH/github-mark-white.png"
cp "$FRONTEND_ASSETS/auth_login/github/github-mark.png" "$TARGET_AUTH/github-mark.png"
cp "$FRONTEND_ASSETS/auth_icons/kakao/kakaologin.png" "$TARGET_AUTH/kakaologin.png"

cp "$FRONTEND_ASSETS/block-logo.png" "$TARGET_APP/block-logo.png"
cp "$FRONTEND_ASSETS/block-logo(dark).png" "$TARGET_APP/block-logo-dark.png"
cp "$FRONTEND_ASSETS/block-logo(dark)-128.png" "$TARGET_APP/block-logo-dark-128.png"
cp "$FRONTEND_ASSETS/logo.svg" "$TARGET_APP/logo.svg"

if command -v sips >/dev/null 2>&1; then
  sips -s format png "$FRONTEND_ASSETS/auth_icons/google/web_light_rd_na.svg" --out "$TARGET_AUTH/google_light.png" >/dev/null
  sips -s format png "$FRONTEND_ASSETS/auth_icons/google/web_dark_rd_na.svg" --out "$TARGET_AUTH/google_dark.png" >/dev/null
else
  cp "$FRONTEND_ASSETS/auth_icons/google/web_light_rd_na.svg" "$TARGET_AUTH/google_light.svg"
  cp "$FRONTEND_ASSETS/auth_icons/google/web_dark_rd_na.svg" "$TARGET_AUTH/google_dark.svg"
fi

if [[ -d "$FRONTEND_CHARACTERS" ]]; then
  find "$FRONTEND_CHARACTERS" -maxdepth 1 -type f \( -iname '*.jpeg' -o -iname '*.jpg' -o -iname '*.png' \) \
    -exec cp {} "$TARGET_CHARACTER/" \;
fi

if [[ -d "$FRONTEND_USER_IMAGES" ]]; then
  find "$FRONTEND_USER_IMAGES" -maxdepth 1 -type f \( -iname '*.jpeg' -o -iname '*.jpg' -o -iname '*.png' \) \
    -exec cp {} "$TARGET_SAMPLE_PROFILES/" \;
fi

CHARACTER_COUNT="$(find "$TARGET_CHARACTER" -maxdepth 1 -type f | wc -l | tr -d ' ')"
SAMPLE_PROFILE_COUNT="$(find "$TARGET_SAMPLE_PROFILES" -maxdepth 1 -type f | wc -l | tr -d ' ')"

echo "Synced iOS brand assets from frontend/public/assets into mobile iOS resources."
echo "Target: $TARGET_RESOURCES"
echo "Character assets: $CHARACTER_COUNT"
echo "Sample profile assets: $SAMPLE_PROFILE_COUNT"
