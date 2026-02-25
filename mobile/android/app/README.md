# Android App Skeleton

This folder contains the initial Kotlin package skeleton for Phase 1.

## Package layout

- `com.myblog.android.app`: app entry points
- `com.myblog.android.core.di`: dependency injection boundaries
- `com.myblog.android.core.navigation`: route and navigation contracts
- `com.myblog.android.feature.*`: feature module boundaries

## Implementation order

1. Wire app entry and navigation shell.
2. Add core network and auth contracts.
3. Implement auth feature state and flows.
4. Implement feed feature state and pagination.
