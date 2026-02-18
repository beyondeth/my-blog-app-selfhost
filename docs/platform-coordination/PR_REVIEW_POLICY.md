# PR Review Policy (Platform -> Integration -> Main)

- Scope: PR routing, approval policy, and automation boundaries.
- Owner: integration maintainers.
- Last updated: 2026-02-18
- Update history: `docs/platform-coordination/CHANGELOG.md`

## Goals
- Keep complete review history in GitHub.
- Enforce shared-code boundary (`backend/**`, `mobile/contracts/**` in integ only).
- Standardize human approval before merge.

## Branch PR Flow
1. Platform branch (`feature/ios/*`, `feature/aos/*`, `feature/web/*`) -> `integration/workspace`.
2. Integration branch (`integration/workspace`) -> `main` only after release gate.

## Approval Rules (Recommended)
- Platform PR to `integration/workspace`:
  - at least 1 approval.
  - required status check: `platform-pr-guardrails`.
- Integration PR to `main`:
  - at least 1 human approval (recommended 2 for production-critical changes).
  - required status checks: release/test workflows + `platform-pr-guardrails`.

## Automation Scope
- Sub-agent can:
  - draft PR body using PLATFORM-TRACK template.
  - summarize file changes and test evidence.
  - run read-only reviews and risk comments.
- Sub-agent should not:
  - auto-approve and auto-merge without human gate.
  - bypass branch protection.

## Enforced Repository Checks
- `.github/workflows/platform-pr-guardrails.yml` enforces:
  - platform branches target `integration/workspace`.
  - only `integration/workspace` can target `main`.
  - platform branches cannot change `backend/**`, `mobile/contracts/**`.
  - PR body must include PLATFORM-TRACK fields.

## Manual Branch Protection Setup (GitHub UI)
- Branch: `integration/workspace`
  - require pull request before merging.
  - require 1 approval.
  - require status checks to pass.
- Branch: `main`
  - require pull request before merging.
  - require approval(s).
  - restrict who can push directly (recommended).
  - require status checks to pass.
