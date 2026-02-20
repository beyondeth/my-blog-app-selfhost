# Worktree Status

- Scope: point-in-time snapshot of worktree/branch health.
- Update history: `docs/platform-coordination/CHANGELOG.md`

Last updated: 2026-02-21 00:39:39 KST

| Role | Path | Branch | Upstream | Ahead | Behind | Working tree |
| --- | --- | --- | --- | ---: | ---: | --- |
| checkpoint | `/Users/sihyungpark/Desktop/code/my-blog-app` | `codex/multi-mcp-skill-checkpoint-20260216` | `origin/codex/multi-mcp-skill-checkpoint-20260216` | 0 | 0 | clean |
| integ | `/Users/sihyungpark/Desktop/code/my-blog-app-integ` | `integration/workspace` | `origin/integration/workspace` | 0 | 0 | dirty (docs update in progress) |
| iOS | `/Users/sihyungpark/Desktop/code/my-blog-app-ios` | `feature/ios/workspace-20260217` | `origin/feature/ios/workspace-20260217` | 0 | 0 | clean |
| Android | `/Users/sihyungpark/Desktop/code/my-blog-app-aos` | `feature/aos/api-feed-contract-sync` | `origin/feature/aos/api-feed-contract-sync` | 0 | 0 | clean |
| Web | `/Users/sihyungpark/Desktop/code/my-blog-app-web` | `feature/web/workspace` | `origin/feature/web/workspace` | 0 | 0 | clean |

Notes:
- `main` is not currently checked out in any worktree.
- Local `main` differs from `origin/main` (`ahead 1`, `behind 101`) as of 2026-02-18.
- Always treat this file as a snapshot. Refresh using `git worktree list` + `git -C <path> status -sb` before release gate.

## Environment Sync Snapshot

| Target | Current state | Sync status | Action |
| --- | --- | --- | --- |
| `my-blog-app-integ/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/backend/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/frontend/.env.local` | standalone file (not symlink) | exception | decide: symlink to canonical source, or maintain manual sync and keep this exception documented |
| `my-blog-app-integ/.env.production*` | not present in worktree | by design | manage in canonical source (`/Users/sihyungpark/Desktop/code/my-blog-app`) |
