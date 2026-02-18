# Mobile OAuth Code Exchange Plan (iOS + AOS + Backend + Web)

Date: 2026-02-17  
Owner Scope: `backend`, `mobile/ios`, `mobile/android`, `mobile/contracts`, coordination docs

## 1) Why This Change Is Mandatory

Current mobile social callback flow sends `access_token` and `refresh_token` in callback URL query.

- Backend sends token query on mobile callback:
  - `backend/src/auth/auth.controller.ts:289`
  - `backend/src/auth/auth.controller.ts:595`
- iOS reads tokens directly from callback query:
  - `mobile/ios/app/ios-app/Sources/MyBlogIOSApp/AppStore.swift:511`
- Android social login is not implemented yet (good timing to introduce secure flow before release):
  - `mobile/android/app/src/main/kotlin/com/myblog/android/LoginActivity.kt:66`

Risk: URL query tokens can leak via logs, browser/session history, crash reports, and third-party telemetry.

## 2) Goal / Non-Goal

## Goal
- Replace token-in-query callback with one-time `auth code` exchange for mobile social login.
- Keep web OAuth flow behavior unchanged.
- Make iOS/AOS both use the same secure exchange endpoint.

## Non-Goal
- Replacing backend Passport OAuth strategy itself.
- Breaking existing local email/password login contract.

## 3) Target Architecture

## 3.1 OAuth Start (unchanged endpoint, stronger state)
- Mobile starts OAuth as now:
  - `/api/v1/auth/google?redirect_uri=<app-scheme-callback>`
  - `/api/v1/auth/github?redirect_uri=<app-scheme-callback>`
- Keep scheme allowlist validation:
  - `backend/src/auth/utils/oauth-mobile-redirect.util.ts:20`
- Upgrade state from plain base64 payload to signed payload (`HMAC`) and attach `rid` (request id).

## 3.2 OAuth Callback Success (mobile)
- Backend still validates provider response and creates login session/cookies as today.
- For mobile callback:
  - Generate one-time code (`code`, random 256-bit).
  - Store exchange payload in Redis with short TTL (default 90s).
  - Redirect to app callback with:
    - `code`
    - `provider`
    - `needs_consent`
  - Do not include access/refresh token in query.

## 3.3 New Exchange Endpoint
- Add endpoint:
  - `POST /api/v1/mobile/auth/oauth/exchange`
- Request:
  - `code` (required)
  - `redirectUri` (required, must match stored value)
  - `provider` (optional but recommended consistency check)
- Response:
  - same mobile auth token shape:
    - `accessToken`
    - `refreshToken`
    - `user`
    - `message`

## 3.4 Exchange Data Model (Redis)
- Namespace/key:
  - `temp:mobile_oauth_code:<codeHash>`
- Value:
  - `userId`
  - `accessToken`
  - `refreshToken`
  - `provider`
  - `redirectUri`
  - `issuedAt`
  - `expiresAt`
  - `rid`
- TTL:
  - `MOBILE_OAUTH_CODE_TTL_SECONDS` (default `90`)

Note: store by code hash (HMAC-SHA256) to avoid plaintext code persistence.

## 3.5 One-Time Atomic Consumption
- Exchange must be atomic to prevent replay/race.
- Required backend utility:
  - `consumeOnce(key)` using Lua (`GET` + `DEL` atomically).
- If second request reuses same code:
  - return `401` with `OAUTH_CODE_USED`.

## 4) Security Hardening Rules (No Compromise)

## 4.1 State Integrity
- Existing state is only base64 JSON and not signed.
- Add signature and verify it on callback.
- Reject if signature invalid: `OAUTH_STATE_INVALID`.

## 4.2 Redirect Binding
- Exchange request must include `redirectUri`.
- Must equal stored `redirectUri` from OAuth start.
- Reject mismatch: `OAUTH_CODE_BIND_MISMATCH`.

## 4.3 TTL + Replay Protection
- TTL expiry strict check: `OAUTH_CODE_EXPIRED`.
- One-time consume only (atomic).

## 4.4 Logging Hygiene
- Never log raw `code`, `accessToken`, `refreshToken`.
- Log only masked hashes and request IDs.

