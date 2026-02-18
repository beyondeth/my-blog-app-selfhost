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
