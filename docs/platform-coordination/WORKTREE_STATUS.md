# Worktree Status

- Scope: point-in-time snapshot of worktree/branch health.
- Update history: `docs/platform-coordination/CHANGELOG.md`

Last updated: 2026-02-24 19:19:17 KST

| Role | Path | Branch | Upstream | Ahead | Behind | Working tree |
| --- | --- | --- | --- | ---: | ---: | --- |
| checkpoint | `/Users/sihyungpark/Desktop/code/my-blog-app` | `codex/multi-mcp-skill-checkpoint-20260216` | `origin/codex/multi-mcp-skill-checkpoint-20260216` | 0 | 0 | dirty (`skills/` untracked) |
| integ | `/Users/sihyungpark/Desktop/code/my-blog-app-integ` | `feature/integ/chatgpt-app` | `origin/feature/integ/chatgpt-app` | 0 | 0 | clean |
| iOS | `/Users/sihyungpark/Desktop/code/my-blog-app-ios` | `feature/ios/workspace-safe` | `origin/feature/ios/workspace-safe` | 0 | 0 | clean |
| Android | `/Users/sihyungpark/Desktop/code/my-blog-app-aos` | `feature/aos/workspace-safe` | `origin/feature/aos/workspace-safe` | 0 | 0 | clean |
| Web | `/Users/sihyungpark/Desktop/code/my-blog-app-web` | `feature/web/oauth-follow-fix` | `origin/feature/web/oauth-follow-fix` | 0 | 0 | clean |

## Integration Base Drift Snapshot (`origin/integration/workspace`)

| Role | Branch | Ahead | Behind | Interpretation |
| --- | --- | ---: | ---: | --- |
| integ | `feature/integ/chatgpt-app` | 4 | 1 | active feature branch diverged from integration base |
| iOS | `feature/ios/workspace-safe` | 0 | 4 | no platform commit ahead; integration has newer commits |
| Android | `feature/aos/workspace-safe` | 0 | 4 | no platform commit ahead; integration has newer commits |
| Web | `feature/web/oauth-follow-fix` | 1 | 1 | branch has one exclusive commit and misses one integration commit |

Notes:
- `main` is not currently checked out in any worktree.
- Divergence against `origin/integration/workspace` is a scheduling signal, not an automatic sync command.
- Do not fan out every integration merge to all platform branches immediately; sync per-branch at task-start or pre-PR.
- Legacy mixed branches remain for reference only:
  - `feature/web/workspace`: `ahead 3`, `behind 9` vs `origin/integration/workspace`
  - `feature/ios/test-auto-pr`: `ahead 3`, `behind 122` vs `origin/integration/workspace`
  - `feature/aos/api-feed-contract-sync`: `ahead 0`, `behind 24` vs `origin/integration/workspace`
- Always treat this file as a snapshot. Refresh using `git worktree list` + `git -C <path> status -sb` before release gate.

## Environment Sync Snapshot

| Target | Current state | Sync status | Action |
| --- | --- | --- | --- |
| `my-blog-app-integ/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/backend/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/frontend/.env.local` | standalone file (not symlink) | exception | decide: symlink to canonical source, or maintain manual sync and keep this exception documented |
| `my-blog-app-integ/.env.production*` | not present in worktree | by design | manage in canonical source (`/Users/sihyungpark/Desktop/code/my-blog-app`) |
| `mcp-proxy-server/OPENAI_APP_ENABLED` | 신규 feature flag (`false` 기본) | pending sync | affected env files/docs에 동일 키 반영 및 stage/prod 값 확정 필요 |
