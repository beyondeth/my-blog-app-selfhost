# Mobile Workspace

This workspace hosts mobile product development as a mobile-first extension of the existing web/backend repository.

## Structure

- `mobile/contracts`: Shared API contracts and documentation used by all mobile platforms.
- `mobile/ios`: iOS app implementation scaffolding and SDD artifacts.
- `mobile/android`: Android placeholder for future implementation.

## Design goals

1. Keep mobile artifacts decoupled from `backend` and `frontend` source code.
2. Maintain a contract-first flow through `mobile/contracts` for easy split.
3. Keep iOS workstream runnable and reviewable without Android dependencies.
4. Keep documentation close to implementation and operationally actionable.

## Quick start for mobile developers

- iOS: `cd mobile/ios`
- Run SDD: `sdd --version` (after installing)
- Start SDD bootstrap: `sdd init --skip-git-setup --auto-approve`
- Validate docs: `sdd validate --strict`
- Sync policy: `sdd sync --ci --threshold 80`
