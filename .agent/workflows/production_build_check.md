---
description: Simulate a production build and startup locally to verify deployment readiness.
---

# Production Build Verification

Run this before pushing to ensure the app builds and runs in production mode.

## 1. Clean Build
Remove old artifacts to ensure a fresh build.

```bash
# Frontend
cd frontend
rm -rf .next
pnpm build

# Backend
cd backend
rm -rf dist
pnpm build
```

## 2. Start Production Server
Run the optimized production server.

```bash
# Frontend (Terminal 1)
cd frontend
pnpm dev

# Backend (Terminal 2)
cd backend
pnpm start:dev
```

## 3. Verification
*   **Check**: Ensure no build errors occurred.
*   **Login**: Try to log in. This verifies the Auth flow and API connection in prod mode.
*   **Assets**: Check if images and static files load correctly (often broken in prod builds due to path issues).