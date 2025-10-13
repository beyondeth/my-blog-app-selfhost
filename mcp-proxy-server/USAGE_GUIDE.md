# MCP 자동 포스팅 사용 가이드

## 🚀 빠른 시작

### 1. MCP 서버 실행 확인

```bash
cd /Users/sihyungpark/Desktop/code/my-blog-app/mcp-proxy-server
pnpm start

# 출력 확인:
# ✅ MCP Server initialized with 4 tools
# 🚀 MCP Proxy Server 시작됨 (포트: 8080)
# ✅ Redis 연결됨
```

### 2. Claude Code 재시작

**중요**: MCP 설정을 적용하려면 Claude Code를 완전히 종료하고 다시 시작해야 합니다.

```bash
# macOS: 완전 종료
# Cmd+Q 또는 상단 메뉴 > Claude Code > Quit

# 재시작 후 확인
# Tools 메뉴에서 "codebase_blog" 서버가 표시되는지 확인
```

---

## 📝 자동 포스팅 워크플로우

### Step 1: 인증 (authenticate)

Claude Code에서 다음과 같이 요청합니다:

```
"authenticate 도구를 사용해서 인증해줘"
```

**과정**:
1. MCP 서버가 OAuth2 인증 URL 생성
2. 브라우저가 자동으로 열림 (또는 URL을 수동으로 복사)
3. Backend 서비스 (localhost:3000)에서 로그인
4. 인증 완료 후 Session ID 받기

**예상 응답**:
```
🔐 OAuth2 인증을 시작합니다.

브라우저가 자동으로 열립니다. 열리지 않으면 아래 URL을 복사하세요:
http://localhost:3000/oauth/authorize?response_type=code&client_id=...

✅ 인증 완료 후 다음 Session ID를 사용하세요:
Session ID: abc123def456...
```

---

### Step 2: 포스트 작성 (create_post)

Session ID를 받았으면 포스트를 작성할 수 있습니다:

```
"create_post 도구로 포스트를 작성해줘.
sessionId는 'abc123def456...',
제목은 '첫 번째 자동 포스트',
내용은 마크다운으로 '# Hello World\n\n자동 포스팅 테스트입니다!'로 해줘"
```

**파라미터**:
- `sessionId` (필수): Step 1에서 받은 Session ID
- `title` (필수): 포스트 제목
- `content_markdown` (필수): 마크다운 형식 본문
- `tags` (선택): `["tech", "ai"]` 형식의 태그 배열
- `category` (선택): 카테고리 문자열
- `writingStyle` (선택): 글쓰기 스타일 (preset/URL/inline)

**예상 응답**:
```
✅ 블로그 포스트가 성공적으로 생성되었습니다!

포스트 정보:
- ID: 123
- 제목: 첫 번째 자동 포스트
- Slug: first-automatic-post
- URL: http://localhost:3001/blog/your-blog/posts/first-automatic-post
```

---

### Step 3 (선택): 기본 스타일 설정 (set_preferences)

매번 스타일을 지정하지 않고 기본값을 설정할 수 있습니다:

```
"set_preferences 도구로 기본 글쓰기 스타일을 'tutorial'로 설정해줘.
sessionId는 'abc123def456...'"
```

**파라미터**:
- `sessionId` (필수): Session ID
- `defaultWritingStyle` (선택): `tutorial`, `novel`, `comedy`, `podcast`, `default` 중 선택
- `preferences` (선택): 기타 커스텀 설정 (JSON 객체)

**예상 응답**:
```
✅ 사용자 선호도가 저장되었습니다.

현재 설정:
- 기본 글쓰기 스타일: tutorial
- Session ID: abc123def456...
```

---

### Step 4 (선택): 연결 진단 (diagnose_connection)

문제가 발생하면 연결 상태를 확인합니다:

```
"diagnose_connection 도구로 연결 상태를 확인해줘.
sessionId는 'abc123def456...'"
```

**예상 응답**:
```
🔍 Backend API 연결 진단

✅ Backend API: 정상 작동 중
   - Status: ok
   - URL: http://localhost:3000

✅ OAuth2 Authorization: 사용 가능

✅ Session: 활성 상태
   - Session ID: abc123def...
   - Access Token: ✅ 유효
   - Preferences: {"defaultWritingStyle":"tutorial"}
```

---

## 🎯 실전 예제

### 예제 1: 간단한 포스트 작성

```
1. "authenticate 도구로 인증해줘"
   → Session ID 받기

2. "create_post 도구로 포스트를 작성해줘.
   sessionId는 '[받은 세션 ID]',
   제목은 'MCP 테스트',
   내용은 '# 테스트\n\n자동 포스팅 성공!'"
```

### 예제 2: 태그와 카테고리 포함

```
"create_post 도구로 포스트를 작성해줘.
sessionId는 '[세션 ID]',
제목은 'AI 자동 블로깅',
내용은 '# AI와 블로그\n\n자동화의 시대',
tags는 ['AI', 'Automation', 'Blog'],
category는 'Technology'"
```

