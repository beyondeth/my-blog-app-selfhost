# Aigory MCP proxy

This package exposes the blog automation tools over Model Context Protocol
(MCP). In the supported self-hosted layout it runs as the `mcp-proxy` service
next to the NestJS backend and Redis. It validates a blog-scoped API key or an
OAuth 2.1 session before forwarding a tool call to the backend.

## Endpoints

- `POST /mcp` — stateless Bearer API-key authentication.
- `POST /mcp-remote` — OAuth 2.1/PKCE authentication for clients that support
  the discovery metadata flow.
- `GET /health` — minimal service liveness response (no dependency details).
- `GET /metrics` — Prometheus-compatible metrics; loopback/private peers only
  by default, or require `METRICS_AUTH_TOKEN` when exposed beyond the private
  network.
- `/.well-known/*` and `/oauth/*` — OAuth metadata and authorization routes.

Do not expose Redis or the backend's internal network directly. In production,
put the MCP endpoint behind HTTPS and set a strong `MCP_SHARED_SECRET` shared
only with the backend.

## Tools

The catalog is intentionally shared by API-key and OAuth paths:

1. `check_auth`
2. `get_writing_style_guide`
3. `create_post`
4. `get_image_upload_url`
5. `finalize_uploaded_image`

The normal workflow is `check_auth` → style guide → optional two-step image
upload → `create_post`. If an image upload fails, the client should stop
retrying and continue with a text-only post. `create_post` requires a title,
Markdown content, and exactly one category; tags are optional. The image flow
accepts WebP and passes the signed `tempId`, object metadata, and returned
`fileId` through to `attachedFileIds`/`thumbnailImageId`.

## Configuration

The root Compose profile supplies container-internal URLs. For a standalone
process, copy the example and set at least:

```dotenv
MCP_PROXY_PORT=3002
NODE_ENV=development
BACKEND_BASE_URL=http://localhost:3000
BACKEND_API_URL=http://localhost:3000/api/v1
BACKEND_PUBLIC_URL=http://localhost:3000
PUBLIC_SITE_URL=http://localhost:3001
MCP_BASE_URL=http://localhost:3002
REDIS_HOST=localhost
REDIS_PORT=6379
MCP_SHARED_SECRET=replace-with-at-least-16-characters
# Set a unique value when exposing metrics outside the private network.
# METRICS_AUTH_TOKEN=generate-with-openssl-rand-hex-32
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
```

Use exact HTTPS origins in production; wildcard CORS values are rejected there.
Never commit `.env`, API keys, OAuth tokens, or tunnel credentials.

## Development

From this directory:

```bash
pnpm install
pnpm build
pnpm test:oauth
pnpm verify:tool-parity
pnpm dev
```

`verify:tool-parity` checks that `/mcp`, `/mcp-remote`, the catalog, and the
repository's Aigory skill documents expose the same tool names and order.
Set `MCP_VERIFY_HTTP=1` to include live endpoint checks against
`MCP_VERIFY_BASE_URL` (default `http://localhost:3002`).

For the supported Docker workflow, start at the root
[`README.md`](../README.md), [`docs/self-hosting.md`](../docs/self-hosting.md),
and [`docs/automatic-posting.md`](../docs/automatic-posting.md).
