# Worktree Status

- Scope: point-in-time snapshot of worktree/branch health.
- Update history: `docs/platform-coordination/CHANGELOG.md`

Last updated: 2026-04-18 15:10:43 KST

| Role | Path | Branch | Upstream | Ahead | Behind | Working tree |
| --- | --- | --- | --- | ---: | ---: | --- |
| checkpoint | `/Users/sihyungpark/Desktop/code/my-blog-app` | `codex/multi-mcp-skill-checkpoint-20260216` | `origin/codex/multi-mcp-skill-checkpoint-20260216` | 0 | 0 | dirty (`skills/` untracked) |
| integ | `/Users/sihyungpark/Desktop/code/my-blog-app-integ` | `integration/workspace` | `origin/integration/workspace` | 0 | 0 | clean |
| iOS | `/Users/sihyungpark/Desktop/code/my-blog-app-ios` | `feature/ios/workspace-safe` | `origin/feature/ios/workspace-safe` | 0 | 0 | clean |
| Android | `/Users/sihyungpark/Desktop/code/my-blog-app-aos` | `feature/aos/workspace-safe` | `origin/feature/aos/workspace-safe` | 0 | 0 | clean |
| Web | `/Users/sihyungpark/Desktop/code/my-blog-app-web` | `feature/web/2026-04-18-knowledge-ui-save` | `origin/feature/web/2026-04-18-knowledge-ui-save` | 0 | 0 | clean |

## Integration Base Drift Snapshot (`origin/integration/workspace`)

| Role | Branch | Ahead | Behind | Interpretation |
| --- | --- | ---: | ---: | --- |
| integ | `integration/workspace` | 0 | 0 | integration branch is the current shared source of truth |
| iOS | `feature/ios/workspace-safe` | 0 | 0 | platform safe branch is aligned with its remote |
| Android | `feature/aos/workspace-safe` | 0 | 0 | platform safe branch is aligned with its remote |
| Web | `feature/web/2026-04-18-knowledge-ui-save` | 0 | 0 | web lane branch is pushed and clean |

Notes:
- `main` is not currently checked out in any worktree.
- Divergence against `origin/integration/workspace` is a scheduling signal, not an automatic sync command.
- Do not fan out every integration merge to all platform branches immediately; sync per-branch at task-start or pre-PR.
- Legacy mixed branches remain for reference only:
  - `feature/web/oauth-follow-fix` is no longer the active web save lane
  - `wip/2026-04-18-multi-savepoint` contains the pre-split recovery snapshot
- Always treat this file as a snapshot. Refresh using `git worktree list` + `git -C <path> status -sb` before release gate.

## Environment Sync Snapshot

| Target | Current state | Sync status | Action |
| --- | --- | --- | --- |
| `my-blog-app-integ/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/backend/.env.local` | symlink -> `/Users/sihyungpark/Desktop/code/my-blog-app/.env.local` | synced | keep |
| `my-blog-app-integ/frontend/.env.local` | standalone file (not symlink) | exception | decide: symlink to canonical source, or maintain manual sync and keep this exception documented |
| `my-blog-app-integ/.env.production*` | not present in worktree | by design | manage in canonical source (`/Users/sihyungpark/Desktop/code/my-blog-app`) |
| `mcp-proxy-server/OPENAI_APP_ENABLED` | feature flag (`true` 운영 사용) | synced | canonical `.env.production` and GitHub `production` `ENV_FILE` must stay aligned |
| `backend/FEED_HOT_PERIOD_TTL_SECONDS` | 신규 feed 기간별 HOT/TOP TTL override (기본 `600`) | synced | canonical `.env.local/.env.production` 반영 완료. 배포 런타임 값만 확인 |
| `backend/DISABLE_FEED_PERIOD_WARMING` | 신규 feed period 워밍 토글 (`true`로 운영 비활성) | synced | canonical `.env.local/.env.production` 반영 완료. 배포 런타임 값만 확인 |
