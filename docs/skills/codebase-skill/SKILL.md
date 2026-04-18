---
name: codebase-skill
description: "Codebase.blog auto-posting via MCPorter + OAuth. Trigger words: 자동포스팅, 자동포스팅해, 포스팅해줘, 블로그 포스팅해줘, 글 발행해줘, create post, publish post. Route rule: skill로 -> mcporter (/mcp-remote), mcp로 -> direct MCP (/mcp), ambiguous defaults to skill."
---

# Codebase.blog Auto-Posting (MCP + MCPorter)

This skill is **OAuth-first** and intended to be used via `mcporter` so non-developers can run blog auto-posting as plain commands.

## What This Skill Does

- Authenticate once via OAuth (browser)
- Call MCP tools like normal commands
- Publish posts with `create_post`
- Optional image upload via presigned URL (`get_image_upload_url` -> `curl PUT` -> `finalize_uploaded_image`)

## Trigger Phrases

- 자동포스팅
- 자동포스팅해
- 포스팅해줘
- 블로그 포스팅해줘
- 글 발행해줘
- create post
- publish post

## Routing Contract (Skill vs MCP Direct)

Use explicit user intent to choose one execution path. Do not mix both in one run.

### Route Selection

- `skill` route (via `mcporter`): if user says `codebase-skill`, `skill 사용`, `skill로`, `스킬로`, or uses style flags like `--podcast`, `--research`, `--pm`.
- `mcp` route (direct MCP tools): if user says `mcp로`, `MCP tool`, `codebase-blog-mcp`, `툴로 직접`.
- ambiguous phrase only (for example: `자동포스팅해`): default to `skill` route.
- user can always override by adding one explicit token: `skill로` or `mcp로`.

### Hard Safety Contract (OAuth-Only on Skill Route)

- If `skill` route is selected, never call direct MCP tools (`codebase-blog-mcp.*`, `mcp__codebase-blog-mcp__*`).
- Allowed aliases for `skill` route are OAuth-only:
  - `codebase-blog-oauth` (DEV)
  - `codebase-blog-oauth-prod` (PROD)
- If `codebase-blog-oauth` is offline/fails, one retry with `codebase-blog-oauth-prod` is allowed.
- If auth result is not `인증 방식 : OAuth 2.1`, stop immediately and do not post.

### Route Guard

Before `create_post`, always run `check_auth` and validate the expected auth mode:

- `skill` route expected output: `인증 방식 : OAuth 2.1`
- `mcp` route expected output: `인증 방식 : API Key`

If mismatch:

1. retry once on the correct route
2. if still mismatched, stop and report route mismatch (do not post)

### Preflight Log Line (required)

Print one route line before tool execution:

- skill route: `[Route] mode=skill transport=mcporter endpoint=/mcp-remote alias=codebase-blog-oauth`
- mcp route: `[Route] mode=mcp transport=direct endpoint=/mcp server=codebase-blog-mcp`

## Setup (Once)

```bash
# DEV (DEFAULT for this skill)
# - Safe default: prevents accidental production posting while testing.
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

## Verify (Always First)

> Important: `Authorization successful / You can return to the CLI.` is not just browser text. It is the callback that wakes the waiting `mcporter auth` process. Use `auth` to wait for login completion, then use `check_auth` only to validate the final auth mode.

### Stage A. Wait for OAuth login completion

Use `mcporter auth` as the callback-aware wait step.

```bash
npx -y mcporter --oauth-timeout 180000 auth codebase-blog-oauth
```

Behavior:

- If already logged in, this returns quickly.
- If login is required, it opens the browser and returns as soon as the callback is received.
- If no callback arrives before the timeout, stop and do not post.

### Stage B. Validate OAuth auth status

After `auth` returns, run `check_auth` as the final success gate.

```bash
AUTH_OUT=$(npx -y mcporter call codebase-blog-oauth.check_auth --output json 2>&1 || true)
echo "$AUTH_OUT"

if ! echo "$AUTH_OUT" | grep -q 'OAuth 2.1'; then
  echo "[STOP] OAuth mode verification failed. create_post not executed."
  exit 1
fi
```

## JSON Args Standard (Required)

Use `--args <json>` as the default publish path for this skill.

- Do not wrap long markdown inside a shell-quoted function-call string.
- For short scalar inputs, inline JSON is fine.
- For long markdown, build the JSON payload with Node and pass it via `--args`.

## Visible Staged Flow (Recommended)

When running auto-posting in terminal, make the workflow visible to the user with explicit step logs.

Recommended order:

1. print route line
2. print `[1/4] OAuth 로그인 완료 대기`
3. call `mcporter auth`
4. print `[2/4] OAuth 인증 상태 검증`
5. call `check_auth`
6. print `[3/4] 스타일 가이드 확인`
7. call `get_writing_style_guide`
8. print `[4/4] 포스트 발행`
9. call `create_post`

If the post body is already prewritten, you may still call `get_writing_style_guide` as a visible progress step so the user can see the workflow advancing. Do not silently skip all intermediate steps unless the user explicitly asked for the fastest possible path.

## Publish

```bash
POST_PAYLOAD=$(node - <<'NODE'
const fs = require('fs');

process.stdout.write(JSON.stringify({
  title: '자동포스팅 테스트',
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

## Writing Style Guide (Optional)

```bash
STYLE_ARGS='{"style":"default"}'
npx -y mcporter call codebase-blog-oauth.get_writing_style_guide --args "$STYLE_ARGS"
```

## Image Upload (Optional)

```bash
# 1) ask for presigned URL
npx -y mcporter call codebase-blog-oauth.get_image_upload_url --args '{"mimeType":"image/webp","fileSize":245760}'

# 2) upload with curl PUT (use uploadUrl from step 1)
curl -X PUT -H "Content-Type: image/webp" -T ./cover.webp "UPLOAD_URL_FROM_PREVIOUS_STEP"

# 3) finalize upload
npx -y mcporter call codebase-blog-oauth.finalize_uploaded_image --args '{"fileKey":"uploads/...","mimeType":"image/webp","fileSize":245760}'
```

## Troubleshooting

- If the login UI does not appear: you may already be logged in. Try a private window or `npx -y mcporter auth codebase-blog-oauth --reset`.
- If the browser shows `Authorization successful`: the callback has already reached the waiting `mcporter auth` process. The next step should run immediately after `auth` returns; do not start a separate manual polling loop.
- If you see `SSE error: Invalid content type, expected "text/event-stream"` during `mcporter auth`: tokens may still be saved. Run `check_auth` to confirm.
- If you see `EADDRINUSE ... 127.0.0.1:33334`: treat it as a local callback-port collision, not an auth failure. Retry once, then use `mcporter auth codebase-blog-oauth --reset` or reconfigure the callback port if needed.
- If port `33333` is in use: pick another fixed callback port and re-add the server.
- If your markdown contains quotes, backticks, or many newlines: stay on the `--args` path. Do not switch back to shell-quoted function-call syntax.
