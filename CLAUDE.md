# Project Development Guidelines

## Behavioral Guidelines (Karpathy Principles)

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- For payment/billing/marketplace code: always verify against Toss API docs before implementing.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove only imports/variables/functions that YOUR changes made unused.
- The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- For multi-step tasks, state a brief plan with verify checkpoints.

## Critical Rules

- **Never start/restart servers** — User manages terminals manually.
- Add detailed **Korean comments** on complex logic and business rules.
- **Always include** `credentials: 'include'` in frontend fetch calls.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16 (App Router), React Query + Zustand, Tailwind CSS + Radix UI + shadcn/ui, Tiptap editor |
| Backend | NestJS 10, PostgreSQL + TypeORM, Redis + BullMQ, AWS S3 |
| Auth | JWT (HttpOnly cookies) + Passport (Google, GitHub, Kakao OAuth2) |
| Payment | Toss Payments (Korean PG) — subscription billing + marketplace one-time |
| MCP | MCPorter auto-posting via MCP proxy server (port 3002) |

## Ports
- Frontend: `3001` (`pnpm dev`)
- Backend: `3000` (`pnpm start:dev`)
- MCP Proxy: `3002`

## API Rules
- Base URL: `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`
- **Never duplicate** `/api/v1` in paths
- All types explicitly defined — no `any` (use `unknown` if needed)

## Architecture

- **User → Blog**: 1:1 | **Blog → Posts**: 1:N | **Post → ProductDetail**: 1:1 (marketplace)
- Feature-based modules: Auth, Users, Posts, Blogs, Payment, Subscription, Marketplace, MCP
- Marketplace: `postType` field on Post entity (`blog` | `product`)

## UI Guidelines

- **Allowed colors**: black, gray-*, green-*, red-*, blue-*, zinc-*
- **Prohibited**: amber-*, orange-*
- Dark mode: always support (`dark:` prefix)
- Loading: skeleton placeholders (`animate-pulse`)
- Critical notifications: inline feedback (not toast — toast only for LOW severity)

## Security

- Never store tokens in localStorage — HttpOnly cookies only
- Backend: Guards + DTO validation (class-validator) + parameterized queries
- Secrets in env vars only — never commit `.env*`
- Payment: server-side amount validation, idempotency keys, presigned URLs for file delivery
- Logging: never log passwords, tokens, API keys, full user IDs (masking required)

## Backend Logging

- Use NestJS `Logger` class only — never `console.log`
- Production: `error`, `warn` only | Development: all levels
- Mask sensitive data: `userId.substring(0, 8)...`

## Multi-Platform Worktree Rules

| Role | Path | Branch | Owned Paths |
|------|------|--------|-------------|
| Integration | `my-blog-app-integ` | `integration/workspace` | `backend/**`, shared docs |
| iOS | `my-blog-app-ios` | `feature/ios/*` | `mobile/ios/**` |
| Android | `my-blog-app-aos` | `feature/aos/*` | `mobile/android/**` |
| Web | `my-blog-app-web` | `feature/web/*` | `frontend/**` |

- Shared paths (`backend/**`, `mobile/contracts/**`) → edit only in `my-blog-app-integ`
- Merge order: `platform branch → integration/workspace → main`
- Never auto-sync. Check divergence before work. Report to user first.
- Env vars: canonical source at `/Users/sihyungpark/Desktop/code/my-blog-app/`

## Database Commands

```bash
# Show migration status
pnpm exec ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:show -d src/data-source.ts

# Run migrations
pnpm exec ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts

# Revert last migration
pnpm exec ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:revert -d src/data-source.ts
```

## Detailed Instructions

Detailed rules are in `.claude/rules/`. Auto-loaded by Claude Code.

- **Self-improvement protocol**: `.claude/rules/00-self-improvement.md`
- Backend patterns: `.claude/rules/01-backend-conventions.md`
- Frontend patterns: `.claude/rules/02-frontend-conventions.md`
- Payment & security: `.claude/rules/03-payment-security.md`
- Marketplace: `.claude/rules/04-marketplace.md`
- Database & migration: `.claude/rules/05-database-migration.md`
- Testing: `.claude/rules/06-testing.md`
- Logging: `.claude/rules/07-logging-security.md`
- MCP auto-posting: `.claude/rules/08-mcp-autoposting.md`
- Worktree coordination: `.claude/rules/09-worktree-coordination.md`
- Common errors: `.claude/rules/10-common-errors.md`

## gstack Skills

[gstack](https://github.com/garrytan/gstack) — 개발 워크플로우 스킬 모음.

| Stage | Skill | Description |
|-------|-------|-------------|
| Brainstorm | `/office-hours` | 아이디어 브레인스토밍 세션 |
| Strategy | `/plan-ceo-review` | CEO 관점 전략 리뷰 |
| Architecture | `/plan-eng-review` | 엔지니어링 아키텍처 리뷰 |
| Design | `/plan-design-review` | 디자인 플랜 리뷰 |
| Design | `/design-consultation` | 디자인 컨설팅 |
| Planning | `/autoplan` | 자동 플랜 생성 |
| Development | `/freeze` | 스코프 고정 (변경 방지) |
| Development | `/unfreeze` | 스코프 고정 해제 |
| Development | `/careful` | 신중 모드 (프로덕션 안전) |
| Development | `/guard` | 가드레일 활성화 |
| Code Review | `/review` | 자동 코드 리뷰 |
| Design Review | `/design-review` | 비주얼 디자인 리뷰 |
| QA | `/qa` | QA 테스트 |
| QA | `/qa-only` | QA만 실행 (코드 변경 없음) |
| QA | `/browse` | 브라우저 테스트 |
| QA | `/benchmark` | 성능 벤치마크 |
| Shipping | `/ship` | 배포 준비 |
| Shipping | `/land-and-deploy` | 머지 + 배포 |
| Shipping | `/canary` | 카나리 배포 |
| Setup | `/setup-browser-cookies` | 브라우저 쿠키 설정 |
| Setup | `/setup-deploy` | 배포 환경 설정 |
| Docs | `/document-release` | 릴리스 문서 작성 |
| Debugging | `/investigate` | 버그 조사 |
| Retro | `/retro` | 회고 |
| Second Opinion | `/codex` | 코드 세컨드 오피니언 |
| Ops | `/cso` | CSO 운영 |
| Upgrade | `/gstack-upgrade` | gstack 자체 업그레이드 |

---

**Project**: Enterprise-grade SaaS blog platform with MCP auto-posting + marketplace.
Code must be clean, optimized for multi-user SaaS. Memory leak prevention, cleanup, error handling mandatory.
