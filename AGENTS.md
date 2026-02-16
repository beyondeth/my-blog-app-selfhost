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
- A **branch** is a code line in git history.
- A **worktree** is a separate checkout folder tied to one branch for isolated work.
- One platform team should work on one worktree/branch pair only.

### Recommended mapping
- `main` / `my-blog-app`: integration base branch (`hotfix/auth-me-no-401` currently used for pre-production baseline in this repo).
- `mobile/ios` worktree: branch `feature/ios/<topic>` (`feature/ios/workspace` for coordination, then narrow topic branches if needed).
- `mobile/android` worktree: branch `feature/aos/<topic>` (`feature/aos/workspace` for coordination, then narrow topic branches if needed).
- Optional web worktree: branch `feature/web/<topic>`.

### Mandatory guardrails
1. Do not write iOS code on an Android branch and do not write Android code on iOS branch.
2. Before each feature, create or check out a dedicated branch in that platform worktree:
   - iOS: `git switch feature/ios/ui-sync-v1` (or new topic branch)
   - Android: `git switch feature/aos/ui-sync-v1` (or new topic branch)
3. Keep common mobile-contract/API fixes only on `hotfix/auth-me-no-401` or a clearly named shared branch, never directly inside platform feature branches.
4. 병합은 플랫폼 시뮬/스테이징 실동작(로그인/피드/설정 등 1회 핵심 시나리오) 완료 후에만 진행.
5. Merge order: 플랫폼 브랜치 -> 공유/핫픽스 브랜치(필요 시) -> `main`.
6. Do not force-push platform branches unless explicitly coordinated.

### Safe branch deletion policy
- Do not delete a platform or shared branch until:
  - 해당 브랜치가 공유 브랜치(`hotfix/auth-me-no-401` 또는 `main`)로 병합되었고
  - `git log` 또는 PR로 변경사항이 통합됨이 확인된 경우.
- 병합 완료 후 삭제:
  - 로컬: `git branch -d feature/ios/xxx` / `git branch -d feature/aos/xxx`
  - 원격: `git push origin --delete feature/ios/xxx`
- 병합 전 삭제가 필요한 긴급 회수는 `git branch -D` + 문서/PR 로그에 삭제 사유 기록 필수.
- 병합 직후 최소 24시간은 브랜치 백업 태그(선택) 유지 후 정리 권장.

### Worktree command set (권장)
- 상태 확인:
  - `git worktree list`
  - 각 워크트리에서: `git branch --show-current`
- 이동:
  - `git switch feature/ios/<topic>` (ios)
  - `git switch feature/aos/<topic>` (android)
- 통합:
  - `git switch hotfix/auth-me-no-401`
  - `git merge --no-ff feature/ios/<topic>` / `git merge --no-ff feature/aos/<topic>`
  - 테스트/문서 확인 후 `main`으로 정식 병합

### Useful commands
- Check active worktrees:
  - `git worktree list`
- Create/attach worktree:
  - `git worktree add /path/to/my-blog-app-ios feature/ios/workspace`
  - `git worktree add /path/to/my-blog-app-aos feature/aos/workspace`
- Verify branch in each worktree:
  - `git status --short -b`
- Quick conflict-free workflow:
  - Implement in one worktree.
  - Commit with Conventional Commit.
  - Push only that platform branch.
  - Cherry-pick or open PR to shared branch explicitly.

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
