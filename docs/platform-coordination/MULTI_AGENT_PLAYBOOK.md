# Multi-Agent Playbook

- Scope: safe usage pattern for Codex multi-agent in this repository.
- Owner: integration maintainers.
- Last updated: 2026-02-18
- Update history: `docs/platform-coordination/CHANGELOG.md`

## Source References
- https://developers.openai.com/codex/multi-agent
- https://developers.openai.com/codex/guides/agents-md

## Why We Use Multi-Agent
- Parallelize heavy read/review tasks.
- Improve coverage for regression/risk checks.
- Keep write authority centralized to reduce branch contamination.

## Hard Rules
- Parent agent is the only writer/merger.
- Sub-agents are read-oriented by default.
- Use sub-agents for analysis, review, and search; not for cross-worktree mutation.
- Shared code edits still follow the same boundary:
  - only `my-blog-app-integ` + `integration/workspace`.

## Recommended Agent Roles
- `explorer`: repository search and dependency tracing.
- `reviewer`: risk-based review (bugs, regressions, missing tests).
- `docs-auditor`: checks AGENTS <-> runbooks consistency.
- `pr-writer`: drafts PR body/checklist from PLATFORM-TRACK and test evidence.

## Safe Execution Pattern
1. Parent agent defines scope and expected artifact.
2. Spawn sub-agents for parallel investigation.
3. Collect sub-agent outputs and resolve conflicts centrally.
4. Parent agent performs edits, tests, commit, and push.
5. Parent or human opens PR; sub-agent assists with summary/review comments only.

## With Auto PR/Merge Enabled
- Parent/sub-agent pushes platform branch updates.
- Repository automation opens PR to `integration/workspace`.
- Guardrails run and eligible PR auto-merges unless `manual-review` label exists.
- For sensitive changes, apply `manual-review` and require human merge.

## When Not To Use Multi-Agent
- Small one-file edits with obvious impact.
- High-risk secret/material handling tasks.
- Situations requiring interactive approvals at every step.

## Suggested Adoption Steps
1. Start with read-only review workflows.
2. Add multi-agent to release readiness checks.
3. Expand gradually after stability is proven in `integration/workspace`.
