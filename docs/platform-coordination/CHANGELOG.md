# Platform Coordination Changelog

Track operational rule changes for worktree/branch coordination.

## 2026-02-26

### Additional update (feed period hot/top cache-warming env tracking)

#### What changed
- Added env tracking entries for feed period hot/top optimization flags:
  - `FEED_HOT_PERIOD_TTL_SECONDS` (default `600`)
  - `DISABLE_FEED_PERIOD_WARMING` (default `false`)
- Updated environment sync snapshot table in `WORKTREE_STATUS.md`.

#### Why
- Feed period hot/top path now has explicit runtime knobs for TTL and warming behavior.
- New keys must be tracked in platform coordination docs to avoid env drift across worktrees and deploy targets.

#### How
- Updated:
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-24

### Additional update (integration boundary + selective platform sync policy)

#### What changed
- Clarified default branch boundary:
  - execution and merge flow stops at `integration/workspace` by default
  - `main` merge/push requires explicit user request.
- Added explicit selective-sync policy:
  - no immediate fan-out to `ios/aos/web` after every integration merge
  - platform sync timing is limited to task-start, pre-PR, or shared dependency/contract alignment.
- Added divergence interpretation guidance and refreshed snapshot docs.
- Updated worktree snapshot to current branch heads:
  - `feature/integ/chatgpt-app`
  - `feature/web/oauth-follow-fix`
  - `feature/ios/workspace-safe`
  - `feature/aos/workspace-safe`

#### Why
- Team workflow requires avoiding accidental `integration/workspace -> main` promotion due to CI side effects.
- Immediate fan-out sync caused confusion when web/docs commits appeared as Android/iOS `behind` counts.
- We needed a deterministic rule for when branch sync is required vs optional.

#### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-23

### Additional update (ChatGPT App phase-1 + env sync tracking)

#### What changed
- Started `feature/integ/chatgpt-app` on integration worktree for shared-path-safe ChatGPT App rollout.
- Added/updated env governance snapshot for new MCP feature flag:
  - `OPENAI_APP_ENABLED` (default `false`)
- Updated worktree snapshot for current branch and dirty-state tracking.

#### Why
- ChatGPT App route rollout introduces a new runtime toggle that must be tracked across environments.
- Shared-path changes are implemented in integ worktree and need an explicit status snapshot.

#### How
- Updated:
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-21

### Additional update (safe branch baseline + divergence reference hardening)

#### What changed
- Updated worktree playbook to standardize platform-safe baselines:
  - `feature/ios/workspace-safe`
  - `feature/aos/workspace-safe`
  - `feature/web/workspace-safe`
- Updated `AGENTS.md` divergence command to explicit remote base check:
  - `git fetch origin --prune`
  - `git rev-list --left-right --count <active_branch>...origin/integration/workspace`
- Added parallel lane instruction in `AGENTS.md` and playbook for multi-worktree requests.
- Added "ask-then-proceed" rule for ambiguous or potentially missed user requests.
- Added explicit divergence check rule in playbook:
  - run `git fetch origin --prune` first
  - compare against `origin/integration/workspace` (report-first, no auto-sync)
- Added safe split recovery steps for mixed branches (create safe baseline, cherry-pick platform-owned commits only).
- Refreshed `WORKTREE_STATUS.md` snapshot to current safe branch heads and recorded legacy mixed branches as reference-only.

#### Why
- Local `integration/workspace` refs can differ across worktrees, causing divergence counts to look inconsistent.
- We needed one explicit baseline branch per platform to keep day-to-day work clean and prevent shared-path contamination.

#### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

### What changed
- Added cross-platform environment-variable governance as an enforced rule in `AGENTS.md`.
- Expanded worktree playbook with a dedicated env policy:
  - canonical source-of-truth location
  - documented exception policy
  - no-script manual sync procedure across backend/frontend/ios/android/mcp.
- Added env synchronization checks to release gate preconditions.
- Added current env sync snapshot (including frontend local exception) to `WORKTREE_STATUS.md`.

### Why
- Multiple worktrees were causing env drift risk during integration testing.
- Shared keys can silently diverge across backend/frontend/mobile unless there is one explicit source of truth plus documented exceptions.
- Release validation needed an explicit env parity gate to prevent "works on one worktree only" failures.

### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-19

### What changed
- Aligned MCP/skills user guidance with current runtime behavior and official vendor docs:
  - Rewrote `mcp-proxy-server/README.md` to current dual-route architecture (`/mcp` + `/mcp-remote`).
  - Updated MCP auth/status output to avoid production URL confusion in local/dev:
    - `check_auth` blog URL now uses `FRONTEND_URL` base.
  - Updated startup/env log messages to describe dual auth mode explicitly.
  - Updated API key setup snippets for agent clients:
    - Claude Code command switched to explicit HTTP transport form.
    - Gemini CLI config path switched to `~/.gemini/settings.json`.
    - Codex config snippet removed obsolete `rmcp_client` guidance and now focuses on MCP block only.
  - Added inline caveat for Antigravity schema drift and explicit official-doc verification date in UI.

