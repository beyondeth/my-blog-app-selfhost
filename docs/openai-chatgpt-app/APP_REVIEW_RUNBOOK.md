# Codebase.blog ChatGPT App Review Runbook

> Last updated: 2026-03-08
> Scope: `/mcp-openai` submission and pre-review verification

## Purpose

This runbook is the final pre-submission checklist for the ChatGPT App surface.
It converts the current implementation into a repeatable approval workflow.

## Official References

- Apps SDK auth: https://developers.openai.com/apps-sdk/build/auth
- Apps SDK ChatGPT UI: https://developers.openai.com/apps-sdk/build/chatgpt-ui
- Apps SDK metadata guidance: https://developers.openai.com/apps-sdk/guides/optimize-metadata
- ChatGPT developer mode: https://developers.openai.com/api/docs/guides/developer-mode
- Apps in ChatGPT overview: https://openai.com/index/introducing-apps-in-chatgpt/

## Current Implementation Summary

- MCP endpoint: `/mcp-openai`
- Transport: Streamable HTTP GET/POST
- Auth: OAuth 2.1 + PKCE (`S256`)
- Advertised scopes:
  - `mcp:tools`
  - `mcp:read`
  - `mcp:write`
- OpenAI tools:
  - `check_auth`
  - `list_my_published_posts`
  - `search_my_published_posts`
  - `read_my_published_post`
  - `get_writing_style_guide`
  - `create_post`
- Widget-bearing tools only:
  - `check_auth`
  - `get_writing_style_guide`
  - `create_post`
- Data-only tools:
  - `list_my_published_posts`
  - `search_my_published_posts`
  - `read_my_published_post`

## Changes Applied For Review Safety

- Added OpenAI review callback allowlist:
  - `https://platform.openai.com/apps-manage/oauth`
- Restricted ChatGPT redirect pattern to connector callback shape.
- Removed dynamic client registration behavior that re-exposed an existing `client_secret`.
- Limited widget metadata to tools that actually need inline UI.
- Aligned privacy/terms page branding to `Codebase.blog`.

## Go / No-Go Criteria

Submission is blocked if any of the following is true:

- OAuth redirect fails for either:
  - `https://chatgpt.com/connector/oauth/{callback_id}`
  - `https://platform.openai.com/apps-manage/oauth`
- `check_auth` fails in ChatGPT developer mode
- Read tools show widget UI
- `create_post` does not require confirmation
- Privacy Policy or Terms page shows stale brand naming
- `mcp:read` or `mcp:write` scope is not enforced correctly

## Manual Verification Checklist

### 1. OAuth Metadata

Open these URLs and verify 200 responses:

- `https://mcp.codebase.blog/.well-known/oauth-protected-resource`
- `https://mcp.codebase.blog/.well-known/oauth-authorization-server`
- `https://mcp.codebase.blog/mcp-openai/.well-known/oauth-authorization-server`

Check:

- `authorization_endpoint`, `token_endpoint`, `registration_endpoint` exist
- `grant_types_supported` includes:
  - `authorization_code`
  - `refresh_token`
- `code_challenge_methods_supported` includes `S256`
- `scopes_supported` includes:
  - `mcp:tools`
  - `mcp:read`
  - `mcp:write`
- `op_policy_uri` = `https://codebase.blog/privacy`
- `op_tos_uri` = `https://codebase.blog/terms`

### 2. Dynamic Client Registration

Use the actual OpenAI registration flow if possible.

If testing manually, ensure registration accepts:

- `https://chatgpt.com/connector/oauth/{callback_id}`
- `https://platform.openai.com/apps-manage/oauth`

Reject submission if:

- registration fails for the review callback
- an already-registered redirect returns a previously issued `client_secret`

### 3. Login / Consent UX

From ChatGPT developer mode:

1. Add the app
2. Start OAuth
3. Confirm login page loads
4. Confirm requested scopes are shown as human-readable permissions
5. Complete consent

Expected permission copy:

- `mcp:tools` → tool connection / writing guide access
- `mcp:read` → read my published posts
- `mcp:write` → create posts and upload images

### 4. Tool Surface

In ChatGPT, verify `tools/list` exposes exactly:

- `check_auth`
- `list_my_published_posts`
- `search_my_published_posts`
- `read_my_published_post`
- `get_writing_style_guide`
- `create_post`

Reject submission if:

- hidden tools appear unexpectedly
- legacy/deleted writing styles appear

### 5. Widget Scope

Verify widget/iframe appears only for:

- `check_auth`
- `get_writing_style_guide`
- `create_post`

Verify widget does **not** appear for:

- `list_my_published_posts`
- `search_my_published_posts`
- `read_my_published_post`

### 6. Read/Write Behavior

Verify:

- `list_my_published_posts` returns only my published posts
- `search_my_published_posts` respects the authenticated user boundary
- `read_my_published_post` cannot read another user's post by guessed ID
- `create_post` shows confirmation before write

### 7. Scope Enforcement

Test at least these cases:

- token with `mcp:tools` only:
  - `check_auth` allowed
  - `get_writing_style_guide` allowed
  - read/write tools blocked
- token with `mcp:tools mcp:read`:
  - read tools allowed
  - `create_post` blocked
- token with `mcp:tools mcp:write`:
  - `create_post` allowed
  - read tools blocked

Expected failure mode:

- `insufficient_scope`
- clear required vs granted scope info

### 8. Legal Surface

Open:

- `https://codebase.blog/privacy`
- `https://codebase.blog/terms`

Check:

- brand says `Codebase.blog`
- content is publicly accessible without login
- no broken markdown or missing document errors

## Evidence To Capture Before Submission

Capture screenshots or logs for:

- OAuth connection start page
- login / consent page with scope descriptions
- successful `check_auth`
- successful read tool call
- blocked write or blocked read with insufficient scope
- `create_post` confirmation dialog
- privacy page
- terms page

## Recommended Dry Run

Before pressing submit:

1. Enable ChatGPT developer mode
2. Add the production app endpoint
3. Complete one fresh OAuth connection
4. Run:
   - `check_auth`
   - `list_my_published_posts`
   - `read_my_published_post`
   - `get_writing_style_guide`
5. Trigger one `create_post` confirmation flow
6. Revoke access from Connected Apps
7. Reconnect once to confirm the flow still works cleanly

## Residual Risks

- Live review callback behavior still needs real OpenAI submission-path verification.
- If OpenAI changes exact callback host/path requirements, allowlist may need one more update.
- Widget UX policy may evolve; keep data tools and render tools separated going forward.

## Submission Decision

Approve submission only when:

- all manual checks pass
- no stale branding remains
- no secret re-exposure is observed
- read tools are data-only
- write confirmation is present
- OAuth review callback succeeds
