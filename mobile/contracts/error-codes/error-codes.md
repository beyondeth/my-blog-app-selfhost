# Mobile Error Code Guide

## Standard structure

- `code`: application-specific error label
- `message`: human-readable detail
- `target`: optional field to map UI state

## Common codes

- `AUTH_REQUIRED`: user needs login
- `TOKEN_EXPIRED`: token expired
- `NETWORK_UNAVAILABLE`: network failure
- `RATE_LIMITED`: too many requests
- `RESOURCE_NOT_FOUND`: missing resource
- `OAUTH_CODE_INVALID`: malformed or unknown one-time OAuth code
- `OAUTH_CODE_EXPIRED`: one-time OAuth code expired
- `OAUTH_CODE_USED`: one-time OAuth code already consumed
- `OAUTH_CODE_BIND_MISMATCH`: redirect URI/provider mismatch during OAuth exchange
- `OAUTH_STATE_INVALID`: invalid or tampered OAuth state signature

## Mapping rule

Map error codes to localized UI copy via a single shared resolver table in `mobile/ios`.