## 5) Backward-Compatible Rollout Plan

## Phase A: Backend Dual Mode
- Env flag:
  - `MOBILE_OAUTH_CALLBACK_MODE=dual|code` (default `dual` first rollout)
- `dual`:
  - mobile callback returns both:
    - new `code`
    - legacy tokens (temporary fallback)
- `code`:
  - returns only `code`.

## Phase B: iOS Update
- iOS callback handler:
  - code-first exchange path
  - temporary fallback to legacy token query in `dual` phase only
- Update after stability:
  - remove fallback parsing path.

## Phase C: Android New Social Flow
- Android social login should launch only secure code exchange path from first implementation.

## Phase D: Enforce
- Switch env to `code`.
- Remove legacy token query payload from backend callback.

## 6) Platform Execution Todo (Updated)

- [ ] AOS Login UI 1:1 sync with iOS using Pencil source (`/tmp/ios-6-v26.pen`, frame `bHWAp`)
- [ ] Android social login implementation (Custom Tabs + callback handling)
- [ ] Android callback intent-filter design + implementation (`codebase://auth/callback` first, app-link extensible)
- [ ] Backend: add mobile OAuth one-time code issue in OAuth callbacks
- [ ] Backend: add `POST /mobile/auth/oauth/exchange`
- [ ] Backend: add atomic consume utility in Redis service
- [ ] iOS: switch social callback to code exchange (with temporary fallback only in dual mode)
- [ ] Android: implement code exchange client path + token store integration
- [ ] Common auth contract doc for 3 platforms (token lifetime / refresh / fallback / error code)
- [ ] Remove legacy token-in-query fallback after rollout completion

Excluded by request:
- [x] E2E scenario item 7 excluded from this cycle

## 7) API / Contract Draft

## Request
`POST /api/v1/mobile/auth/oauth/exchange`

```json
{
  "code": "string",
  "redirectUri": "codebase://auth/callback",
  "provider": "google"
}
```

## Success 200

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": { "id": "...", "email": "...", "username": "..." },
  "message": "소셜 로그인 성공"
}
```

## Errors
- `400` `OAUTH_EXCHANGE_BAD_REQUEST`
- `401` `OAUTH_CODE_INVALID`
- `401` `OAUTH_CODE_EXPIRED`
- `401` `OAUTH_CODE_USED`
- `401` `OAUTH_CODE_BIND_MISMATCH`
- `401` `OAUTH_STATE_INVALID`
- `500` `OAUTH_EXCHANGE_INTERNAL`

## 8) Validation Checklist

- [ ] Callback URL query contains no access/refresh token in `code` mode.
- [ ] Same code cannot be exchanged twice.
- [ ] Expired code is rejected.
- [ ] redirectUri mismatch is rejected.
- [ ] iOS login success path works with code exchange.
- [ ] Android login success path works with code exchange.
- [ ] Existing web OAuth callback still redirects to web as before.

## 9) Concrete File Targets (Implementation Phase)

Backend:
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/guards/google-auth.guard.ts`
- `backend/src/auth/guards/github-auth.guard.ts`
- `backend/src/auth/utils/oauth-mobile-redirect.util.ts`
- `backend/src/auth/dto/*` (new exchange DTO)
- `backend/src/redis/unified-redis.service.ts`
- `backend/src/auth/mobile-auth.controller.ts`

iOS:
- `mobile/ios/app/ios-app/Sources/MyBlogIOSApp/AppStore.swift`
- `mobile/ios/app/ios-app/Sources/MyBlogIOSApp/Core/Auth/AuthService.swift`

Android:
- `mobile/android/app/src/main/kotlin/com/myblog/android/LoginActivity.kt`
- `mobile/android/app/src/main/AndroidManifest.xml`
- `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/AuthApi.kt`
- `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/HttpAuthApi.kt`
- `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/MobileContractAuthRepository.kt`
- `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/AuthSessionManager.kt`
- (new) callback handler activity / custom tabs launcher

Contracts/Docs:
- `mobile/contracts/api/mobile/README.md`
- `mobile/contracts/error-codes/error-codes.md`
- `docs/platform-coordination/mobile-oauth-code-exchange-plan-2026-02-17.md`

