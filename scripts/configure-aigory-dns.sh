#!/usr/bin/env bash
set -Eeuo pipefail

readonly TOKEN_FILE="${1:?Cloudflare token file is required}"
readonly ORIGIN_IP="${2:?Oracle origin IPv4 address is required}"
readonly ZONE_NAME="aigory.com"

if [[ ! -r "$TOKEN_FILE" ]]; then
  echo "Cloudflare token file is not readable: $TOKEN_FILE" >&2
  exit 2
fi

if [[ ! "$ORIGIN_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Origin must be an IPv4 address" >&2
  exit 3
fi

readonly API_TOKEN="$(
  sed -n \
    's/^[[:space:]]*dns_cloudflare_api_token[[:space:]]*=[[:space:]]*//p' \
    "$TOKEN_FILE" | head -n 1
)"

if [[ -z "$API_TOKEN" ]]; then
  echo "dns_cloudflare_api_token was not found in $TOKEN_FILE" >&2
  exit 4
fi

cloudflare() {
  curl --fail-with-body --silent --show-error \
    --header "Authorization: Bearer $API_TOKEN" \
    --header "Content-Type: application/json" \
    "$@"
}

readonly ZONE_RESPONSE="$(
  cloudflare \
    "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME&status=active"
)"
readonly ZONE_ID="$(
  jq -er \
    '.result | if length == 1 then .[0].id else error("expected one active zone") end' \
    <<<"$ZONE_RESPONSE"
)"

for record_name in \
  aigory.com \
  www.aigory.com \
  mcp.aigory.com \
  cdn.aigory.com; do
  RECORD_RESPONSE="$(
    cloudflare \
      "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=A&name=$record_name"
  )"
  RECORD_COUNT="$(jq -er '.result | length' <<<"$RECORD_RESPONSE")"
  PAYLOAD="$(
    jq -nc \
      --arg name "$record_name" \
      --arg content "$ORIGIN_IP" \
      '{type:"A", name:$name, content:$content, ttl:1, proxied:true}'
  )"

  case "$RECORD_COUNT" in
    0)
      UPDATE_RESPONSE="$(
        cloudflare \
          --request POST \
          --data "$PAYLOAD" \
          "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records"
      )"
      action="created"
      ;;
    1)
      RECORD_ID="$(jq -er '.result[0].id' <<<"$RECORD_RESPONSE")"
      UPDATE_RESPONSE="$(
        cloudflare \
          --request PUT \
          --data "$PAYLOAD" \
          "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID"
      )"
      action="updated"
      ;;
    *)
      echo "Expected at most one A record for $record_name" >&2
      exit 5
      ;;
  esac

  jq -e '.success == true' <<<"$UPDATE_RESPONSE" >/dev/null
  printf '%s: %s -> %s (proxied)\n' "$record_name" "$action" "$ORIGIN_IP"
done
