# Worktree + Branch Playbook (Web/iOS/AOS)

## Purpose
Prevent cross-platform branch collisions and mixed commits while running multiple terminals in parallel.

## Related Docs
- `docs/platform-coordination/WORKTREE_STATUS.md`
- `docs/platform-coordination/RELEASE_GATE.md`

## Standard Workspace Mapping
- Integration only: `/Users/sihyungpark/Desktop/code/my-blog-app-integ`
- iOS only: `/Users/sihyungpark/Desktop/code/my-blog-app-ios`
- Android only: `/Users/sihyungpark/Desktop/code/my-blog-app-aos`
- Web only: `/Users/sihyungpark/Desktop/code/my-blog-app-web`

## Branch Strategy
- `hotfix/auth-me-no-401`: integration branch for QA and release candidate validation.
- `feature/shared/<task>`: shared backend/contracts/docs.
- `feature/ios/<task>`: iOS implementation (`mobile/ios/**`).
- `feature/aos/<task>`: Android implementation (`mobile/android/**`).
- `feature/web/<task>`: Web implementation.

## Ownership Matrix
- Shared:
  - `backend/**`
  - `mobile/contracts/**`
  - shared coordination docs
- iOS:
  - `mobile/ios/**`
- Android:
  - `mobile/android/**`
- Web:
  - `frontend/**`

## Merge Sequence
1. Merge `feature/shared/*` into `hotfix/auth-me-no-401`.
2. Merge platform branches into `hotfix/auth-me-no-401`.
3. Validate integration behavior.
4. Merge `hotfix/auth-me-no-401` to `main` only after sign-off.

## Daily Workflow
1. Open terminal in the platform worktree only.
2. Create a task branch with the platform prefix.
3. Commit only files owned by that platform.
4. Open PR or merge into `hotfix/auth-me-no-401` from integration worktree.

## Conflict Prevention Rules
- Never run feature development in `/Users/sihyungpark/Desktop/code/my-blog-app` base path.
- Never share one branch across multiple worktrees.
- If a change touches both shared and platform code, split into separate commits and branches.
- Keep temp outputs excluded from Git tracking (`output/`, `sdd-tool-analysis/`).

## Recovery Procedure
If mixed commits happen:
1. Create backup branches from the mixed commit SHA.
2. Split by path into clean branches (`shared`, `ios`, `aos`, `web`).
3. Merge clean branches into `hotfix/auth-me-no-401`.
4. Delete temporary split branches after verification.

## Current Snapshot (2026-02-18 21:20 KST)
| Role | Path | Branch | Upstream | Ahead | Behind | Working tree |
| --- | --- | --- | --- | ---: | ---: | --- |
| checkpoint | `/Users/sihyungpark/Desktop/code/my-blog-app` | `codex/multi-mcp-skill-checkpoint-20260216` | `origin/codex/multi-mcp-skill-checkpoint-20260216` | 0 | 0 | dirty (untracked files present) |
| integ | `/Users/sihyungpark/Desktop/code/my-blog-app-integ` | `hotfix/auth-me-no-401` | `origin/hotfix/auth-me-no-401` | 0 | 0 | clean |
| iOS | `/Users/sihyungpark/Desktop/code/my-blog-app-ios` | `feature/ios/workspace-20260217` | `origin/feature/ios/workspace-20260217` | 0 | 0 | clean |
| Android | `/Users/sihyungpark/Desktop/code/my-blog-app-aos` | `feature/aos/api-feed-contract-sync` | `origin/feature/aos/api-feed-contract-sync` | 0 | 0 | clean |
| Web | `/Users/sihyungpark/Desktop/code/my-blog-app-web` | `feature/web/workspace` | `origin/feature/web/workspace` | 0 | 0 | clean |

Notes:
- `main` is currently not checked out in any worktree.
- Local `main` diverges from `origin/main` (`ahead 1`, `behind 101`) and must not be used as release base.

## Release Gate (integ -> main)
Because merge to `main` triggers production CI/CD, pass all checks below before merge:

- [ ] `hotfix/auth-me-no-401` is clean and pushed.
- [ ] iOS/Android/Web feature branches are merged into `hotfix/auth-me-no-401`.
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
