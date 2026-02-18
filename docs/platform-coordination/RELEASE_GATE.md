# Release Gate (integ -> main)

`main` merge triggers production CI/CD deployment. Complete this checklist before merge.

## Preconditions

- [ ] `integration/workspace` is clean and pushed.
- [ ] iOS/Android/Web branches are merged into `integration/workspace`.
- [ ] Shared backend/contracts changes are reviewed.
- [ ] Shared changes were committed in `my-blog-app-integ` (not platform worktrees).
- [ ] Core smoke test done once (login/feed/settings/community/profile).
- [ ] `docs/platform-coordination/WORKTREE_STATUS.md` is updated.
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