### Why
- Operators were seeing API Key-oriented text and production-style URLs even during OAuth/local workflows.
- Setup snippets had drifted from current OpenAI/Anthropic/Gemini documentation, increasing onboarding failure risk.
- README had stale endpoints (`/api/v1/mcp`) and outdated tool descriptions no longer matching code.

### How
- Updated:
  - `mcp-proxy-server/README.md`
  - `mcp-proxy-server/src/tools/index.ts`
  - `mcp-proxy-server/src/config/env.validation.ts`
  - `mcp-proxy-server/src/index.ts`
  - `frontend/src/app/settings/api-keys/configSnippets.ts`
  - `frontend/src/app/settings/api-keys/page.tsx`
- Official references validated on 2026-02-19:
  - OpenAI Codex Skills/Config/MCP docs
  - Anthropic Claude Code Skills/Settings docs
  - Gemini CLI docs (`skills`, `configuration`)

### Additional update (skills onboarding UX simplification)

#### What changed
- Reworked API key settings UX to separate onboarding paths:
  - Added explicit mode selector: `SKILLS 설치 (권장)` vs `MCP 직접 설정`.
  - Moved skill onboarding above MCP guide.
  - Removed `MCPorter` naming from user-facing onboarding section to avoid terminology confusion.
- Simplified skill onboarding copy:
  - kept only feature summary + install commands
  - removed verbose usage flow and optional API key fallback explanation from the skills block

#### Why
- Existing wording and placement made users interpret skills as an MCP sub-option.
- Overly long instructions increased onboarding friction for non-technical users.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/page.tsx`
  - `frontend/src/app/settings/api-keys/configSnippets.ts`

### Additional update (API key page redesign + secure copy UX)

#### What changed
- Refactored API key section to a compact table-driven layout (`이름 / 비밀 키 / 최근에 사용됨 / 작업`) inspired by a cleaner admin-console pattern.
- Replaced multi-card key creation flow with a single top-right `+ API 키 생성` action.
- Restored usage visibility in key table (`요청 수`, `포스트 수`, `만료일`).
- Applied secure copy policy:
  - raw key is kept only in current runtime memory after creation
  - no browser persistent storage (no localStorage/sessionStorage) for plaintext API keys
  - if runtime plaintext is unavailable, UI shows `원문 없음` and guides regeneration

#### Why
- Existing key area looked visually fragmented and over-detailed.
- One-time-only copy behavior caused repeated user friction during setup and reuse.
- Browser-persistent plaintext storage created unnecessary key leakage risk.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/page.tsx`
- Constraints documented in implementation:
  - backend stores only `keyHash` (bcrypt) and cannot reveal plaintext keys after creation.

### Additional update (skills installation flow standardization)

#### What changed
- Replaced SKILLS onboarding command set from `mcporter config/auth` to `vercel-labs/skills` installation flow.
- Added explicit command groups in web UI:
  - one-shot multi-agent install
  - per-agent install
  - verify
  - update/remove
- Updated external distribution repo guide:
  - `codebase-skills/README.md` now documents install/verify/update/remove with `npx skills`.

