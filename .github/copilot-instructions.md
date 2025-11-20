<!-- .github/copilot-instructions.md - Guidance for AI coding agents -->
# Quick Guide for AI Coding Agents

This project is a multi-service blog platform (Next.js frontend + NestJS backend). Keep guidance short, actionable, and anchored to files in the repo.

1. Big picture
- Frontend: `frontend/` — Next.js (App Router), port `3001` for local dev. See `frontend/package.json` (`dev`, `build`, `start`).
- Backend: `backend/` — NestJS app, port `3000` for local dev. See `backend/package.json` scripts (`start:dev`, `migration:*`, `test`).
- API prefix: backend sets `api/v1` globally in `backend/src/main.ts`. Avoid duplicating `/api/v1` in URLs.

2. Key files to reference (examples)
- Backend startup & global config: `backend/src/main.ts` (CORS, helmet, API prefix, health endpoint).
- Module wiring & global guards: `backend/src/app.module.ts` (JwtAuthGuard, RolesGuard, many feature modules).
- TypeORM migrations & CLI: `backend/src/data-source.ts` and `backend/package.json` migration scripts (`migration:generate`, `migration:run`, etc.).
- Frontend entrypoints & scripts: `frontend/package.json` and `src/app/*` for App Router pages.

3. Concrete developer workflows (copyable)
- Start frontend (dev):
```
cd frontend
pnpm dev     # serves on :3001
```
- Start backend (dev):
```
cd backend
pnpm start:dev   # serves on :3000
```
- Run backend migrations (dev):
```
cd backend
pnpm migration:generate <Name>
pnpm migration:run
```
- Run backend tests:
```
cd backend
pnpm test
pnpm test:e2e
```

4. Project-specific conventions and gotchas
- API requests: always use `process.env.NEXT_PUBLIC_API_URL` on frontend and DO NOT append another `/api/v1` (see `CLAUDE.md` example). Example fetch pattern enforced across the codebase:
```
fetch(`${process.env.NEXT_PUBLIC_API_URL}/endpoint`, { credentials: 'include' })
```
- Auth & cookies: frontend uses HttpOnly cookies; `credentials: 'include'` is required for JWT cookie flows.
- Frontend patterns: functional components + React Hooks only, state via React Query + Zustand, styling with Tailwind. Editor is Tiptap.
- Backend patterns: NestJS modules per feature, DTO + `class-validator` for inputs, DI everywhere, use Nest `Logger` not `console.log`.
- Logging: follow the project's logging policy (minimal console in prod, mask or avoid logging sensitive values). See `CLAUDE.md` for examples.

5. Integration points & external deps
- Database: PostgreSQL via TypeORM. Look at `backend/src/data-source.ts` for migration settings and SSL handling.
- Cache & queues: Redis (ioredis) and BullMQ configured in `AppModule`.
- Storage: AWS S3 SDK usage (`@aws-sdk/*`) in `files/` module.
- Auth providers: passport strategies (Google/GitHub/Kakao) under `backend/auth/`.

6. When editing code, follow these exact checks
- If touching API routes, confirm not to break `api/v1` prefix and update `backend/src/main.ts` exclude list if adding public endpoints.
- If adding entities or migrations, update entities path and use `pnpm migration:generate` in `backend/`.
- If changing CORS or cookie behavior, review `main.ts` CORS origin handling and `cookie` settings.

7. Examples to show in PRs or suggestions
- Point to the exact file and line: e.g. "Change fetch in `frontend/src/services/blog.ts` to use `credentials: 'include'` and base URL from `NEXT_PUBLIC_API_URL`."
- For DB changes: "Add entity in `backend/src/posts/post.entity.ts` and generate migration with `pnpm migration:generate AddPostEntity` from `backend/`." 

8. Safety and operational rules for AI agents
- Never execute or assume runtime commands inside the user's environment; only suggest commands to run locally (user runs them).
- Do not modify secrets or env files. Reference `.env` / `.env.local` usage but never write real secrets.

If anything is unclear or you want more examples (e.g., a sample migration, or a typical API controller), tell me which area to expand and I will update this file.
