# Cross-Platform Auth Contract (Web / iOS / Android)

## Scope
- Web (`frontend`)
- iOS (`mobile/ios`)
- Android (`mobile/android`)
- Backend (`backend/src/auth`)

## Token lifecycle
- Access token:
  - short-lived bearer token for API authorization
  - carried as cookie on web, secure storage value on iOS/Android
- Refresh token:
  - used only to mint new access token
  - web: HttpOnly cookie
  - mobile: secure local storage

## Per-platform transport
- Web:
  - cookie-based auth (`access_token`, `refresh_token`)
  - refresh via cookie/session path
- Mobile (iOS/Android):
  - JSON token payload from `/mobile/auth/login`, `/mobile/auth/refresh`
  - social login callback: one-time `code` only (no token query)
  - code exchange endpoint: `POST /mobile/auth/oauth/exchange`

## Social OAuth contract
1. Mobile starts OAuth with `redirect_uri` app callback.
2. Backend validates provider callback and issues one-time OAuth exchange code.
3. Backend redirects mobile callback URI with:
   - `code`
   - `provider`
   - `needs_consent`
4. App exchanges `code` on backend and receives token pair.

## Fallback / error handling
- 401 + known auth code should map to explicit re-auth UX.
- exchange errors:
  - `OAUTH_CODE_INVALID`
  - `OAUTH_CODE_EXPIRED`
  - `OAUTH_CODE_USED`
  - `OAUTH_CODE_BIND_MISMATCH`
  - `OAUTH_STATE_INVALID`
- network errors:
  - keep existing session if still valid
  - otherwise send user to login with preserved UI message

## Account selection policy
- Google: always request account chooser (`prompt=select_account consent`)
- GitHub: enforce account chooser path when provider supports it
- Local login: never auto-switch account after explicit logout

## Security requirements
- Never expose access/refresh token in callback query.
- OAuth exchange code must be single-use and short TTL.
- State should be signed and validated.
- Redirect URI must be scheme-allowlisted and bound at exchange.

