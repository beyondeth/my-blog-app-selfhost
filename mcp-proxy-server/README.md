# MCP Proxy Server (Codebase.blog)

Production MCP gateway for Codebase.blog auto-posting.

This server supports two explicit routes:
- `POST /mcp`: direct MCP with API key bearer auth
- `POST /mcp-remote`: remote MCP with OAuth 2.1 bearer auth

## Overview

`mcp-proxy-server` bridges MCP clients and the backend blog API.
It keeps route semantics explicit so operators can separate:
- skill route (`mcporter` -> `/mcp-remote` -> OAuth)
- direct route (MCP client -> `/mcp` -> API key)

## Current Architecture

```text
MCP Client
  |- direct route: /mcp (Bearer blog_sk_...)
  |- skill route:  /mcp-remote (Bearer OAuth token)
        |
        v
mcp-proxy-server (Express + MCP SDK Streamable HTTP)
  |- tool execution (check_auth, create_post, ...)
  |- OAuth metadata + auth server endpoints
  |- Redis cache (API key validation)
  |- Redis core (OAuth token/session data)
        |
        v
backend API (/api/v1/mcp/*, /api/v1/users/:id/mcp-info)
```

## Tool Catalog (5)

The proxy exposes the same 5 tools on both routes:
- `check_auth`
- `get_writing_style_guide`
- `create_post`
- `get_image_upload_url`
- `finalize_uploaded_image`

Source of truth:
- `src/tools/catalog.ts`
- `src/tools/index.ts`

## Auth Modes

- API Key route (`/mcp`)
  - Expects `Authorization: Bearer blog_sk_...`
  - Validates key via backend and caches result in Redis cache
- OAuth route (`/mcp-remote`)
  - Expects OAuth bearer token
  - Verifies token/resource via OAuth storage and metadata contract

`check_auth` reflects the active mode:
- skill route expected: `OAuth 2.1`
- direct route expected: `API Key`

## HTTP Endpoints

### MCP endpoints
- `GET /mcp` discovery (API key route)
- `POST /mcp` JSON-RPC request handling (API key route)
- `DELETE /mcp` session close no-op (stateless compatibility)
- `GET /mcp-remote` discovery (OAuth route)
- `POST /mcp-remote` JSON-RPC request handling (OAuth route)
- `DELETE /mcp-remote` session close

### OAuth metadata + authorization server
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register`
- `GET /oauth/register/:client_id`
- `DELETE /oauth/register/:client_id`
- `GET /oauth/authorize`
- `GET /oauth/callback`
- `POST /oauth/token`
- `POST /oauth/revoke`
- `GET /oauth/stats`

### Operational endpoints
- `GET /health`
- `GET /metrics`
- `GET /metrics/stats`

## Environment Variables

Validated in `src/config/env.validation.ts`.

Required:
- `BACKEND_BASE_URL`
- `BACKEND_API_URL`
- `BACKEND_PUBLIC_URL`

Important:
- `FRONTEND_URL` (used for public URL composition in tool responses)
- `MCP_BASE_URL` (OAuth metadata/resource base)
- `MCP_PROXY_PORT` (default: `3002`)
- `CORS_ORIGINS`
- `REDIS_CORE_HOST`, `REDIS_CORE_PORT`
- `REDIS_CACHE_HOST`, `REDIS_CACHE_PORT`
- `REDIS_PASSWORD` (optional)
- `API_KEY_CACHE_TTL` (default: `300`)
- `MCP_SHARED_SECRET` (recommended)

## Local Development

```bash
pnpm install
pnpm dev
```

Default local assumptions:
- backend: `http://localhost:3000`
- frontend: `http://localhost:3001`
- proxy: `http://localhost:3002`

## Client Configuration Examples

### Direct MCP (API key)

```json
{
  "mcpServers": {
    "codebase-blog-mcp": {
      "type": "http",
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer blog_sk_xxx"
      }
    }
  }
}
```

### Skill route with MCPorter (OAuth)

```bash
npx -y mcporter config add codebase-blog-oauth \
  --url https://mcp.codebase.blog/mcp-remote \
  --auth oauth \
  --oauth-redirect-url http://127.0.0.1:33333/callback \
  --scope home

npx -y mcporter auth codebase-blog-oauth
npx -y mcporter call codebase-blog-oauth.check_auth
```

## Route Guard Policy (Recommended)

Before `create_post`:
1. run `check_auth`
2. verify auth mode matches intended route
3. stop if mismatched

This prevents accidental posting on the wrong route.

## Troubleshooting

- Port conflict (`EADDRINUSE`)
  - stop previous process using the same port
- OAuth token rejected on `/mcp-remote`
  - verify `MCP_BASE_URL` and token resource audience
- `check_auth` shows unexpected mode
  - you are likely hitting the wrong endpoint (`/mcp` vs `/mcp-remote`)
- Post URL points to wrong host
  - verify `FRONTEND_URL`

## Notes

- This server intentionally supports both routes; do not mix them in one posting run.
- For skill route operation standards, see:
  - `docs/skills/codebase-skill/SKILL.md`
  - `docs/skills/codebase-skill/MCPORTER_SKILL.md`
