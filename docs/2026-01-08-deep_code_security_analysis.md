# Deep Code Security Analysis: `mcp-proxy-server`

**Date:** 2026-01-08
**Scope:** Source Code Logic (`src/**/*.ts`)

## 1. Vulnerability Analysis Summary

| Component | Risk Level | Description |
| :--- | :--- | :--- |
| **API Key Auth** | 🟢 Safe | Splitting, Validation, and Backend Delegation are implemented correctly. |
| **File Access** | 🟢 Safe | `WritingStyleService` uses a strict allowlist (`PRESETS`) and path normalization, preventing Directory Traversal. |
| **OAuth Flow** | 🟢 Safe | Tokens are validated against Redis storage before granting access. |
| **Backend Calls** | 🟡 Low | Explicit Backend URLs prevent SSRF, but the endpoint schema is exposed (Information Disclosure). |
| **DoS** | 🟡 Low | Global JSON limit (10MB) is generous. Unauthenticated large payloads could consume bandwidth, but App is behind Nginx usually. |

## 2. Specific Code Analysis

### A. `src/services/WritingStyleService.ts` (File System Access)
- **Concern**: Can a user read arbitrary files via `style` parameter?
- **Code Check**:
  ```typescript
  private readonly PRESETS = ['novel', 'tutorial', ...];
  // ...
  if (!this.isPreset(style)) { throw Error(...) }
  ```
- **Verdict**: **Secure**. The `PRESETS` allowlist acts as a strict filter. Even if a user sends `../../../../etc/passwd`, it will be rejected because it's not in the array. `path.join` is only called with safe values.

### B. `src/index.ts` (Authentication Logic)
- **Concern**: Can auth be bypassed?
- **Code Check**:
  ```typescript
  // 1. Authorization 헤더 검증
  if (!authHeader || !authHeader.startsWith('Bearer ')) { ... 401 }
  // 2. Redis 캐시 확인 -> 3. Backend 검증
  const userData = await validateApiKey(apiKey);
  ```
- **Verdict**: **Secure**. Logic is sequential and fail-safe. If Backend returns false, `userData` is null, and 401 is returned.

### C. `src/tools/index.ts` (Data Injection / SSRF)
- **Concern**: Can `create_post` trigger SSRF or inject malicious data?
- **Code Check**:
  ```typescript
  const response = await axios.post(
    `${context.config.BACKEND_BASE_URL}/api/v1/mcp/posts`,
    { ...args }
  );
  ```
- **Verdict**: **Secure against SSRF** because the URL is constructed using `config.BACKEND_BASE_URL` (Environment Variable). The user cannot control the *domain* or *port* of the request, only the body content, which the Backend must handle safely.

### D. `src/oauth/index.ts` (Token Reuse)
- **Concern**: Can an OAuth token be reused efficiently?
- **Code Check**:
  ```typescript
  const accessToken = await storage.validateAccessToken(token);
  // Resource Audience Check
  if (normalizeUrl(accessToken.resource) !== normalizeUrl(serverUrl)) { ... 403 }
  ```
- **Verdict**: **Secure**. It implements RFC 8707 Resource Indicators check, ensuring a token meant for "Server A" cannot be used on "Server B".

## 3. Residual Risks & Hardening

While the code logic is secure, the **API Surface** is the main risk in open sourcing.

1.  **DoS Vector**: The `express.json({ limit: '10mb' })` in `index.ts` applies to *all* routes.
    - **Fix**: Move the limit middleware *after* the Auth middleware for authenticated routes, or use a smaller limit (e.g., 10kb) for unauthenticated routes (`/health`, `/mcp` initial handshake).

2.  **Error Leakage**:
    - **Code**: `res.status(500).json({ message: config.NODE_ENV === 'development' ? err.message : 'An error occurred' });`
    - **Verdict**: **Good**. It explicitly hides error details in production. Ensure `NODE_ENV` is set to `production`.

## 4. Final Recommendation
The code is written with security in mind. The "Security by Design" approach (Stateless, Validated Config, Whitelists) is evident.
**You are safe to open source this code logic.** The primary protection needed is the **Infrastructure Level** (Firewall/Network) isolation mentioned in the previous report.
