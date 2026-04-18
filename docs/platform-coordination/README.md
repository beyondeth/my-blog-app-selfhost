# Platform Coordination Docs

This folder is the source of truth for multi-platform worktree operations.
`AGENTS.md` keeps only core rules and links here for details.

## Documents
- `worktree-branch-playbook.md`
  - Use for ownership boundaries, shared-change escalation, and conflict recovery.
- `WORKTREE_STATUS.md`
  - Use for the latest path/branch/clean-dirty snapshot before integration work.
- `RELEASE_GATE.md`
  - Use before merging `integration/workspace` into `main`.
- `PR_REVIEW_POLICY.md`
  - Use for PR routing, approval baseline, and automation boundaries.
- `CODEX_CONFIGURATION.md`
  - Use for official Codex docs alignment (AGENTS/rules/MCP/skills policy).
- `MULTI_AGENT_PLAYBOOK.md`
  - Use for safe multi-agent operation and role split.
- `CHANGELOG.md`
  - Audit log for when/what/how coordination rules were changed.
- `PLATFORMS/web.md`
  - Web lane log for user-facing feature and rendering changes that need platform impact tracking.

## Update Policy
- Keep `AGENTS.md` concise.
- Put operational detail and history only under this folder.
- Every behavioral rule change must update `CHANGELOG.md`.
