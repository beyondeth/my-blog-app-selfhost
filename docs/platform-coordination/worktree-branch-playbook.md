# Worktree + Branch Playbook (Web/iOS/AOS)

- Scope: multi-platform worktree ownership and day-to-day execution rules.
- Owner: integration maintainers.
- Last updated: 2026-02-21
- Update history: `docs/platform-coordination/CHANGELOG.md`

## Purpose
Prevent cross-platform branch collisions and mixed commits while running multiple terminals in parallel.

## Related Docs
- `docs/platform-coordination/README.md`
- `docs/platform-coordination/WORKTREE_STATUS.md`
- `docs/platform-coordination/RELEASE_GATE.md`

## Standard Workspace Mapping
- Integration only: `/Users/sihyungpark/Desktop/code/my-blog-app-integ`
- iOS only: `/Users/sihyungpark/Desktop/code/my-blog-app-ios`
- Android only: `/Users/sihyungpark/Desktop/code/my-blog-app-aos`
- Web only: `/Users/sihyungpark/Desktop/code/my-blog-app-web`
- Root (`/Users/sihyungpark/Desktop/code/my-blog-app`) is checkpoint/metadata only. No feature work.

## Branch Strategy
- `integration/workspace`: shared integration branch for QA and release candidate validation.
- `feature/ios/workspace-safe`, `feature/aos/workspace-safe`, `feature/web/workspace-safe`:
  - platform-safe baseline branches rebased to `origin/integration/workspace`.
  - use these as default day-to-day platform heads.
- `feature/ios/<task>`: iOS implementation (`mobile/ios/**`) from `feature/ios/workspace-safe`.
- `feature/aos/<task>`: Android implementation (`mobile/android/**`) from `feature/aos/workspace-safe`.
- `feature/web/<task>`: Web implementation (`frontend/**`) from `feature/web/workspace-safe`.

## Ownership Matrix
- Shared (integration worktree only):
  - `backend/**`
  - `mobile/contracts/**`
  - shared coordination docs
- iOS:
  - `mobile/ios/**`
- Android:
  - `mobile/android/**`
- Web:
  - `frontend/**`

## Hard Rules (Enforced)
- MUST: shared paths are changed only in `my-blog-app-integ` on `integration/workspace`.
- NEVER: patch shared paths from platform worktrees.
- MUST: runtime services are started from `my-blog-app-integ` by default.
- MUST: merge order is `platform branch -> integration/workspace -> main`.
- MUST: divergence is reported first, not auto-synced.
- MUST: run `git fetch origin --prune` before divergence checks and use `origin/integration/workspace` as comparison base.

## Shared Change Escalation Flow
1. Detect shared impact (`backend/**`, `mobile/contracts/**`, shared docs).
2. Pause platform branch work and move to `my-blog-app-integ`.
3. Patch shared code on `integration/workspace` and run required checks.
4. Push shared change first.
5. Return to platform worktree and merge/rebase `integration/workspace`.
6. Continue platform implementation.

## Daily Workflow
1. Open terminal in the platform worktree only.
2. Sync refs, then report divergence against integration base:
   - `git fetch origin --prune`
   - `git rev-list --left-right --count <active_branch>...origin/integration/workspace`
3. Create/switch task branch with platform prefix from `feature/<platform>/workspace-safe`.
4. Commit only files owned by that platform.
5. If shared code is needed, apply it in `my-blog-app-integ` first.
6. Merge platform branch into `integration/workspace`.

## Runtime Rule
- backend (3000): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/backend && pnpm start:dev`
- frontend (3001): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/frontend && pnpm dev`
- mcp-proxy-server: `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/mcp-proxy-server && pnpm dev`
- Note: watch-mode processes only track files in the worktree where they are started.

## Environment Variable Governance

### Single Source of Truth
- Canonical env files are managed in checkpoint root: `/Users/sihyungpark/Desktop/code/my-blog-app`.
- Default canonical set:
  - `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local`
  - `/Users/sihyungpark/Desktop/code/my-blog-app/.env.production`
- Worktrees must consume canonical files by symlink, or record explicit exceptions in `WORKTREE_STATUS.md`.

### Worktree Policy
- `my-blog-app-integ` is the only place where shared runtime validation is executed.
- If a worktree keeps its own `.env.local` copy, that is a managed exception and must be documented with owner/reason/date.
- Never treat env divergence as "implicit"; either sync to canonical source or document exception.

### Cross-Platform Sync Procedure (No Script)
1. Determine impact scope (`web`, `backend`, `ios`, `android`, `multi`) and mark `PLATFORM-TRACK`.
2. Add/change key in canonical source (`my-blog-app` env files).
3. Reflect the same key in affected runtime environments:
   - Web/Backend/MCP local runtime env files.
   - iOS/Android local secret injection points for the same contract.
4. Update coordination docs:
   - `WORKTREE_STATUS.md` (current sync snapshot)
   - `CHANGELOG.md` (what/why/how)
5. Run minimum smoke checks from `my-blog-app-integ`:
   - login/auth (`/auth/me`)
   - settings mutation (for example marketing toggle)
   - one protected API call per affected platform flow.

## Conflict Prevention
- Never run feature development in root `my-blog-app`.
- Never share one branch across multiple worktrees.
- If a task touches shared + platform code, split commits and apply shared change first in integ.

## Recovery Procedure (If Mixed Commits Happen)
1. Create backup branches from the mixed commit SHA.
2. Split by path into clean branches (`ios`, `aos`, `web`) and move shared changes to integ.
3. Merge clean branches into `integration/workspace`.
4. Delete temporary split branches after verification.

## Safe Split Procedure (Recommended)
1. Create/reset a safe baseline branch from integration:
   - `git checkout -B feature/<platform>/workspace-safe origin/integration/workspace`
2. Cherry-pick only platform-owned commits/files.
3. Push safe baseline (`feature/<platform>/workspace-safe`) and continue task branches from there.
4. Keep legacy mixed branches read-only until fully retired.

## Quick Commands
```bash
# worktree overview
git worktree list

# branch sanity in each worktree
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-ios status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-aos status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-web status -sb

# divergence checks (report first)
git -C /Users/sihyungpark/Desktop/code/my-blog-app-ios fetch origin --prune
git -C /Users/sihyungpark/Desktop/code/my-blog-app-ios rev-list --left-right --count feature/ios/workspace-safe...origin/integration/workspace
git -C /Users/sihyungpark/Desktop/code/my-blog-app-aos fetch origin --prune
git -C /Users/sihyungpark/Desktop/code/my-blog-app-aos rev-list --left-right --count feature/aos/workspace-safe...origin/integration/workspace
git -C /Users/sihyungpark/Desktop/code/my-blog-app-web fetch origin --prune
git -C /Users/sihyungpark/Desktop/code/my-blog-app-web rev-list --left-right --count feature/web/workspace-safe...origin/integration/workspace
```
