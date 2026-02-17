# Worktree + Branch Playbook (Web/iOS/AOS)

## Purpose
Prevent cross-platform branch collisions and mixed commits while running multiple terminals in parallel.

## Standard Workspace Mapping
- Integration only: `/Users/sihyungpark/Desktop/code/my-blog-app-integ`
- iOS only: `/Users/sihyungpark/Desktop/code/my-blog-app-ios`
- Android only: `/Users/sihyungpark/Desktop/code/my-blog-app-aos`
- Web only: `/Users/sihyungpark/Desktop/code/my-blog-app-web`

## Branch Strategy
- `hotfix/auth-me-no-401`: integration branch for QA and release candidate validation.
- `feature/shared/<task>`: shared backend/contracts/docs.
- `feature/ios/<task>`: iOS implementation (`mobile/ios/**`).
- `feature/aos/<task>`: Android implementation (`mobile/android/**`).
- `feature/web/<task>`: Web implementation.

## Ownership Matrix
- Shared:
  - `backend/**`
  - `mobile/contracts/**`
  - shared coordination docs
- iOS:
  - `mobile/ios/**`
- Android:
  - `mobile/android/**`
- Web:
  - `frontend/**`

## Merge Sequence
1. Merge `feature/shared/*` into `hotfix/auth-me-no-401`.
2. Merge platform branches into `hotfix/auth-me-no-401`.
3. Validate integration behavior.
4. Merge `hotfix/auth-me-no-401` to `main` only after sign-off.

## Daily Workflow
1. Open terminal in the platform worktree only.
2. Create a task branch with the platform prefix.
3. Commit only files owned by that platform.
4. Open PR or merge into `hotfix/auth-me-no-401` from integration worktree.

## Conflict Prevention Rules
- Never run feature development in `/Users/sihyungpark/Desktop/code/my-blog-app` base path.
- Never share one branch across multiple worktrees.
- If a change touches both shared and platform code, split into separate commits and branches.
- Keep temp outputs excluded from Git tracking (`output/`, `sdd-tool-analysis/`).

## Recovery Procedure
If mixed commits happen:
1. Create backup branches from the mixed commit SHA.
2. Split by path into clean branches (`shared`, `ios`, `aos`, `web`).
3. Merge clean branches into `hotfix/auth-me-no-401`.
4. Delete temporary split branches after verification.
