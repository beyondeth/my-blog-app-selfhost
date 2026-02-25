# Mobile Contracts

Cross-platform contract registry for iOS and Android.

## Objectives

- Define API endpoints used by native apps.
- Keep navigation and UX conventions consistent where appropriate.
- Track error codes and versioning for backward compatibility.

## Layout

- `api/openapi`: OpenAPI source and generated snapshots.
- `api/mobile`: Mobile-specific endpoint definitions and behavior notes.
- `api/history`: Versioned API change logs.
- `navigation`: Navigation model references for iOS and Android.
- `error-codes`: Canonical error model and code usage guide.
- `versioning`: API lifecycle, deprecation, and migration policy.

## Split-ready rule

Keep this folder dependency-only for mobile apps. No platform-specific implementation details should live here.
