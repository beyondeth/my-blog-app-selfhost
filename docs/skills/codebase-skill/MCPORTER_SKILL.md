# MCPorter Cheat Sheet (Codebase.blog)

This file is a command-first cheat sheet for publishing via the Codebase.blog MCP server using `mcporter`.

## Route Scope

- This cheat sheet is for `skill` route only (`mcporter` -> `/mcp-remote`).
- If user explicitly requests `mcp` route, use direct MCP tools (`codebase-blog-mcp`) instead of this cheat sheet.
- Before posting in this route, `check_auth` output must include: `인증 방식 : OAuth 2.1`.
- If OAuth auth fails, do NOT fallback to API Key/direct MCP in this route.
- Allowed fallback in this route is OAuth alias only: `codebase-blog-oauth` -> `codebase-blog-oauth-prod`.

## 0) Setup (Once)

```bash
# DEV (DEFAULT)
npx -y mcporter config add codebase-blog-oauth \
  --url http://localhost:3002/mcp-remote \
  --auth oauth \
  --allow-http \
  --oauth-redirect-url http://127.0.0.1:33334/callback \
  --scope project

# PROD (explicit opt-in)
npx -y mcporter config add codebase-blog-oauth-prod \
  --url https://mcp.codebase.blog/mcp-remote \
  --auth oauth \
  --oauth-redirect-url http://127.0.0.1:33333/callback \
  --scope home

# Browser OAuth (first time only)
npx -y mcporter auth codebase-blog-oauth
```

## 1) Ensure OAuth Session (Always First)

```bash
npx -y mcporter --oauth-timeout 180000 auth codebase-blog-oauth

AUTH_OUT=$(npx -y mcporter call codebase-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"

if ! echo "$AUTH_OUT" | grep -q 'OAuth 2.1'; then
  echo "[STOP] OAuth mode verification failed. create_post not executed."
  exit 1
fi
```

## JSON Args Standard

Use `--args <json>` for all examples in this route.

- Inline JSON is acceptable for short scalar inputs.
- Long markdown or custom style files should be loaded with Node and serialized once.
- Do not use shell-quoted function-call syntax for publish operations.

## Visible Staged Flow

For terminal UX, do not collapse everything into one silent publish call.

Print and execute these stages in order:

1. `[Route] ...`
2. `[1/4] OAuth 로그인 완료 대기` + `mcporter auth`
3. `[2/4] OAuth 인증 상태 검증` + `check_auth`
4. `[3/4] 스타일 가이드 확인` + `get_writing_style_guide`
5. `[4/4] 포스트 발행` + `create_post`

If the body is already written, the style guide step can still be used as a visible progress checkpoint instead of being silently omitted.

## 2) Publish

```bash
POST_PAYLOAD=$(node - <<'NODE'
const fs = require('fs');

process.stdout.write(JSON.stringify({
  title: 'MCP 자동포스팅 예시',
  content_markdown: fs.readFileSync('./post.md', 'utf8'),
  category: 'Tech',
  tags: ['mcp', 'mcporter', 'automation'],
}));
NODE
)

STYLE_ARGS='{"style":"default"}'

echo '[Route] mode=skill transport=mcporter endpoint=/mcp-remote alias=codebase-blog-oauth'
echo '[1/4] OAuth 로그인 완료 대기'
npx -y mcporter --oauth-timeout 180000 auth codebase-blog-oauth
echo '[2/4] OAuth 인증 상태 검증'
npx -y mcporter call codebase-blog-oauth.check_auth --output json
echo '[3/4] 스타일 가이드 확인'
npx -y mcporter call codebase-blog-oauth.get_writing_style_guide --args "$STYLE_ARGS"
echo '[4/4] 포스트 발행'
npx -y mcporter call codebase-blog-oauth.create_post --args "$POST_PAYLOAD"
```

## 3) Optional: Style Guide

```bash
STYLE_ARGS='{"style":"default"}'
npx -y mcporter call codebase-blog-oauth.get_writing_style_guide --args "$STYLE_ARGS"
```

## 4) Optional: Image Upload

```bash
npx -y mcporter call codebase-blog-oauth.get_image_upload_url --args '{"mimeType":"image/webp","fileSize":245760}'

curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"

npx -y mcporter call codebase-blog-oauth.finalize_uploaded_image --args '{"fileKey":"uploads/...","mimeType":"image/webp","fileSize":245760}'
```

## Troubleshooting

- If the login UI does not appear: you may already be logged in. Try `npx -y mcporter auth codebase-blog-oauth --reset`.
- If the browser shows `Authorization successful`: that callback already woke the waiting `mcporter auth` process. Continue immediately after `auth` returns instead of starting a manual poll loop.
- If you see `SSE error: Invalid content type, expected "text/event-stream"` during `auth`: tokens may still be saved. Run `check_auth` to confirm.
- If you see `EADDRINUSE ... 127.0.0.1:33334`: treat it as a callback-port collision, retry once, then try `npx -y mcporter auth codebase-blog-oauth --reset` or move the callback port.
- If the body contains quotes, backticks, or long code fences: keep using `--args` and do not wrap the payload in a shell-quoted function call.
