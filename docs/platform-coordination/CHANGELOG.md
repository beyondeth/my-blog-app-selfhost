# Platform Coordination Changelog

Track operational rule changes for worktree/branch coordination.

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
