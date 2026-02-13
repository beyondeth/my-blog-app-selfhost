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

## Mapping rule

Map error codes to localized UI copy via a single shared resolver table in `mobile/ios`.
