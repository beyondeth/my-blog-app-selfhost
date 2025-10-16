# OAuth2 브라우저 자동 실행 - 빠른 참조 가이드

## 문제 해결 한줄 요약

**WWW-Authenticate 헤더에 `authorization_server` 대신 `resource_metadata` 파라미터를 사용해야 합니다.**

---

## 수정 내용

### 파일: `www-authenticate.ts`

```typescript
// ❌ 이전 (잘못됨)
parts.push(`authorization_server="${baseUrl}/.well-known/oauth-authorization-server"`);

// ✅ 현재 (올바름)
parts.push(`resource_metadata="${baseUrl}/.well-known/oauth-resource-metadata"`);
```

---

## 헤더 비교

### 수정 전
```http
WWW-Authenticate: Bearer realm="mcp-server",
  authorization_server="http://localhost:3002/.well-known/oauth-authorization-server"
```

### 수정 후
```http
WWW-Authenticate: Bearer realm="mcp-server",
  resource_metadata="http://localhost:3002/.well-known/oauth-resource-metadata"
```

---

## RFC 9728 발견 흐름

```
1. WWW-Authenticate → resource_metadata URL
2. GET /.well-known/oauth-resource-metadata → authorization_servers[]
3. GET /.well-known/oauth-authorization-server → authorization_endpoint
4. 브라우저 자동 실행 ✨
```

---

## 테스트 방법

### 1. 서버 재시작
```bash
cd mcp-proxy-server
pnpm start
```

### 2. Claude Code에서 테스트
- MCP 서버 연결
- `create_post` 도구 호출 또는 `authenticate` 도구 호출
- **기대 결과**: 브라우저가 자동으로 열림 ✨

---

## 필수 엔드포인트 확인

### ✅ Resource Metadata (RFC 9728)
```http
GET /.well-known/oauth-resource-metadata
```

**필수 필드**:
- `resource`: 리소스 서버 URL
- `authorization_servers`: 인증 서버 URL 배열

### ✅ Authorization Server Metadata (RFC 8414)
```http
GET /.well-known/oauth-authorization-server
```

**필수 필드**:
- `issuer`: 인증 서버 식별자
- `authorization_endpoint`: OAuth 승인 URL
- `token_endpoint`: 토큰 발급 URL

---

## 환경 변수 확인

### 개발 환경 (.env)
```bash
MCP_BASE_URL=http://localhost:3002  # ✅ localhost 사용
```

### 프로덕션 환경 (.env.production)
```bash
MCP_BASE_URL=https://www.codebase.blog  # ✅ HTTPS 필수
```

**주의**: Docker 내부 호스트명(`http://backend:3000`) 사용 금지 ❌

---

## 추가 작업 필요 ⚠️

### 인증 체크 활성화

**파일**: `/mcp-proxy-server/src/index.ts:288`

```typescript
// TODO: 아래 false를 true로 변경
if (false && AUTH_REQUIRED_METHODS.includes(method) && !AUTH_EXEMPT_TOOLS.includes(toolName)) {
```

**현재 상태**: 인증 체크 비활성화되어 401 응답이 발생하지 않음

---

## 참고 문서

| 문서 | 설명 |
|------|------|
| `OAUTH2_FIX_SUMMARY.md` | 수정 요약 및 체크리스트 |
| `OAUTH2_BROWSER_AUTO_LAUNCH_ANALYSIS.md` | 상세 분석 및 구현 가이드 |
| `OAUTH2_BROWSER_AUTO_LAUNCH_FLOW.md` | 흐름 다이어그램 |

---

## RFC 표준

- **RFC 9728**: OAuth 2.0 Protected Resource Metadata
- **RFC 8414**: OAuth 2.0 Authorization Server Metadata
- **RFC 6750**: Bearer Token Usage

---

**버전**: 1.0 | **상태**: ✅ 핵심 수정 완료
