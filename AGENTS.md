# Repository Guidelines

## Project Structure & Module Organization
`frontend/` hosts the Next.js 16 app router, with routed pages in `frontend/src/app`, shared UI primitives in `frontend/src/components`, hooks and Zustand stores in `frontend/src/hooks` and `frontend/src/stores`, and HTTP helpers in `frontend/src/services`. `backend/` contains the NestJS monolith, where modules live under `backend/src/*`, shared logic sits in `backend/src/common`, migrations in `backend/src/migrations`, and operational scripts in `backend/scripts`; supporting docs and observability configs live in `docs/`, `monitoring/`, `grafana/`, and `victoriametrics/`.

## Build, Test, and Development Commands
Install dependencies per package via `pnpm --dir frontend install` and `pnpm --dir backend install`. Run the apps locally with `pnpm --dir frontend dev` (port 3001) and `pnpm --dir backend start:dev`, produce production bundles using each package’s `build` plus `start:prod` scripts, and use `docker compose -f docker-compose.dev.yml up --build` to launch Postgres, Redis, metrics, and both services together.

## Coding Style & Naming Conventions
Code is written in strict TypeScript with ESLint and Prettier enforcing the style; run the lint scripts for both packages before committing. Keep Nest modules, controllers, and services in PascalCase (`PostsModule`, `AuthService`), colocate DTOs/interfaces with their module, keep shared guards in `backend/src/common`, and mirror PascalCase for React components/hooks/stores while leaving helpers camelCase (`formatDate.ts`); Tailwind tokens live in `frontend/components.json` and `frontend/tailwind.config.js`.

## Testing Guidelines
Backend unit specs are colocated as `*.spec.ts`; execute `pnpm --dir backend test` frequently and `pnpm --dir backend test:cov` to keep ≥80% coverage across auth, billing, and file flows. E2E suites under `backend/test` require the docker compose stack (`pnpm --dir backend test:e2e`), while the frontend currently relies on `pnpm --dir frontend type-check` and `pnpm --dir frontend lint` plus optional React Testing Library suites in `frontend/src/__tests__`.

## Commit & Pull Request Guidelines
Follow the Conventional Commit vocabulary already in the log (`feat(backend): …`, `fix(frontend): …`, `chore(monitoring): …`) with scopes that map to top-level folders or Nest modules. PRs must summarize the change, link tracking issues, list automated/manual tests, include screenshots or GIFs for UI updates, and document manual steps such as `pnpm --dir backend migration:run`.

## Environment & Security Tips
Copy `.env.production.example` into `.env.local` for each app, keep secrets out of Git, and record new configuration needs inside `ENV_SETUP.md` or `docs/`. Apply schema changes only through the TypeORM scripts (`pnpm --dir backend migration:run` / `migration:revert`) and sanitize any artifacts synced into `data/` or `postgres/` before sharing.

## Multi-Platform Workflow (Worktree + Branch Discipline)
This file intentionally keeps only enforceable core rules.
Detailed procedures and update history live in `docs/platform-coordination/`.

### Core Rules (Enforced)
- MUST: shared paths (`backend/**`, `mobile/contracts/**`, shared coordination docs) are edited only in `my-blog-app-integ` on `integration/workspace`.
- NEVER: patch shared paths from `my-blog-app-ios`, `my-blog-app-aos`, or `my-blog-app-web`.
- MUST: runtime services (`backend:3000`, `frontend:3001`, `mcp-proxy-server`) start from `my-blog-app-integ`.
- MUST: merge order is `platform branch -> integration/workspace -> main`.
- MUST: before starting implementation, check divergence between active platform branch and `integration/workspace` with `git rev-list --left-right --count <active_branch>...integration/workspace`.
- MUST: if divergence exists on either side, report the exact counts to the user immediately and confirm sync strategy before continuing.
- NEVER: do feature work in root `/Users/sihyungpark/Desktop/code/my-blog-app` (checkpoint/metadata only).

### PLATFORM-TRACK (Required)
```md
[PLATFORM-TRACK]
타겟: web | ios | android | multi
작업유형: feature | bugfix | refactor | runbook
공유영향 확인: YES/NO
요약: 필수 확인 내용 등
```

### Situation -> Open This Doc
- Worktree ownership/rules/conflict recovery:
  - `docs/platform-coordination/worktree-branch-playbook.md`
- Current worktree snapshot (path/branch/clean-dirty):
  - `docs/platform-coordination/WORKTREE_STATUS.md`
- Pre-release checks before `integration/workspace -> main`:
  - `docs/platform-coordination/RELEASE_GATE.md`
- PR routing/approval/automation boundary:
  - `docs/platform-coordination/PR_REVIEW_POLICY.md`
- Codex config/rules/skills/MCP standard:
  - `docs/platform-coordination/CODEX_CONFIGURATION.md`
- Multi-agent usage policy and safe patterns:
  - `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`
- Document index and update history:
  - `docs/platform-coordination/README.md`
  - `docs/platform-coordination/CHANGELOG.md`

## Design Guidelines
Design decisions related to layout, typography, color, and contrast must follow WCAG 3.0 accessibility standards, ensuring consistent readability and usability across the product.

### Contrast & Color Use
Maintain a minimum 4.5:1 contrast ratio between text (including logo text) and background; bold text ≥14pt may use 3:1.
Validate contrast using tools such as Contrast Checker, Stark, or Color.review.
Choose brand and UI colors with sufficient luminance separation; avoid low-contrast palettes.
Do not rely on color alone to convey meaning. Provide shape, icon, or text-based reinforcement.

### Typography & Readability
Body text must be ≥16px; UI text ≥14px.
Use accessible Sans-serif families (Pretendard, Inter, SF Pro, or similar).
Preferred font weights: 400–600; avoid overly thin weights.
Apply letter-spacing increases of 1–2% and line-height 1.4–1.6 for readability.

### Layout & Spacing
Maintain minimum spacing of 16px between primary elements.
Use a consistent spacing scale (8px system for desktop; 4px for mobile).
Align content cleanly to establish predictable visual hierarchy.
Keep shadows subtle and ensure adequate visual breathing room across components.

### Brand & Logo Considerations
Logo and UI colors must meet contrast requirements.
Ensure the “A” inside the chat-bubble glyph remains clearly legible and supports brand identity.
Prefer deep blue or deep green tones for the primary brand palette.

### Documentation & Output Requirements
When producing or revising design assets, include:
Updated logo proposal
Accessible color palette with luminance/contrast values
Typography guidelines (sizes, weights, spacing)
Layout and spacing system definitions
Accessibility compliance checklist
