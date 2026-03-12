#!/bin/sh

set -eu

GRAFANA_USER="${GF_SECURITY_ADMIN_USER:-admin}"
GRAFANA_PASSWORD="${GF_SECURITY_ADMIN_PASSWORD:-}"

/run.sh &
grafana_pid=$!

shutdown() {
  if kill -0 "$grafana_pid" 2>/dev/null; then
    kill "$grafana_pid" 2>/dev/null || true
    wait "$grafana_pid" 2>/dev/null || true
  fi
}

trap shutdown INT TERM

if [ -n "$GRAFANA_PASSWORD" ]; then
  reload_alerting() {
    auth_header=$(printf '%s' "${GRAFANA_USER}:${GRAFANA_PASSWORD}" | base64 | tr -d '\n')
    wget \
      --quiet \
      --tries=1 \
      --post-data='' \
      --header="Authorization: Basic ${auth_header}" \
      -O- \
      "http://127.0.0.1:3000/api/admin/provisioning/alerting/reload" >/tmp/grafana-alerting-reload.log 2>&1
  }

  for _ in $(seq 1 60); do
    if wget --quiet --tries=1 --spider "http://127.0.0.1:3000/api/health"; then
      grafana cli admin reset-admin-password "$GRAFANA_PASSWORD" >/tmp/grafana-admin-reset.log 2>&1 || true
      if reload_alerting; then
        # Grafana can finish warming alert state shortly after /api/health succeeds.
        # A second delayed reload clears stale scheduler state that survives the first pass.
        (
          sleep 15
          reload_alerting || true
        ) &
        break
      fi
    fi
    sleep 1
  done
fi

wait "$grafana_pid"
