---
description: Start the development environment including Frontend (Port 3001) and Backend (Port 3000)
---

# Setup & Start Environment

> [!IMPORTANT]
> **NEVER** use a single command to start both servers. You must maintain separate terminals for proper monitoring and control.

## 1. Prerequisites
Ensure you have the following installed:
- Node.js (v20+)
- pnpm (v9+)
- Docker & Docker Compose

## 2. Start Infrastructure (Docker)
Start the database (PostgreSQL), Redis, and other services.

```bash
docker compose -f docker-compose.dev.yml up -d
```

## 3. Start Backend (NestJS)
Open a new terminal.

```bash
cd backend
pnpm start:dev
```
*   **Port**: `3000`
*   **Verify**: visit `http://localhost:3000/api` (or health check)

## 4. Start Frontend (Next.js)
Open a separate terminal.

```bash
cd frontend
pnpm dev
```
*   **Port**: `3001`
*   **Verify**: visit `http://localhost:3001`

## 5. Troubleshooting
*   **EADDRINUSE**: If ports are blocked, find the PID: `lsof -i :3000` or `lsof -i :3001` and kill it.
*   **Database Config**: Ensure `.env` in backend matches `docker-compose.dev.yml`.
