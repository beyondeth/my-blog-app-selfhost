#!/usr/bin/env bash
set -Eeuo pipefail

readonly RELEASE_DIR="${1:?release directory is required}"
readonly RELEASE_SHA="${2:?release SHA is required}"
readonly ENV_FILE="/etc/aigory-blog/.env.production"
readonly BASE_COMPOSE="docker-compose.prod.oracle.yml"
readonly SMALL_COMPOSE="docker-compose.prod.oracle-small.yml"

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release SHA must be a full 40-character commit SHA" >&2
  exit 2
fi

if [[ "$RELEASE_DIR" != "/opt/aigory-blog/releases/$RELEASE_SHA" ]]; then
  echo "Unexpected release directory: $RELEASE_DIR" >&2
  exit 3
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment: $ENV_FILE" >&2
  exit 4
fi

cd "$RELEASE_DIR"
umask 077
ln -sfn "$ENV_FILE" .env.production

compose=(
  docker compose
  --project-name aigory-blog-prod
  --env-file "$ENV_FILE"
  -f "$BASE_COMPOSE"
  -f "$SMALL_COMPOSE"
)

"${compose[@]}" config --quiet

sudo install -d -o ubuntu -g ubuntu -m 750 \
  /mnt/data/aigory-blog/postgres \
  /mnt/data/aigory-blog/redis \
  /mnt/data/aigory-blog/backups \
  /mnt/data/aigory-blog/victoriametrics \
  /mnt/data/aigory-blog/grafana

# Official images drop privileges to fixed users. The host directories are
# created by the deploy user, so grant only the matching service accounts
# access before the first container start.
sudo chown 70:70 /mnt/data/aigory-blog/postgres
sudo chown 999:1000 /mnt/data/aigory-blog/redis
sudo chown -R 472:0 /mnt/data/aigory-blog/grafana

export DOCKER_BUILDKIT=1
"${compose[@]}" build backend
"${compose[@]}" build frontend
"${compose[@]}" build mcp-proxy

"${compose[@]}" run --rm --no-deps backend \
  node dist/src/commands/verify-production-integrations.command.js

"${compose[@]}" up -d postgres redis
# Postgres may be recreated when its release-mounted configuration changes.
# Recreate PgBouncer as well so it does not retain a stale Docker-DNS failure
# for the replaced database container.
"${compose[@]}" up -d --force-recreate pgbouncer

# The native Nginx reverse proxy reaches the published backend port through
# Docker's bridge gateway. Add the gateway to Express's explicit proxy trust
# list so secure session cookies are emitted for HTTPS requests. The value is
# discovered after the network is created and is only exported to Compose; the
# protected environment file remains unchanged.
proxy_gateway="$(
  docker network inspect "${COMPOSE_PROJECT_NAME:-aigory-blog-prod}-network" \
    --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || true
)"
if [[ -n "$proxy_gateway" ]]; then
  configured_trust_proxy_cidrs="$(
    awk -F= '$1 == "TRUST_PROXY_CIDRS" { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
  )"
  if [[ "$proxy_gateway" == *:* ]]; then
    proxy_gateway_cidr="$proxy_gateway/128"
  else
    proxy_gateway_cidr="$proxy_gateway/32"
  fi
  if [[ -n "$configured_trust_proxy_cidrs" ]]; then
    export TRUST_PROXY_CIDRS="$configured_trust_proxy_cidrs,$proxy_gateway_cidr"
  else
    export TRUST_PROXY_CIDRS="$proxy_gateway_cidr"
  fi
fi

for attempt in {1..10}; do
  if "${compose[@]}" run --rm --no-deps backend pnpm migration:run:prod:nobuild; then
    break
  fi
  if [[ "$attempt" == 10 ]]; then
    "${compose[@]}" logs --tail=200 pgbouncer
    exit 7
  fi
  sleep 3
done

if [[ "${INITIAL_CUTOVER:-false}" == "true" ]]; then
  CONFIRM_DELETE_MATERIAL_DATA=DELETE_AIGORY_MATERIAL_DATA \
    bash scripts/remove-material-ledger.sh --execute
fi

"${compose[@]}" up -d backend
for attempt in {1..60}; do
  if curl --fail --silent http://127.0.0.1:3000/ready >/dev/null; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    "${compose[@]}" logs --tail=200 backend
    exit 5
  fi
  sleep 2
done

"${compose[@]}" up -d frontend mcp-proxy victoriametrics grafana redis-exporter

for endpoint in \
  http://127.0.0.1:3001/ \
  http://127.0.0.1:3002/health; do
  for attempt in {1..45}; do
    if curl --fail --silent "$endpoint" >/dev/null; then
      break
    fi
    if [[ "$attempt" == 45 ]]; then
      "${compose[@]}" ps
      exit 6
    fi
    sleep 2
  done
done

sudo install -m 644 deploy/nginx/aigory.conf /etc/nginx/sites-available/aigory-blog.conf
if [[ -e /etc/nginx/sites-enabled/aigory.conf || -L /etc/nginx/sites-enabled/aigory.conf ]]; then
  sudo mv /etc/nginx/sites-enabled/aigory.conf /etc/nginx/sites-available/aigory.material.disabled
fi
sudo ln -sfn /etc/nginx/sites-available/aigory-blog.conf /etc/nginx/sites-enabled/aigory-blog.conf
sudo nginx -t
sudo systemctl reload nginx

sudo ln -sfn "$RELEASE_DIR" /opt/aigory-blog/app

sudo install -m 644 deploy/systemd/aigory-blog-backup.service /etc/systemd/system/aigory-blog-backup.service
sudo install -m 644 deploy/systemd/aigory-blog-backup.timer /etc/systemd/system/aigory-blog-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now aigory-blog-backup.timer
sudo systemctl start aigory-blog-backup.service

"${compose[@]}" ps
curl --fail --silent http://127.0.0.1:3000/ready >/dev/null
curl --fail --silent http://127.0.0.1:3001/ >/dev/null
curl --fail --silent http://127.0.0.1:3002/health >/dev/null

echo "Aigory release $RELEASE_SHA deployed successfully"
