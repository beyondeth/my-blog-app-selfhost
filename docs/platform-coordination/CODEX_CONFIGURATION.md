# Codex Configuration Standard

- Scope: OpenAI Codex official guidance alignment for this repository.
- Owner: integration maintainers.
- Last updated: 2026-02-18
- Update history: `docs/platform-coordination/CHANGELOG.md`

## Source References
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/rules
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/skills

## Repository Policy
- Keep `AGENTS.md` short and enforceable. Do not move long procedures into `AGENTS.md`.
- Keep detailed runbooks only under `docs/platform-coordination/`.
- Shared code policy is unchanged:
  - `backend/**` and `mobile/contracts/**` are edited only in `my-blog-app-integ` on `integration/workspace`.

## AGENTS.md Policy (Official Docs Aligned)
- Use AGENTS as an instruction contract, not as a long handbook.
- Prefer hierarchical routing:
  - root `AGENTS.md` contains global invariants and doc links only.
  - detail files live in `docs/platform-coordination/*`.
- Keep content compact to avoid context overflow and instruction drop.

## Rules Policy (`.codex/rules`)
- Use rules for approval/safety behavior that should be enforced consistently.
- Keep one rule file per intent:
  - example intents: shared-code boundary, destructive command handling, release gate checks.
- Include clear metadata and scope by glob patterns.
- Never place secrets in rule files.

## MCP Policy
- MCP server configuration should be explicit in project or user config.
- For required servers, declare requirement and timeout expectations.
- Use tool allow/deny lists when a server exposes risky tools.
- Treat MCP server startup failure as a blocking signal for related tasks.

## Skills Policy
- 1 skill = 1 repeatable workflow.
- Use short trigger phrases and explicit outputs.
- Put reusable templates/scripts in the skill folder; avoid large copy-paste prompts.
- Prefer explicit invocation for high-risk workflows.

## Operational Checklist (Before adopting config changes)
1. Verify change is in `my-blog-app-integ`.
2. Record behavioral change in `docs/platform-coordination/CHANGELOG.md`.
3. Update `AGENTS.md` routing only (do not bloat rules text there).
4. Validate no secret or local machine path leaks into tracked files.
