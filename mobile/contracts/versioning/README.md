# Versioning Policy

## Semver for contract changes

- MAJOR: backward incompatible endpoint or schema change.
- MINOR: additive fields/endpoints.
- PATCH: non-breaking bugfix in schema examples and docs.

## Deprecation policy

- Stage 1: mark deprecated in docs and emit warning response header.
- Stage 2: keep compatibility for one minor version.
- Stage 3: remove and provide migration notice.
