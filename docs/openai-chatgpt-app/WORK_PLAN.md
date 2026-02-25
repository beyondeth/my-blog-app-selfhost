# ChatGPT App — 작업 실행 계획 (Worktree 기반)

> **문서 버전**: v2 (2026-02-22)
> **참조**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) v5, [AGENTS.md](../../AGENTS.md)

---

## PLATFORM-TRACK

```
[PLATFORM-TRACK]
타겟: multi
작업유형: feature
공유영향 확인: YES — mcp-proxy-server/ (공유 경로)
요약: ChatGPT App 모듈 추가. 기존 /mcp, /mcp-remote 무변화. Strangler 방식.
```

---

## 브랜치 전략

```
integration/workspace (현재 0 ahead / 0 behind ✅)
  └── feature/integ/chatgpt-app
        ↓ (완료 후 --no-ff 머지)
      integration/workspace → main
```

---

## Phase 1: 라우트 분리 (handler 추출 없음)

> **이 Phase만으로 ChatGPT App이 동작합니다.**

### Step 1-0: 브랜치 생성

```bash
cd /Users/sihyungpark/Desktop/code/my-blog-app-integ
git checkout -b feature/integ/chatgpt-app
```

### Step 1-1: `oauth/index.ts` 수정 (최소 변경)

| 변경 | 내용 |
|------|------|
| `oauthMiddleware` export 승격 | `function` → `export function` |
| `createOAuthRouter` 반환값에 `storage` 추가 | `/mcp-openai`에서 토큰 검증 시 필요 |
| 파일 상단 주석 보강 | "Claude 커스텀 커넥터용" → "OAuth 공유 (Skills, Claude, ChatGPT App, 기타)" |

**DOD**: `pnpm tsc --noEmit` 통과 + `/mcp-remote` Skills 호출 정상

### Step 1-2: `config/env.validation.ts` 수정

| 변경 | 내용 |
|------|------|
| `OPENAI_APP_ENABLED` 환경변수 추가 | `process.env.OPENAI_APP_ENABLED === 'true'` |

### Step 1-3: `index.ts` 수정 (4건)

| 변경 | 위치 | 내용 |
|------|------|------|
| skipBodyParsing | L64 | `/mcp-openai` 추가 |
| mcpPaths (CORS) | L97 | `/mcp-openai` 추가 |
| 라우터 마운트 | L272 이후 | `app.use('/mcp-openai', ...)` (feature flag 조건부) |
| 주석 보강 | 여러 곳 | `/mcp-remote` 사용처 정확 기술 |

**DOD**: 기존 3경로 정상 + TypeScript 통과

### Step 1-4~1-7: `platforms/openai-app/` 모듈 생성 (신규 파일만)

| 파일 | 역할 |
|------|------|
| `AnnotationConfig.ts` | readOnly/openWorld/destructive 정의 |
| `ToolRegistrar.ts` | 기존 handler 직접 import + email 제거 adapter |
| `OpenAiServerFactory.ts` | MCP 서버 + tool 등록 팩토리 |
| `index.ts` | Express 라우터 (oauthMiddleware, getUserInfo 재사용) |

> MVP tool 3개만: `check_auth`, `get_writing_style_guide`, `create_post`

### Step 1-8: 검증 스크립트

| 파일 | 역할 |
|------|------|
| `scripts/verify-openai-app-contract.mjs` | `/mcp-openai` 전용 계약 검증 (3 tools, annotations 포함) |

### Phase 1 최종 검증

```bash
# 1. TypeScript 컴파일
pnpm --dir mcp-proxy-server tsc --noEmit

# 2. 기존 경로 회귀 — 동치성 스크립트
node scripts/verify-tool-parity.mjs

# 3. Skills(MCPorter) 정상 확인
npx -y mcporter call codebase-blog-oauth.check_auth

# 4. 신규 경로 검증
OPENAI_APP_ENABLED=true pnpm --dir mcp-proxy-server dev &
curl -s http://localhost:3002/mcp-openai | jq .tools
node scripts/verify-openai-app-contract.mjs

# 5. MCP Inspector 테스트
npx @modelcontextprotocol/inspector@latest \
  --server-url http://localhost:3002/mcp-openai --transport http
```

**커밋**: `feat(mcp): add /mcp-openai ChatGPT App route with feature flag`

---

## Phase 2: handler 추출 (Phase 1 안정화 후)

> Phase 1이 **프로덕션에서 안정 동작** 확인 후 진행.

| 단계 | 작업 |
|------|------|
| 2-1 | `core/types.ts` — ToolContext, ToolResult 추출 |
| 2-2 | `core/handlers/shared.ts` — 4개 helper 이동 |
| 2-3 | `core/handlers/*.ts` — 5개 handler 이동 |
| 2-4 | `tools/index.ts` → core/handlers/ re-export |
| 2-5 | 3가지 검증 반복 (parity + skills + openai contract) |

**커밋**: `refactor(mcp): extract tool handlers to core/handlers/`

---

## Phase 3: React 위젯 (2차 개선)

MVP text-first 출시 후, 심사 통과 확인 후 추가.

---

## 주의 사항

> [!CAUTION]
> - **Phase 1 검증 실패 시 즉시 중단** — 기존 경로 깨지면 커밋하지 않음
> - **Phase 1 ↔ Phase 2 동시 진행 금지** — 회귀 원인 분리 불가
> - **환경 변수 추가 시** → `WORKTREE_STATUS.md` + `CHANGELOG.md` 업데이트
> - **다른 워크트리에서 mcp-proxy-server/ 수정 금지**