### 예제 3: 글쓰기 스타일 지정

```
"create_post 도구로 포스트를 작성해줘.
sessionId는 '[세션 ID]',
제목은 'TypeScript 튜토리얼',
내용은 '# TypeScript 시작하기\n\n## 설치\n...',
writingStyle은 'tutorial'"
```

---

## 🔧 트러블슈팅

### 문제 1: "codebase_blog" 서버가 Tools에 표시되지 않음

**원인**: MCP 설정이 적용되지 않음

**해결**:
1. `~/.config/claude-code/.mcp.json` 파일 확인
2. Claude Code 완전 종료 (Cmd+Q)
3. Claude Code 재시작
4. 로그 확인: `~/.config/claude-code/logs/`

### 문제 2: Authentication URL이 열리지 않음

**원인**: Backend 서버가 실행 중이 아님

**해결**:
```bash
# 백엔드 서버 실행 확인
cd /Users/sihyungpark/Desktop/code/my-blog-app/backend
pnpm start:dev

# 확인: http://localhost:3000 접속
```

### 문제 3: Session expired 에러

**원인**: 세션이 만료됨 (기본 1시간)

**해결**:
```
# 다시 인증
"authenticate 도구로 다시 인증해줘"
```

### 문제 4: Rate limit exceeded

**원인**: 1분에 60개 요청 제한 초과

**해결**:
- 1분 대기 후 재시도
- 또는 `.env`에서 `RATE_LIMIT_MAX_REQUESTS` 값 증가

---

## 📊 사용 가능한 글쓰기 스타일

MCP 서버는 5가지 프리셋 스타일을 제공합니다:

| 스타일 | 설명 | 적합한 콘텐츠 |
|--------|------|---------------|
| `default` | 기본 블로그 포스트 | 일반 블로그 글 |
| `tutorial` | 단계별 튜토리얼 | 기술 가이드, How-to |
| `novel` | 창의적 서사 스타일 | 스토리텔링, 에세이 |
| `comedy` | 유머러스한 톤 | 재미있는 글, 풍자 |
| `podcast` | 대화형 스크립트 | 인터뷰, 대담 |

**사용 방법**:
```json
{
  "writingStyle": "tutorial"
}
```

**URL 기반 스타일**:
```json
{
  "writingStyle": "https://example.com/my-style.md"
}
```

**인라인 스타일**:
```json
{
  "writingStyle": "---\nstyle_name: \"Custom\"\n---\n\n# === INSTRUCTIONS ===\n전문적으로 작성하세요..."
}
```

---

## 🔒 보안 주의사항

### Session ID 관리
- Session ID는 민감 정보입니다 (Access Token 포함)
- 외부에 공유하지 마세요
- 기본 TTL: 1시간 (MCP_SESSION_TIMEOUT_MS)

### Redis 세션
- Redis에 OAuth 토큰이 저장됩니다
- 프로덕션에서는 Redis 암호화 권장
- `REDIS_PASSWORD` 설정 필수

### Rate Limiting
- 기본 제한: 1분에 60개 요청 (세션 또는 IP별)
- OAuth 인증: 15분에 10개 요청
- 일반 API: 1분에 30개 요청

---

## 📈 모니터링

### Health Check
```bash
curl http://localhost:8080/health | jq
```

**응답 예시**:
```json
{
  "status": "healthy",
  "uptime": { "seconds": 1234, "minutes": 20 },
  "sessions": {
    "active": 2,
    "total": 15,
    "peak": 5,
    "timedOut": 3
  },
  "limits": {
    "maxSessions": 1000,
    "sessionTimeout": { "minutes": 60 },
    "rateLimit": { "maxRequests": 60, "windowMs": 60000 }
  }
}
```

### Redis 상태 확인
```bash
redis-cli
> KEYS mcp:*
> GET mcp:session:[sessionId]
```

---

## 💡 팁

### 1. Session ID 재사용
한 번 인증받은 Session ID는 1시간 동안 재사용 가능합니다.

### 2. 배치 작업
여러 포스트를 작성할 때는 하나의 Session ID로 연속 작성 가능:
```
1. authenticate
2. create_post (포스트 1)
3. create_post (포스트 2)
4. create_post (포스트 3)
```

### 3. 기본 스타일 활용
자주 사용하는 스타일은 `set_preferences`로 기본값 설정:
```
set_preferences → defaultWritingStyle: "tutorial"
이후 create_post에서 writingStyle 생략 가능
```

### 4. 진단 먼저
문제 발생 시 `diagnose_connection`으로 먼저 확인:
- Backend API 상태
- Session 유효성
- Token 만료 여부

---

## 🎉 완료!

이제 Claude Code에서 자연어로 블로그 포스트를 자동으로 작성할 수 있습니다!

**다음 명령어를 시도해보세요**:
```
"authenticate 도구로 인증하고,
포스트를 작성해줘.
제목은 'MCP 자동 포스팅 첫 테스트',
내용은 간단한 소개글로 작성해줘"
```
