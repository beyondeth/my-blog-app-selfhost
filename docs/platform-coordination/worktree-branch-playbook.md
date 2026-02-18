# Worktree + Branch Playbook (Web/iOS/AOS)

- Scope: multi-platform worktree ownership and day-to-day execution rules.
- Owner: integration maintainers.
- Last updated: 2026-02-18
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
- `feature/ios/<task>`: iOS implementation (`mobile/ios/**`).
- `feature/aos/<task>`: Android implementation (`mobile/android/**`).
- `feature/web/<task>`: Web implementation (`frontend/**`) only.

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

## Shared Change Escalation Flow
1. Detect shared impact (`backend/**`, `mobile/contracts/**`, shared docs).
2. Pause platform branch work and move to `my-blog-app-integ`.
3. Patch shared code on `integration/workspace` and run required checks.
4. Push shared change first.
5. Return to platform worktree and merge/rebase `integration/workspace`.
6. Continue platform implementation.

## Daily Workflow
1. Open terminal in the platform worktree only.
2. Create/switch task branch with platform prefix.
3. Commit only files owned by that platform.
4. If shared code is needed, apply it in `my-blog-app-integ` first.
5. Merge platform branch into `integration/workspace`.

## Runtime Rule
- backend (3000): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/backend && pnpm start:dev`
- frontend (3001): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/frontend && pnpm dev`
- mcp-proxy-server: `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/mcp-proxy-server && pnpm dev`
- Note: watch-mode processes only track files in the worktree where they are started.

## Conflict Prevention
- Never run feature development in root `my-blog-app`.
- Never share one branch across multiple worktrees.
- If a task touches shared + platform code, split commits and apply shared change first in integ.

## Recovery Procedure (If Mixed Commits Happen)
1. Create backup branches from the mixed commit SHA.
2. Split by path into clean branches (`ios`, `aos`, `web`) and move shared changes to integ.
3. Merge clean branches into `integration/workspace`.
4. Delete temporary split branches after verification.

## Quick Commands
```bash
# worktree overview
git worktree list

# branch sanity in each worktree
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-ios status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-aos status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-web status -sb
```
