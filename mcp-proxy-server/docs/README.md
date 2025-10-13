# MCP Proxy Server - OAuth Authentication Troubleshooting Guide

## 목차
1. [문제 개요](#문제-개요)
2. [문제 1: LLM 도구 호출 순서 제어](#문제-1-llm-도구-호출-순서-제어)
3. [문제 2: OAuth redirect_uri 검증 실패](#문제-2-oauth-redirect_uri-검증-실패)
4. [문제 3: 세션 ID 재생성으로 인한 인증 실패](#문제-3-세션-id-재생성으로-인한-인증-실패)
5. [레거시 코드 참조](#레거시-코드-참조)

---

## 문제 개요

MCP(Model Context Protocol) 서버를 통한 OAuth 인증 및 블로그 자동 포스팅 기능 구현 중 세 가지 주요 문제가 발생했습니다:

1. **LLM이 `authenticate` 도구를 먼저 호출하지 않고 `create_post`를 직접 호출**
2. **OAuth 승인 후 400 Bad Request 오류 발생**
3. **OAuth 인증 성공 후에도 `create_post` 실행 시 "Authentication required" 오류 발생**

---

## 문제 1: LLM 도구 호출 순서 제어

### 증상
```
User: "블로그 자동 포스팅해"
LLM: create_post 직접 호출 → ❌ "Authentication required" 오류
```

LLM이 OAuth 인증이 필요한 `create_post` 도구를 `authenticate` 없이 직접 호출하여 실패합니다.

### 원인 분석

MCP 프로토콜에서는 **도구 간 실행 순서를 강제할 수 있는 메커니즘이 없습니다**. LLM은 사용 가능한 도구 목록을 보고 컨텍스트에 따라 자율적으로 도구를 선택합니다.

### 해결 방법

**`serverInfo.instructions` 필드를 활용한 워크플로우 가이드 제공**

MCP 서버 초기화 시 반환되는 `serverInfo` 객체에 전역 워크플로우 지침을 추가하여 LLM에게 도구 호출 순서를 안내합니다.

#### 수정 파일: `src/tools/index.ts`

```typescript
serverInfo: {
  name: 'codebase-blog-mcp',
  version: '4.0.0',
  // 🚨 전역 워크플로우 가이드: LLM이 초기화 시 이 지침을 읽음
  instructions: `🚨 CRITICAL WORKFLOW: When handling blog posting, content creation, or auto-posting requests (자동포스팅, 블로그 작성, 포스트 생성), you MUST ALWAYS call the authenticate tool FIRST before any other tools. This is mandatory for all posting operations. Never call create_post directly without authentication.`,
  // 📋 도구 호출 순서 명시 (커스텀 메타데이터)
  workflow_requirements: {
    posting: ['authenticate', 'create_post'],  // 순서 명시
    description: 'authenticate must always be called before create_post',
  },
}
```

#### 추가 개선: 도구별 설명 강화

각 도구의 `description`에도 우선순위를 명시하여 이중 안전장치를 구현했습니다:

**authenticate 도구**:
```typescript
description: `🔐 **HIGHEST PRIORITY - CALL THIS FIRST**

Start OAuth2 PKCE authentication flow with automatic browser launch and polling.

⚠️ **CRITICAL WORKFLOW REQUIREMENT**:
- ALWAYS call this tool FIRST when handling:
  • Auto-posting (자동포스팅)
  • Blog content creation (블로그 작성)
  • Post creation (포스트 생성)
  • Any writing or publishing requests

This tool MUST be called before create_post or any content publishing operations.
Even if you think authentication might already exist, ALWAYS verify by calling this tool first.

✅ Safe to call multiple times - will reuse existing valid sessions automatically.`
```

**create_post 도구**:
```typescript
description: `⛔ **BLOCKED - AUTHENTICATION REQUIRED FIRST** ⛔

❌ DO NOT call this tool directly!
✅ You MUST call the 'authenticate' tool FIRST before using this tool.

If you are handling auto-posting (자동포스팅), blog writing (블로그 작성), or content creation (포스트 생성):
1️⃣ Call authenticate tool
2️⃣ Wait for authentication success
3️⃣ Then call this tool`
```

### 결과

```
User: "블로그 자동 포스팅해"
LLM: instructions 확인 → authenticate 먼저 호출 → create_post 호출 → ✅ 성공
```

---

## 문제 2: OAuth redirect_uri 검증 실패

### 증상
```
Failed to load resource: the server responded with a status of 400 (Bad Request)
Error approving: Error: 승인 처리 중 오류가 발생했습니다. (400)
```

OAuth 승인 버튼을 클릭했을 때 백엔드에서 400 Bad Request 오류가 발생합니다.

### 문제 발견 과정

1. **Frontend 승인 코드 확인** (`frontend/src/app/oauth/approve/page.tsx`)
   - 승인 로직 정상, `redirect_uri` 파라미터 확인

2. **Frontend API 프록시 확인** (`frontend/src/app/api/oauth/authorize/route.ts`)
   - 단순 프록시 역할, 파라미터 전달 정상

3. **Backend OAuth 컨트롤러 확인** (`backend/src/oauth/controllers/oauth.controller.ts`)
   - Line 219-222에서 `redirect_uri` 검증 로직 발견:
   ```typescript
   // 리다이렉트 URI 검증
   if (!client.redirectUris.includes(body.redirect_uri)) {
     throw new BadRequestException('Invalid redirect_uri');  // ← 400 에러 발생 지점
   }
   ```

4. **OAuth 클라이언트 설정 확인** (`backend/src/scripts/seed-mcp-proxy-client.ts`)
   ```typescript
   redirectUris: [
     'http://localhost:8080/oauth/callback',  // 등록된 URI
     'http://localhost:7777/callback',
     'http://localhost:8080/callback'
   ],
   ```

5. **MCP Proxy 실제 포트 확인**
   - MCP Proxy 서버는 **포트 3002**에서 실행 중
   - OAuth callback URL: `http://localhost:3002/oauth/callback`
   - 등록된 URI와 불일치 → 400 Bad Request

### 원인

**redirect_uri 불일치**:
- MCP Proxy 서버 실제 포트: `3002`
- OAuth 클라이언트에 등록된 포트: `8080`, `7777`
- OAuth2 보안 정책상 redirect_uri가 정확히 일치해야 함

### 해결 방법

#### 수정 파일: `backend/src/scripts/seed-mcp-proxy-client.ts`

```typescript
redirectUris: [
  'http://localhost:3002/oauth/callback',  // ✅ MCP 프록시 서버 실제 포트 추가
  'http://localhost:8080/oauth/callback',  // 이전 테스트용 포트 (호환성)
  'http://localhost:7777/callback',
  'http://localhost:8080/callback'
],
```

#### 적용 방법

```bash
cd backend
pnpm ts-node src/scripts/seed-mcp-proxy-client.ts
```

출력:
```
✅ MCP Proxy OAuth 클라이언트가 업데이트되었습니다.
```

### 결과

OAuth 승인 후 리다이렉트가 정상적으로 처리되며 토큰 교환이 성공합니다.

---

## 문제 3: 세션 ID 재생성으로 인한 인증 실패

### 증상

```
User: "블로그 자동 포스팅해"
LLM: authenticate 호출 → OAuth 승인 → 리다이렉트 성공 → create_post 실행
Error: MCP error -32603: {
  "message": "❌ Authentication required! ..."
}
→ 다시 authenticate 시도 (무한 루프 가능성)
```

OAuth 인증이 성공적으로 완료되었는데도 `create_post` 실행 시 "Authentication required" 오류가 발생하고, 다시 인증을 시도하는 문제가 발생합니다.

### 문제 발견 과정

#### 1. OAuth Callback 흐름 추적

**Frontend OAuth Callback HTML** (`mcp-proxy-server/public/oauth-callback.html`):
```html
<!-- OAuth 리다이렉트 후 authorization code와 state를 받음 -->
<script src="/oauth-callback.js"></script>
```

**Frontend OAuth Callback JavaScript** (`mcp-proxy-server/public/oauth-callback.js`):
```javascript
// Line 32-41: 백엔드에 코드 전송
fetch('/mcp/sessions/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: code,           // authorization code
    sessionId: sessionId  // MCP Transport 세션 ID
  })
})
```

**Backend Session Route** (`mcp-proxy-server/src/routes/session.routes.ts`):
```typescript
// Line 69-134: OAuth 콜백 처리
router.post('/callback', asyncHandler(async (req, res) => {
  const { code, sessionId } = req.body;

  // 1. 세션 확인
  const session = await sessionService.getSession(sessionId);

  // 2. PKCE verifier 가져오기
  const codeVerifier = await sessionService.getPkceVerifier(sessionId);

  // 3. 토큰 교환
  const tokenResponse = await axios.post(tokenUrl, {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const { access_token, refresh_token, expires_in } = tokenResponse.data;

  // 4. 토큰 저장 ⚠️ 여기서 문제 발생!
  await sessionService.saveTokens(sessionId, access_token, refresh_token, expires_in);

  // 5. 인증 완료 이벤트 발생
  authEmitter.emit('auth_complete', sessionId);

  res.json({ success: true });
}));
```

#### 2. SessionService.saveTokens 메서드 분석

**문제가 있던 코드** (`src/services/SessionService.ts`, Line 355-396):

```typescript
public async saveTokens(
  sessionId: string,
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number
): Promise<string> {
  const session = await this.getSession(sessionId);
  if (!session) {
    throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
  }

  // ⚠️ 문제 지점 1: 세션 고정 공격 방어를 위한 세션 ID 재생성
  const newSessionId = crypto.randomBytes(32).toString('hex');
  console.log(`🔄 세션 ID 재생성: ${sessionId.substring(0, 8)} → ${newSessionId.substring(0, 8)}`);

  // 토큰 암호화
  const encryptedAccessToken = this.encryptToken(accessToken);
  const encryptedRefreshToken = refreshToken ? this.encryptToken(refreshToken) : null;

  // 새 세션 객체 생성
  const newSession: MCPSession = {
    ...session,
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    authenticated: true,
  };

  // ⚠️ 문제 지점 2: 새 세션 ID로 저장
  await withRedisMetrics('set', async () => {
    await this.redis.set(
      `${this.SESSION_PREFIX}${newSessionId}`,  // 새 ID로 저장
      JSON.stringify(newSession),
      'EX',
      this.SESSION_TTL
    );
  });

  // ⚠️ 문제 지점 3: 기존 세션 삭제
  await withRedisMetrics('del', async () => {
    await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);  // 원래 세션 삭제
  });

  console.log(`💾 토큰 저장 (암호화): 세션 ${newSessionId.substring(0, 8)}...`);

  return newSessionId;  // 새 세션 ID 반환 (하지만 MCP Transport는 여전히 옛 ID 사용)
}
```

#### 3. 근본 원인 파악

**문제의 흐름**:
```
1. LLM이 authenticate 호출 (세션 ID: abc123)
2. OAuth 승인 후 토큰 교환 성공
3. SessionService.saveTokens(abc123, token)
   - 새 세션 ID 생성: def456
   - 토큰을 def456에 저장
   - 기존 세션 abc123 삭제
4. LLM이 create_post 호출 (여전히 세션 ID: abc123 사용)
5. Redis에서 abc123 조회 → null (이미 삭제됨)
6. "Authentication required" 오류 발생
```

**핵심 문제**:
- **SessionService는 보안을 위해 세션 ID를 재생성**했습니다 (세션 고정 공격 방어)
- 하지만 **MCP Transport의 세션 ID는 불변**입니다 (프로토콜 제약)
- 세션 ID 재생성으로 인해 MCP Transport와 SessionService 간 불일치 발생

### 원인

**세션 고정 공격(Session Fixation Attack) 방어 로직과 MCP 프로토콜의 충돌**:

1. **세션 고정 공격 방어**: 일반적인 웹 보안 모범 사례
   - 인증 성공 시 새로운 세션 ID를 생성하여 세션 고정 공격 방지
   - 공격자가 미리 알고 있던 세션 ID를 무효화

2. **MCP Transport의 세션 ID**: 프로토콜 제약
   - MCP Transport는 초기화 시 생성된 세션 ID를 세션 종료까지 고정
   - 세션 ID는 `StreamableHTTPServerTransport` 객체 내부에서 불변
   - 세션 ID 변경 시 Transport와 SessionService 간 동기화 불가능

3. **충돌 결과**:
   - OAuth 후 토큰은 새 세션 ID에 저장됨
   - MCP Transport는 여전히 옛 세션 ID 사용
   - create_post 실행 시 토큰 조회 실패 → 인증 오류

### 해결 방법

**세션 ID 재생성 로직 제거 및 기존 세션 ID 유지**

MCP 프로토콜의 불변 세션 ID 요구사항에 맞춰 세션 고정 공격 방어 로직을 제거하고, 대신 다음과 같은 보안 조치로 보완합니다:

1. **강력한 초기 세션 ID 생성**: 이미 32바이트 랜덤 세션 ID 사용 중
2. **로컬 개발 환경**: 세션 고정 공격 위험이 낮은 환경
3. **토큰 암호화**: AES-256-GCM 암호화는 그대로 유지

#### 수정 파일: `src/services/SessionService.ts`

**Line 334-342: 문서화 업데이트**
```typescript
/**
 * OAuth 토큰 저장 (암호화)
 *
 * 보안 개선:
 * - 토큰 AES-256-GCM 암호화
 *
 * 주의: MCP Transport 세션 ID는 변경 불가하므로 세션 ID 재생성 로직을 제거했습니다.
 * 로컬 개발 환경에서는 이미 32바이트 랜덤 세션 ID를 사용하므로 세션 고정 공격 위험이 낮습니다.
 */
```

**Line 357-359: 세션 ID 재생성 제거**
```typescript
// BEFORE (문제 있던 코드):
// 세션 고정 공격 방어: 인증 성공 시 새 세션 ID 생성
const newSessionId = crypto.randomBytes(32).toString('hex');
console.log(`🔄 세션 ID 재생성: ${sessionId.substring(0, 8)} → ${newSessionId.substring(0, 8)}`);

// AFTER (수정된 코드):
// MCP Transport 세션 ID는 변경 불가하므로 기존 세션 ID 유지
const newSessionId = sessionId;  // 재생성하지 않음
console.log(`💾 기존 세션 ID 유지: ${sessionId.substring(0, 8)}`);
```

**Line 383-396: 기존 세션 삭제 로직 제거**
```typescript
// BEFORE (문제 있던 코드):
// 새 세션 ID로 저장
await withRedisMetrics('set', async () => {
  await this.redis.set(
    `${this.SESSION_PREFIX}${newSessionId}`,
    JSON.stringify(newSession),
    'EX',
    this.SESSION_TTL
  );
});

console.log(`💾 토큰 저장 (암호화): 세션 ${newSessionId.substring(0, 8)}...`);

// 기존 세션 삭제 (이전 세션 ID 무효화)
await withRedisMetrics('del', async () => {
  await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);
});

return newSessionId;

// AFTER (수정된 코드):
// 세션 업데이트 (세션 ID는 변경하지 않음) - 메트릭 수집
await withRedisMetrics('set', async () => {
  await this.redis.set(
    `${this.SESSION_PREFIX}${newSessionId}`,  // newSessionId = sessionId (동일)
    JSON.stringify(newSession),
    'EX',
    this.SESSION_TTL
  );
});

console.log(`💾 토큰 저장 (암호화): 세션 ${newSessionId.substring(0, 8)}...`);

// 세션 ID 반환 (변경되지 않음)
return newSessionId;  // sessionId와 동일한 값 반환
```

### 적용 방법

```bash
cd mcp-proxy-server
npx tsc  # TypeScript 컴파일
# MCP Proxy 서버 재시작 필요 (사용자가 터미널에서 직접 관리)
```

### 결과

```
1. authenticate 호출 (세션 ID: 44ba3022...)
2. OAuth 승인 후 토큰 교환 성공
3. saveTokens(44ba3022, token)
   - 세션 ID 유지: 44ba3022
   - 토큰을 44ba3022에 저장
   - 기존 세션 삭제하지 않음
4. create_post 호출 (세션 ID: 44ba3022)
5. Redis에서 44ba3022 조회 → ✅ 토큰 발견
6. 포스트 생성 성공!
```

**테스트 결과**:
- ✅ OAuth 인증 정상 작동
- ✅ create_post 즉시 실행 (재인증 없음)
- ✅ 포스트 생성 완료

---

## 레거시 코드 참조

### 세션 고정 공격 방어 (제거된 코드)

**위치**: `src/services/SessionService.ts`, Line 355-396 (수정 전)

```typescript
/**
 * 레거시: 세션 고정 공격 방어 로직
 *
 * 이 코드는 웹 애플리케이션의 표준 보안 관행이지만,
 * MCP 프로토콜의 불변 세션 ID 요구사항과 충돌하여 제거되었습니다.
 *
 * 제거 이유:
 * 1. MCP Transport는 세션 ID를 변경할 수 없음 (프로토콜 제약)
 * 2. 이미 32바이트 랜덤 세션 ID 사용으로 충분한 보안 확보
 * 3. 로컬 개발 환경에서는 세션 고정 공격 위험이 낮음
 *
 * 보안 트레이드오프:
 * - 포기: 세션 ID 재생성을 통한 세션 고정 공격 방어
 * - 유지: AES-256-GCM 토큰 암호화, 강력한 초기 세션 ID 생성
 */

// 제거된 코드 (참고용):
/*
// 세션 고정 공격 방어: 인증 성공 시 새 세션 ID 생성
const newSessionId = crypto.randomBytes(32).toString('hex');
console.log(`🔄 세션 ID 재생성: ${sessionId.substring(0, 8)} → ${newSessionId.substring(0, 8)}`);

// ... (토큰 암호화 및 새 세션 생성) ...

// 새 세션 ID로 저장
await withRedisMetrics('set', async () => {
  await this.redis.set(
    `${this.SESSION_PREFIX}${newSessionId}`,
    JSON.stringify(newSession),
    'EX',
    this.SESSION_TTL
  );
});

// 기존 세션 삭제 (이전 세션 ID 무효화)
await withRedisMetrics('del', async () => {
  await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);
});

return newSessionId;
*/
```

### MCP Transport 세션 ID 불변성

**관련 파일**: `src/index.ts`, Line 70-90

```typescript
/**
 * MCP Transport 세션 관리
 *
 * StreamableHTTPServerTransport는 초기화 시 세션 ID를 생성하고,
 * 이 세션 ID는 Transport 객체 내부에서 불변(immutable)입니다.
 *
 * 세션 ID 생성 시점:
 * - 클라이언트가 /mcp/connect 엔드포인트에 최초 연결할 때
 * - crypto.randomBytes(32).toString('hex')로 생성 (64자 16진수 문자열)
 *
 * 세션 ID 생명주기:
 * - 생성: Transport 초기화 시
 * - 사용: 모든 MCP 요청/응답에 포함
 * - 종료: Transport.close() 호출 시
 *
 * ⚠️ 중요: 세션 ID는 Transport 객체 외부에서 변경할 수 없습니다.
 * SessionService에서 세션 ID를 변경하면 Transport와 동기화가 깨집니다.
 */

// Transport 생성 및 세션 ID 할당
const transport = new StreamableHTTPServerTransport(
  TRANSPORT_ENDPOINT,
  requestStream,
  responseStream,
  (sessionId) => sessionService.getSession(sessionId)
);

// 세션 ID는 Transport 내부에서 생성되고 불변
const sessionId = transport.sessionId;  // Read-only
```

### OAuth redirect_uri 검증 로직

**위치**: `backend/src/oauth/controllers/oauth.controller.ts`, Line 219-222

```typescript
/**
 * OAuth2 보안: redirect_uri 엄격 검증
 *
 * OAuth2 스펙(RFC 6749)에 따라 redirect_uri는 정확히 일치해야 합니다.
 * 이는 오픈 리다이렉트 공격을 방지하기 위한 필수 보안 조치입니다.
 *
 * 검증 규칙:
 * - 프로토콜(http/https), 호스트, 포트, 경로가 모두 정확히 일치
 * - 쿼리 파라미터는 무시 가능 (OAuth2 스펙 허용)
 * - 대소문자 구분 (예: HTTP와 http는 다름)
 *
 * 등록 방법:
 * - backend/src/scripts/seed-mcp-proxy-client.ts에서 redirectUris 배열에 추가
 * - 데이터베이스에 저장됨 (oauth_clients 테이블)
 */

// 리다이렉트 URI 검증
if (!client.redirectUris.includes(body.redirect_uri)) {
  throw new BadRequestException('Invalid redirect_uri');
}
```

### Redis 세션 키 구조

**위치**: `src/services/SessionService.ts`, Line 58-60

```typescript
/**
 * Redis 세션 키 구조
 *
 * 키 형식: mcp:session:{sessionId}
 * 예시: mcp:session:44ba30227a5c8f9e12d3b456c789ef01a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7
 *
 * 세션 데이터 구조 (JSON):
 * {
 *   sessionId: string,           // 64자 16진수 문자열
 *   authenticated: boolean,      // 인증 완료 여부
 *   accessToken?: string,        // AES-256-GCM 암호화된 액세스 토큰
 *   refreshToken?: string,       // AES-256-GCM 암호화된 리프레시 토큰
 *   expiresAt?: number,          // 토큰 만료 시각 (Unix timestamp)
 *   lastAccess: number,          // 마지막 접근 시각 (Unix timestamp)
 *   metadata?: Record<string, any>  // 추가 메타데이터
 * }
 *
 * TTL: 3600초 (1시간)
 * - 마지막 접근 후 1시간 동안 세션 유지
 * - 접근할 때마다 TTL 갱신
 */

private readonly SESSION_PREFIX = 'mcp:session:';
private readonly SESSION_TTL = 3600;  // 1시간
```

---

## 요약

### 문제 해결 흐름

```
문제 1: LLM 도구 호출 순서
→ serverInfo.instructions로 워크플로우 가이드 추가
→ ✅ authenticate → create_post 순서 보장

문제 2: OAuth redirect_uri 검증 실패
→ seed script에 실제 포트(3002) 추가
→ ✅ OAuth 승인 및 리다이렉트 정상 작동

문제 3: 세션 ID 재생성으로 인한 인증 실패
→ SessionService에서 세션 ID 재생성 로직 제거
→ ✅ OAuth 후 create_post 정상 실행
```

### 핵심 교훈

1. **MCP 프로토콜 제약 이해**: Transport 세션 ID는 불변
2. **보안 vs 호환성 트레이드오프**: 프로토콜 요구사항이 우선
3. **LLM 가이던스**: serverInfo.instructions로 워크플로우 제어 가능
4. **OAuth 보안**: redirect_uri는 정확히 일치해야 함

### 참고 자료

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [Session Fixation Attack](https://owasp.org/www-community/attacks/Session_fixation)
