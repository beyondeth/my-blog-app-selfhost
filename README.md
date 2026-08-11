# CODEBASE.BLOG

## Self-hosted quick start

The open-source deployment path runs the web app, API, PostgreSQL, Redis,
MinIO, and MCP proxy locally. Supabase and Cloudflare are optional.

```bash
cp .env.selfhost.example .env.selfhost
# Replace all `replace-with-*` values in .env.selfhost.
docker compose --env-file .env.selfhost up -d --build
docker compose --env-file .env.selfhost exec backend pnpm admin:create -- \
  --email admin@example.com \
  --password 'ReplaceWithStrongPassword123!' \
  --username admin
```

- Web: <http://localhost:3001>
- API: <http://localhost:3000>
- MCP: <http://localhost:3002/mcp>
- MinIO console: <http://localhost:9001>

See [docs/self-hosting.md](docs/self-hosting.md) for OAuth, storage, reverse
proxy, backup, and remote MCP setup.
