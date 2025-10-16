# OAuth2 브라우저 자동 실행 흐름 다이어그램

## 정상 작동 흐름 (RFC 9728 준수)

### 전체 흐름 개요

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │         │             │
│  MCP SDK    │         │ MCP Proxy   │         │   User      │         │  Backend    │
│   Client    │         │   Server    │         │  Browser    │         │    API      │
│             │         │             │         │             │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │                       │
       │                       │                       │                       │
```

---

### Phase 1: OAuth Discovery (RFC 9728)

#### Step 1: 초기 인증되지 않은 요청

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  POST /mcp                  │
   │  (no Authorization header)  │
   ├────────────────────────────►│
   │                             │
   │  401 Unauthorized           │
   │  WWW-Authenticate: Bearer   │
   │    resource_metadata=       │
   │    "http://localhost:3002   │
   │    /.well-known/            │
   │    oauth-resource-metadata" │
   │◄────────────────────────────┤
   │                             │
```

**헤더 상세**:
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="mcp-server",
  resource_metadata="http://localhost:3002/.well-known/oauth-resource-metadata"
```

---

#### Step 2: Resource Metadata 발견 (RFC 9728)

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  GET /.well-known/          │
   │      oauth-resource-        │
   │      metadata               │
   ├────────────────────────────►│
   │                             │
   │  200 OK                     │
   │  {                          │
   │    "resource": "http://...", │
   │    "authorization_servers": │
   │      ["http://localhost:    │
   │        3002"],               │
   │    "scopes_supported": [...] │
   │  }                          │
   │◄────────────────────────────┤
   │                             │
```

**응답 JSON**:
```json
{
  "resource": "http://localhost:3002",
  "authorization_servers": [
    "http://localhost:3002"
  ],
  "scopes_supported": [
    "mcp:post:create"
  ],
  "bearer_methods_supported": [
    "header"
  ],
  "resource_documentation": "https://github.com/yourusername/mcp-blog-server"
}
```

---

#### Step 3: Authorization Server Metadata 발견 (RFC 8414)

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  GET /.well-known/          │
   │      oauth-authorization-   │
   │      server                 │
   ├────────────────────────────►│
   │                             │
   │  200 OK                     │
   │  {                          │
   │    "issuer": "http://...",  │
   │    "authorization_endpoint": │
   │      "http://localhost:3002 │
   │      /api/v1/oauth/         │
   │      authorize",            │
   │    "token_endpoint": "...", │
   │    ...                      │
   │  }                          │
   │◄────────────────────────────┤
   │                             │
