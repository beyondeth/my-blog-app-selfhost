---
description: Run the full testing suite for Frontend and Backend.
---

# Testing Workflow

Ensure strict quality control before merging or deploying.

## 1. Backend Testing
### Unit Tests
Fast tests for logic in Services and Helpers.
```bash
cd backend
pnpm test
```

### Coverage
Check for regression in critical paths.
```bash
pnpm test:cov
```
*   **Target**: 80%+ coverage on Auth, Billing, and Core Logic.

### E2E Tests
Tests the full request lifecycle. Requires Docker environment.
```bash
pnpm test:e2e
```

## 2. Frontend Validation
### Type Safety
Ensure no TypeScript errors.
```bash
cd frontend
pnpm type-check
```

### Linting
Catch code style and React Hook issues.
```bash
pnpm lint
```

## 3. Manual Verification
*   **UI Check**: Verify responsive design on mobile/desktop breakpoints.
*   **Flow Check**: Walk through the "Happy Path" of the feature manually.
