# Self-hosted deployment

This is the default deployment path for the open-source edition. It runs the
web app, API, PostgreSQL, Redis, MinIO, and the MCP proxy on a server owned by
the installer. Supabase and Cloudflare are not required.

## Quick start

```bash
cp .env.selfhost.example .env.selfhost
openssl rand -hex 32
# Put unique values into POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD,
# JWT_SECRET, SESSION_SECRET, and MCP_SHARED_SECRET in .env.selfhost.

docker compose --env-file .env.selfhost up -d --build
docker compose --env-file .env.selfhost ps
```

Open <http://localhost:3001>. The default local email mode prints signup and
password-reset codes in the backend logs:

```bash
docker compose --env-file .env.selfhost logs -f backend
```

Create the first administrator from the backend container after the stack is
healthy:

```bash
docker compose --env-file .env.selfhost exec backend pnpm admin:create -- \
  --email admin@example.com \
  --password 'ReplaceWithStrongPassword123!' \
  --username admin
```

The command also accepts `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
`ADMIN_USERNAME` as container environment variables.

For a reverse proxy on the same host, keep `PRIVATE_BIND_ADDRESS=127.0.0.1`
and set `PUBLIC_BIND_ADDRESS=0.0.0.0` only if the proxy cannot reach the
loopback-bound app ports. PostgreSQL, Redis, and the MinIO console remain on
the private bind address.

The core profile is intentionally capped for a small free/low-cost host. It
does not start monitoring by default. To enable the optional dashboards, add
your own value for `GRAFANA_ADMIN_PASSWORD` in `.env.selfhost` and run:

```bash
docker compose --env-file .env.selfhost --profile monitoring up -d
```

Grafana is available at <http://localhost:3030> and VictoriaMetrics at
<http://localhost:8428>. Keep both bound to localhost or place them behind an
authenticated reverse proxy.

## MCP connection

The local MCP endpoint is:

```text
http://localhost:3002/mcp
```

Create an MCP API key in the web application and configure the key in the MCP
client. OAuth clients use `http://localhost:3002/mcp-remote` and require the
MCP OAuth flow to complete in the same browser environment.

For a remote AI client, put the MCP proxy behind an HTTPS reverse proxy or a
secure tunnel and change `MCP_BASE_URL`, `NEXT_PUBLIC_MCP_BASE_URL`,
`BACKEND_PUBLIC_URL`, `FRONTEND_URL`, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SITE_URL`, and `S3_PUBLIC_ENDPOINT` to
public HTTPS URLs. Rebuild the frontend after changing `NEXT_PUBLIC_*` values.
Do not expose PostgreSQL, Redis, or the MinIO console publicly.

## Storage

MinIO is private by default. The backend uses `S3_INTERNAL_ENDPOINT` for
server-side access and signs browser uploads with `S3_PUBLIC_ENDPOINT`.
Images are rendered through the backend file proxy, so the bucket does not
need public-read permissions.

If the stack is placed behind a reverse proxy, route the public storage host
to MinIO port 9000 and add that origin to `deploy/minio/cors.json` before
recreating the `minio-init` service.

## Backups

Back up all three named volumes before upgrades:

- `postgres_data`: application data
- `redis_data`: queues, cache, and MCP OAuth state
- `minio_data`: uploaded files

Redis is not a substitute for a database backup. Expired cache and OAuth
state can be recreated, but pending BullMQ jobs and active MCP sessions are
lost if its volume is discarded.

## Optional services

Monitoring, Cloudflare CDN/R2, external SMTP, video processing, and a public
reverse proxy are optional. The application code for those integrations is
kept, but the self-hosted core does not require their credentials.
