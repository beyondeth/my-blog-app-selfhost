# Worktree Status

- Scope: point-in-time snapshot of worktree/branch health.
- Update history: `docs/platform-coordination/CHANGELOG.md`

Last updated: 2026-02-18 23:03:47 KST

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