#### Why
- Previous SKILLS block behaved like MCP endpoint registration, which did not install `SKILL.md` files for agents.
- Users needed a single reliable installation path across Codex, Claude Code, Gemini CLI, and Antigravity.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/configSnippets.ts`
  - `frontend/src/app/settings/api-keys/page.tsx`
  - `/Users/sihyungpark/Desktop/code/codebase-skills/README.md`

## 2026-02-18

### What changed
- Introduced `integration/workspace` as the integration branch name.
- Enforced shared-code ownership:
  - `backend/**`, `mobile/contracts/**`, shared coordination docs must be edited only in `my-blog-app-integ`.
- Added situation-based doc routing in `AGENTS.md`.
- Simplified playbook and separated snapshot/release checks into dedicated docs.
- Added coordination doc index (`README.md`).

### Why
- Reduce operator confusion from previous branch naming and duplicated guidance.
- Prevent accidental shared-code edits from platform worktrees.
- Keep `AGENTS.md` short so LLM/operator compliance stays high.

### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/README.md`

### Additional update (OpenAI docs alignment)

#### What changed
- Added situation routing for Codex/MCP/skills/multi-agent docs in `AGENTS.md`.
- Added `docs/platform-coordination/CODEX_CONFIGURATION.md`.
- Added `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`.
- Updated `docs/platform-coordination/README.md` index.

#### Why
- Reduce repeated prompting by pinning where to read each operational standard.
- Align repository operation model with OpenAI Codex official docs.

#### How
- Reviewed:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/rules
  - https://developers.openai.com/codex/mcp
  - https://developers.openai.com/codex/skills
  - https://developers.openai.com/codex/multi-agent

### Additional update (PR workflow + guardrails)

#### What changed
- Added repository PR template:
  - `.github/pull_request_template.md`
- Added PR guardrail workflow:
  - `.github/workflows/platform-pr-guardrails.yml`
- Added PR/approval policy runbook:
  - `docs/platform-coordination/PR_REVIEW_POLICY.md`
- Updated routing/index/checklist docs:
  - `AGENTS.md`
  - `docs/platform-coordination/README.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`
- Unignored `.codex/` in `.gitignore` for project-tracked Codex config.

#### Why
- Preserve auditable review history per platform PR.
- Enforce branch and shared-path discipline automatically.
- Separate sub-agent assist from final human approval/merge.

#### How
- Introduced CI guardrails for:
  - base branch policy
  - shared path ownership
  - required PLATFORM-TRACK fields in PR body

### Additional update (auto PR + auto merge)

#### What changed
- Added auto PR workflow:
  - `.github/workflows/auto-open-platform-pr.yml`
- Extended guardrail workflow for auto-merge:
  - `.github/workflows/platform-pr-guardrails.yml`
- Updated policy docs:
  - `docs/platform-coordination/PR_REVIEW_POLICY.md`
  - `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`

#### Why
- Reduce manual overhead for platform-to-integration synchronization.
- Keep consistent audit trail through PR-first integration.

#### How
- Platform branch pushes now open PR automatically to `integration/workspace`.
- Eligible PRs auto-merge in automation path after guardrail-equivalent checks.
- `manual-review` label provides opt-out path for sensitive changes.

### Additional update (Codebase skill sync + policy hardening)

#### What changed
- Restored missing Codebase skill docs into this worktree:
  - `.agents/skills/codebase-skill/*`
  - `docs/skills/codebase-skill/*`
- Added `agents/openai.yaml` for Codebase skill in both locations:
  - `.agents/skills/codebase-skill/agents/openai.yaml`
  - `docs/skills/codebase-skill/agents/openai.yaml`
- Set `policy.allow_implicit_invocation: false` to require explicit invocation for posting flows.

#### Why
- `integration/workspace` worktree did not contain the skill docs copied in another branch/worktree, causing local parity validation mismatch.
- Auto-posting is high-impact; explicit invocation reduces accidental posting risk.

#### How
- Copied canonical skill files from checkpoint branch worktree into `my-blog-app-integ`.
- Re-ran MCP↔Skills parity script after sync to confirm path/tool consistency.

### Additional update (Skill route strict OAuth guard)

#### What changed
- Strengthened Codebase skill docs to prohibit OAuth->API Key fallback on `skill` route:
  - `.agents/skills/codebase-skill/SKILL.md`
  - `.agents/skills/codebase-skill/MCPORTER_SKILL.md`
  - `.agents/skills/codebase-skill/HEARTBEAT.md`
  - `docs/skills/codebase-skill/SKILL.md`
  - `docs/skills/codebase-skill/MCPORTER_SKILL.md`
  - `docs/skills/codebase-skill/HEARTBEAT.md`
- Added explicit OAuth alias-only fallback policy in `skill` route:
  - `codebase-blog-oauth` -> `codebase-blog-oauth-prod` only
- Corrected `agents/openai.yaml` format to official Codex Skills structure (`interface`, `policy`, `dependencies`) in both skill locations.

#### Why
- Prevent accidental route drift where `skill` intent could be executed as direct MCP/API Key.
- Align skill metadata format with official Codex Skills docs and reduce implicit behavior ambiguity.

#### How
- Added hard safety contract sections to skill docs.
- Added `allow_implicit_invocation: false` and route-specific default prompt to `agents/openai.yaml`.

### Additional update (MCP post URL env-aware fix)

#### What changed
- Updated MCP `create_post` success message URL generation to use `FRONTEND_URL` instead of hardcoded `https://codebase.blog`.
- Added `FRONTEND_URL` to MCP proxy runtime config flow:
  - `mcp-proxy-server/src/config/env.validation.ts`
  - `mcp-proxy-server/src/index.ts`
  - `mcp-proxy-server/src/oauth/index.ts`
  - `mcp-proxy-server/src/tools/index.ts`
- Added missing env examples:
  - `BACKEND_PUBLIC_URL`
  - `FRONTEND_URL`
  in `mcp-proxy-server/.env.example`.

#### Why
- Dev environment posts were showing production domain in success output, causing operator confusion and route validation mistakes.

#### How
- Introduced frontend base URL composition for relative post paths.
- Kept absolute URLs from backend unchanged when already provided.

### Additional update (Mixed changes snapshot + path ownership split)

#### What changed
- Created snapshot branch `checkpoint/mixed-snapshot-20260220` to preserve all in-progress changes.
- Re-applied only shared/integration-owned paths onto `integration/workspace`:
  - `.agents/skills/codebase-skill/**`
  - `backend/**`
  - `mcp-proxy-server/**`
  - `docs/platform-coordination/CHANGELOG.md`
- Planned separate re-apply for web-owned paths (`frontend/**`) on `feature/web/workspace`.

#### Why
- Recent edits were made in `my-blog-app-integ` while including web-owned files.
- We need to preserve all history without loss and restore ownership boundaries defined in the worktree playbook.

#### How
- Snapshot commit first (no data loss), then selective path checkout by ownership.
- Commit/push split by worktree role before PR routing (`platform -> integration -> main`).