```

**응답 JSON**:
```json
{
  "issuer": "http://localhost:3002",
  "authorization_endpoint": "http://localhost:3002/api/v1/oauth/authorize",
  "token_endpoint": "http://localhost:3002/api/v1/oauth/token",
  "registration_endpoint": "http://localhost:3002/api/v1/oauth/register",
  "revocation_endpoint": "http://localhost:3002/api/v1/oauth/revoke",
  "token_introspection_endpoint": "http://localhost:3002/api/v1/oauth/introspect",
  "response_types_supported": ["code"],
  "response_modes_supported": ["query"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:post:create"]
}
```

---

### Phase 2: OAuth Authorization (PKCE)

#### Step 4: 브라우저 자동 실행

```
MCP SDK                    User Browser
   │                             │
   │  ✨ 브라우저 자동 오픈       │
   │  (MCP SDK가 실행)           │
   │                             │
   │  authorization_endpoint +   │
   │  PKCE parameters:           │
   │  - response_type=code       │
   │  - client_id=...            │
   │  - redirect_uri=...         │
   │  - scope=mcp:post:create    │
   │  - state=<session_id>       │
   │  - code_challenge=...       │
   │  - code_challenge_method=S256│
   ├────────────────────────────►│
   │                             │
```

**URL 예시**:
```
http://localhost:3002/api/v1/oauth/authorize?
  response_type=code&
  client_id=mcp-proxy-client&
  redirect_uri=http://localhost:3002/oauth/callback&
  scope=mcp:post:create&
  state=550e8400-e29b-41d4-a716-446655440000&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
```

---

#### Step 5: OAuth 승인 플로우

```
User Browser              MCP Proxy Server         Backend API
     │                           │                      │
     │  GET /api/v1/oauth/       │                      │
     │      authorize?...        │                      │
     ├──────────────────────────►│                      │
     │                           │  Proxy to Backend    │
     │                           ├─────────────────────►│
     │                           │                      │
     │                           │  로그인 페이지 또는    │
     │                           │  승인 페이지          │
     │                           │◄─────────────────────┤
     │  로그인/승인 페이지        │                      │
     │◄──────────────────────────┤                      │
     │                           │                      │
     │  (사용자가 승인 버튼 클릭) │                      │
     │                           │                      │
     │  POST 승인                │                      │
     ├──────────────────────────►│                      │
     │                           │  Proxy to Backend    │
     │                           ├─────────────────────►│
     │                           │                      │
     │                           │  Redirect to callback │
     │                           │  with code           │
     │                           │◄─────────────────────┤
     │  302 Redirect             │                      │
     │  Location: /oauth/        │                      │
     │            callback?      │                      │
     │            code=xxx&      │                      │
     │            state=xxx      │                      │
     │◄──────────────────────────┤                      │
     │                           │                      │
```

---

#### Step 6: OAuth Callback 처리

```
User Browser              MCP Proxy Server         MCP SDK Client
     │                           │                      │
     │  GET /oauth/callback?     │                      │
     │      code=xxx&state=xxx   │                      │
     ├──────────────────────────►│                      │
     │                           │                      │
     │  200 OK                   │                      │
     │  (oauth-callback.html)    │                      │
     │◄──────────────────────────┤                      │
     │                           │                      │
     │  (JavaScript 실행)        │                      │
     │  Authorization Code       │                      │
     │  추출하여 SDK로 전달       │                      │
     │                           │                      │
     │  (SDK가 임시 로컬 서버로   │                      │
     │   Authorization Code 전송) │                      │
     ├──────────────────────────────────────────────────►│
     │                           │                      │
```

**oauth-callback.html 동작**:
1. URL에서 `code`와 `state` 파라미터 추출
2. MCP SDK의 임시 로컬 콜백 서버로 Authorization Code 전송
3. 성공 메시지 표시 및 브라우저 창 자동 닫기

---

### Phase 3: Token Exchange (PKCE)

#### Step 7: 토큰 교환

```
MCP SDK                    MCP Proxy Server         Backend API
   │                             │                      │
   │  POST /api/v1/oauth/token   │                      │
   │  {                          │                      │
   │    grant_type:              │                      │
   │      "authorization_code",  │                      │
   │    code: "xxx",             │                      │
   │    redirect_uri: "...",     │                      │
   │    client_id: "...",        │                      │
   │    code_verifier: "..."     │                      │
   │  }                          │                      │
   ├────────────────────────────►│                      │
   │                             │  Proxy to Backend    │
   │                             ├─────────────────────►│
   │                             │                      │
   │                             │  PKCE 검증 후        │
   │                             │  토큰 발급           │
   │                             │  {                   │
   │                             │    access_token: "xxx", │
   │                             │    refresh_token: "xxx", │
   │                             │    expires_in: 3600  │
   │                             │  }                   │
   │                             │◄─────────────────────┤
   │  200 OK                     │                      │
   │  {                          │                      │
   │    access_token: "xxx",     │                      │
   │    refresh_token: "xxx",    │                      │
   │    token_type: "Bearer",    │                      │
   │    expires_in: 3600         │                      │
   │  }                          │                      │
   │◄────────────────────────────┤                      │
   │                             │                      │
```

**PKCE 검증 과정**:
1. Backend가 저장된 `code_challenge` 확인
2. SDK가 전송한 `code_verifier`로 `code_challenge` 재생성
3. 일치하면 토큰 발급, 불일치하면 401 에러

---

### Phase 4: Authenticated MCP Request

#### Step 8: 인증된 요청

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  POST /mcp                  │
   │  Authorization: Bearer xxx  │
   │  {                          │
   │    method: "tools/call",    │
   │    params: {                │
   │      name: "create_post",   │
   │      arguments: {...}       │
   │    }                        │
   │  }                          │
   ├────────────────────────────►│
   │                             │
   │  (토큰 검증)                │
   │  ✅ 유효한 토큰             │
   │                             │
   │  200 OK                     │
   │  {                          │
   │    result: {                │
   │      success: true,         │
   │      postId: 123,           │
   │      message: "..."         │
   │    }                        │
   │  }                          │
   │◄────────────────────────────┤
   │                             │
```

---

## 핵심 포인트

### 1. RFC 9728 2단계 발견 과정

```
WWW-Authenticate Header
  ↓ (resource_metadata URL 포함)
Resource Metadata 요청
  ↓ (authorization_servers 배열 포함)
Authorization Server Metadata 요청
  ↓ (authorization_endpoint 포함)
브라우저 자동 실행
```

### 2. PKCE 보안

```
code_verifier (43-128자 랜덤 문자열)
  ↓ SHA256 해시
code_challenge
  ↓ Authorization Request에 포함
Authorization Code 발급
  ↓ Token Request에 code_verifier 포함
code_challenge 재생성 및 검증
  ↓ 일치하면 토큰 발급
Access Token & Refresh Token
```

### 3. 세션 관리

```
MCP Session ID (UUID)
  ↓ Mcp-Session-Id 헤더
Session-Scoped Transport
  ↓ Redis 세션 저장소
PKCE Verifier & Access Token 저장
  ↓ 세션별로 격리
다중 사용자 동시 인증 지원
```

---

## 비교: 수정 전 vs 수정 후

### 수정 전 (실패 흐름)

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  POST /mcp                  │
   ├────────────────────────────►│
   │                             │
   │  401 Unauthorized           │
   │  WWW-Authenticate: Bearer   │
   │    authorization_server=... │
   │◄────────────────────────────┤
   │                             │
   │  ❌ resource_metadata 없음  │
   │  ❌ RFC 9728 발견 불가       │
   │  ❌ 브라우저 자동 실행 안됨  │
   │                             │
   │  수동으로 authenticate       │
   │  도구 호출 필요              │
```

### 수정 후 (성공 흐름)

```
MCP SDK                    MCP Proxy Server
   │                             │
   │  POST /mcp                  │
   ├────────────────────────────►│
   │                             │
   │  401 Unauthorized           │
   │  WWW-Authenticate: Bearer   │
   │    resource_metadata=...    │
   │◄────────────────────────────┤
   │                             │
   │  ✅ resource_metadata 발견  │
   │  ✅ RFC 9728 발견 과정 시작 │
   │  ✅ 브라우저 자동 실행      │
   │                             │
   │  (자동 OAuth 플로우 진행)   │
```

---

## 참고 자료

### RFC 표준
- **RFC 9728**: OAuth 2.0 Protected Resource Metadata
- **RFC 8414**: OAuth 2.0 Authorization Server Metadata
- **RFC 6750**: OAuth 2.0 Bearer Token Usage
- **RFC 7636**: PKCE for OAuth Public Clients

### MCP 표준
- **MCP Streamable HTTP Transport**: 2025-03-26 스펙
- **MCP OAuth2 인증**: https://wikidocs.net/291688

---

**작성일**: 2025-01-15
**버전**: 1.0
