# Worktree + Branch Playbook (Web/iOS/AOS)

## Purpose
Prevent cross-platform branch collisions and mixed commits while running multiple terminals in parallel.
Establish one rule for shared code: `backend/**` and contracts are owned by `my-blog-app-integ`.

## Related Docs
- `docs/platform-coordination/WORKTREE_STATUS.md`
- `docs/platform-coordination/RELEASE_GATE.md`

## Standard Workspace Mapping
- Integration only: `/Users/sihyungpark/Desktop/code/my-blog-app-integ`
- iOS only: `/Users/sihyungpark/Desktop/code/my-blog-app-ios`
- Android only: `/Users/sihyungpark/Desktop/code/my-blog-app-aos`
- Web only: `/Users/sihyungpark/Desktop/code/my-blog-app-web`
- Root (`/Users/sihyungpark/Desktop/code/my-blog-app`) is metadata/checkpoint only. No feature work.

## Branch Strategy
- `integration/workspace`: integration branch for QA and release candidate validation.
- `feature/ios/<task>`: iOS implementation (`mobile/ios/**`).
- `feature/aos/<task>`: Android implementation (`mobile/android/**`).
- `feature/web/<task>`: Web implementation (`frontend/**`) only.
- Shared code is applied directly in `integration/workspace` from integration worktree.

## PLATFORM-TRACK Template
Add this header to task notes, PR descriptions, and handoff messages:
```md
[PLATFORM-TRACK]
타겟: web | ios | android | multi
작업유형: feature | bugfix | refactor | runbook
공유영향 확인: YES/NO
요약: 필수 확인 내용 등
```

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

## Hard Rule (Enforced)
- MUST: shared paths (`backend/**`, `mobile/contracts/**`, shared docs) are changed only on `integration/workspace` in `my-blog-app-integ`.
- NEVER: patch shared paths from platform worktrees (`my-blog-app-ios`, `my-blog-app-aos`, `my-blog-app-web`).

## Merge Sequence
1. Merge platform branches into `integration/workspace`.
2. Apply/review shared backend/contracts updates in `integration/workspace`.
3. Validate integration behavior from `my-blog-app-integ`.
4. Merge `integration/workspace` to `main` only after sign-off.

## Daily Workflow
1. Open terminal in the platform worktree only.
2. Create a task branch with the platform prefix.
3. Commit only files owned by that platform.
4. If shared code is needed, stop and patch it in `my-blog-app-integ`.
5. Open PR or merge into `integration/workspace` from integration worktree.

## Shared Change Escalation Flow
1. Detect shared impact (`backend/**`, `mobile/contracts/**`, shared docs).
2. Pause platform branch work and move to `my-blog-app-integ`.
3. Patch shared code on `integration/workspace` and run required checks.
4. Push shared change first.
5. Return to platform worktree and merge/rebase `integration/workspace`.
6. Continue platform implementation.

## Runtime Rule
- Run default local services from integration worktree:
  - backend (3000): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/backend && pnpm start:dev`
  - frontend (3001): `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/frontend && pnpm dev`
  - mcp-proxy-server: `cd /Users/sihyungpark/Desktop/code/my-blog-app-integ/mcp-proxy-server && pnpm dev`
- Watch-mode processes only track the files of the worktree where they are started.

## Conflict Prevention Rules
- Never run feature development in `/Users/sihyungpark/Desktop/code/my-blog-app` base path.
- Never share one branch across multiple worktrees.
- Never patch `backend/**` from iOS/Android/Web worktrees.
- If a task touches both shared and platform code, split into separate commits and apply shared changes in integ first.
- Keep temp outputs excluded from Git tracking (`output/`, `sdd-tool-analysis/`).

## Recovery Procedure
If mixed commits happen:
1. Create backup branches from the mixed commit SHA.
2. Split by path into clean branches (`ios`, `aos`, `web`) and move shared changes to integ branch.
3. Merge clean branches into `integration/workspace`.
4. Delete temporary split branches after verification.

## Current Snapshot (2026-02-18 22:51 KST)
| Role | Path | Branch | Upstream | Ahead | Behind | Working tree |
| --- | --- | --- | --- | ---: | ---: | --- |
| checkpoint | `/Users/sihyungpark/Desktop/code/my-blog-app` | `codex/multi-mcp-skill-checkpoint-20260216` | `origin/codex/multi-mcp-skill-checkpoint-20260216` | 0 | 0 | clean |
| integ | `/Users/sihyungpark/Desktop/code/my-blog-app-integ` | `integration/workspace` | `origin/integration/workspace` | 0 | 0 | dirty (docs update in progress) |
| iOS | `/Users/sihyungpark/Desktop/code/my-blog-app-ios` | `feature/ios/workspace-20260217` | `origin/feature/ios/workspace-20260217` | 0 | 0 | clean |
| Android | `/Users/sihyungpark/Desktop/code/my-blog-app-aos` | `feature/aos/api-feed-contract-sync` | `origin/feature/aos/api-feed-contract-sync` | 0 | 0 | clean |
| Web | `/Users/sihyungpark/Desktop/code/my-blog-app-web` | `feature/web/workspace` | `origin/feature/web/workspace` | 0 | 0 | clean |

Notes:
- `main` is currently not checked out in any worktree.
- Local `main` diverges from `origin/main` (`ahead 1`, `behind 101`) and must not be used as release base.

## Release Gate (integ -> main)
Because merge to `main` triggers production CI/CD, pass all checks below before merge:

- [ ] `integration/workspace` is clean and pushed.
- [ ] iOS/Android/Web feature branches are merged into `integration/workspace`.
- [ ] Shared backend/contracts changes were reviewed.
- [ ] Smoke test passed once for login/feed/settings/community/profile.
- [ ] Coordination docs are updated (`CHANGELOG`, this playbook snapshot).
- [ ] PR base is `origin/main` (not stale local `main`).

Recommended pre-merge commands:
```bash
git worktree list
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ log --oneline --max-count=5
```
