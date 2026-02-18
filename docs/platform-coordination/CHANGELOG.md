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
