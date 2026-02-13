# OpenAPI (Mobile)

This directory stores the mobile-facing API contract snapshots.

## Conventions

- Prefer a single source of truth in backend-generated OpenAPI.
- Track mobile-specific assumptions in `mobile/contracts/api/mobile`.
- Keep changes with semantic versioning notes in `api/history`.

Recommended files:
- `mobile-openapi.yaml` (generated or curated)
- `mobile-openapi.json` (flattened for tooling)
