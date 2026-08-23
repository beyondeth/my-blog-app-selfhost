# MCPorter Cheat Sheet (Aigory)

This file is a command-first cheat sheet for publishing via the Aigory MCP server using `mcporter`.

## Route Scope

- This cheat sheet is for `skill` route only (`mcporter` -> `/mcp-remote`).
- If user explicitly requests `mcp` route, use direct MCP tools (`aigory-blog-mcp`) instead of this cheat sheet.
- Before posting in this route, `check_auth` output must include: `인증 방식 : OAuth 2.1`.

## 0) Setup (Once)

```bash
# DEV (DEFAULT)
npx -y mcporter config add aigory-blog-oauth \
  --url http://localhost:3002/mcp-remote \
  --auth oauth \
  --allow-http \
  --oauth-redirect-url http://127.0.0.1:33334/callback \
  --scope project

# PROD (explicit opt-in)
npx -y mcporter config add aigory-blog-oauth-prod \
  --url https://mcp.aigory.com/mcp-remote \
  --auth oauth \
  --oauth-redirect-url http://127.0.0.1:33333/callback \
  --scope home

# Browser OAuth (first time only)
npx -y mcporter auth aigory-blog-oauth
```

## 1) Safe Gate (Always First)

```bash
AUTH_OUT=$(npx -y mcporter call aigory-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"

if echo "$AUTH_OUT" | grep -q '"error"'; then
  echo "[STOP] OAuth verification failed. create_post not executed."
  exit 1
fi
```

## 2) Publish

```bash
npx -y mcporter call 'aigory-blog-oauth.create_post(
  title: "MCP 자동포스팅 예시",
  content_markdown: "## Hello\n\nmcporter로 발행한 글입니다.",
  category: "Tech",
  tags: ["mcp","mcporter","automation"]
)'
```

## 3) Optional: Style Guide

```bash
npx -y mcporter call 'aigory-blog-oauth.get_writing_style_guide(style: "default")'
```

## 4) Optional: Image Upload

```bash
npx -y mcporter call 'aigory-blog-oauth.get_image_upload_url(mimeType: "image/webp", fileSize: 245760)'

curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"

npx -y mcporter call 'aigory-blog-oauth.finalize_uploaded_image(fileKey: "uploads/...", mimeType: "image/webp", fileSize: 245760)'
```

## Troubleshooting

- If the login UI does not appear: you may already be logged in. Try `npx -y mcporter auth aigory-blog-oauth --reset`.
- If you see `SSE error: Invalid content type, expected "text/event-stream"` during `auth`: tokens may still be saved. Run `check_auth` to confirm.
