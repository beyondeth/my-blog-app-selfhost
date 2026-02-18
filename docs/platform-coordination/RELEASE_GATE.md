# Release Gate (integ -> main)

`main` merge triggers production CI/CD deployment. Complete this checklist before merge.

- Scope: pre-release gate for `integration/workspace -> main`.
- Last updated: 2026-02-18
- Update history: `docs/platform-coordination/CHANGELOG.md`

## Preconditions

- [ ] `integration/workspace` is clean and pushed.
- [ ] iOS/Android/Web branches are merged into `integration/workspace`.
- [ ] Shared backend/contracts changes are reviewed.
- [ ] Shared changes were committed in `my-blog-app-integ` (not platform worktrees).
- [ ] Core smoke test done once (login/feed/settings/community/profile).
- [ ] `docs/platform-coordination/WORKTREE_STATUS.md` is updated.
- [ ] PR flow/approval policy check completed (`docs/platform-coordination/PR_REVIEW_POLICY.md`).
- [ ] `AGENTS.md` routing and `docs/platform-coordination/README.md` index are in sync.
- [ ] Runtime services used for final validation were started from `my-blog-app-integ`.

## Main Hygiene

- [ ] Use `origin/main` as release base (not stale local `main`).
- [ ] If local `main` is stale, sync first.

```bash
git -C /Users/sihyungpark/Desktop/code/my-blog-app fetch origin
git -C /Users/sihyungpark/Desktop/code/my-blog-app switch main
git -C /Users/sihyungpark/Desktop/code/my-blog-app pull --ff-only origin main
```

## Pre-merge Quick Check

```bash
git worktree list
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ status -sb
git -C /Users/sihyungpark/Desktop/code/my-blog-app-integ log --oneline --max-count=5
```
