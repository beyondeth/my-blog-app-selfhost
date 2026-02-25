# Codebase.blog → ChatGPT App 출시 구현 계획

> **문서 버전**: v5 (2026-02-22)
> **목표**: 기존 `mcp-proxy-server`에 OpenAI ChatGPT App 전용 모듈을 추가하여 공식 출시
> **변경 이력**: v4 → v5: 코드 리뷰 반박 문서 4건 Critical + 4건 Major + 2건 Medium 반영

---

## 확정된 결정 사항

| # | 항목 | 결정 |
|---|------|------|
| 1 | 폴더 구조 | `platforms/openai-app/` 분리 |
| 2 | 리팩토링 순서 | **Strangler 방식** — Phase 1: 라우트 먼저 → Phase 2: handler 추출 |
| 3 | 위젯 프레임워크 | React (OpenAI 공식 예제 기반) |
| 4 | 엔드포인트 경로 | `/mcp-openai` |
| 5 | Privacy Policy | ✅ `https://codebase.blog/privacy` (이미 존재) |
| 6 | OpenAI Platform 계정 | 기존 ChatGPT 개인 계정으로 platform.openai.com 로그인 |

---

## 핵심 원칙

> [!CAUTION]
> ### 리팩토링 안전 — Strangler 방식 채택
> 대규모 파일 이동과 신규 라우트 추가를 **동시에 하지 않습니다.**
> 1. **Phase 1**: `/mcp-openai` 라우트 추가 + 기존 handler **직접 호출** (추출 없음)
> 2. **Phase 2**: 안정화 확인 후 `core/handlers/` 추출 + re-export
>
> 이유: 경로 추가와 대규모 파일 이동을 분리해야 **회귀 분석**이 쉽고, Phase 1 만으로 ChatGPT App이 동작합니다.

> [!IMPORTANT]
> ### `/mcp-remote` 사용처 (Claude 전용 아님)
> - **Skills (MCPorter)**: `mcporter` → `/mcp-remote` (OAuth)
> - **Claude 커스텀 커넥터**: Claude Desktop → `/mcp-remote` (OAuth)
> - **기타 OAuth 클라이언트**: MCP Auth Spec 준수 모든 클라이언트

---

## Critical Findings 대응 (4건 모두 반영)

### Critical-1: `oauthMiddleware` 미export ✅

**문제**: `oauth/index.ts:39`의 `oauthMiddleware`는 파일 내부 함수이며 `export`되지 않음. 문서 예시대로 import하면 **컴파일 실패**.

**해결**: `oauthMiddleware`를 **export 가능한 형태로 승격** (기존 동작 무변화).

```diff
 // oauth/index.ts
-async function oauthMiddleware(
+export async function oauthMiddleware(
   storage: OAuthStorage,
   req: Request,
   res: Response,
   next: NextFunction
 ): Promise<void> {
```

> `/mcp-remote` 라우터의 기존 호출부 `await oauthMiddleware(storage, req, res, () => {})` (L187) 동작은 변하지 않습니다.

추가로, `/mcp-openai`에서 호출할 때 `OAuthStorage` 인스턴스도 필요하므로, `createOAuthRouter` 반환값에 `storage` 인스턴스를 추가하거나, 별도 팩토리 함수를 제공합니다:

```diff
 export function createOAuthRouter(redis: Redis, metricsService: MetricsService): {
   wellKnownRouter: Router;
   oauthRouter: Router;
   mcpRemoteRouter: Router;
+  storage: OAuthStorage;      // /mcp-openai 에서 oauthMiddleware 호출에 필요
 } {
   const storage = new OAuthStorage(redis);
   // ...
-  return { wellKnownRouter, oauthRouter, mcpRemoteRouter };
+  return { wellKnownRouter, oauthRouter, mcpRemoteRouter, storage };
 }
```

---

### Critical-2: `skipBodyParsing`에 `/mcp-openai` 누락 위험 ✅

**문제**: `index.ts:64`의 `skipBodyParsing = ['/mcp', '/mcp-remote']`에 `/mcp-openai`를 추가하지 않으면 `StreamableHTTPServerTransport`가 이미 파싱된 body를 받아 **요청 처리 실패**.

**해결**: `/mcp-openai` 추가.

```diff
 // index.ts:64
-const skipBodyParsing = ['/mcp', '/mcp-remote'];
+// StreamableHTTPServerTransport가 raw stream을 직접 읽는 MCP 엔드포인트
+// ⚠️ 새 MCP 엔드포인트 추가 시 반드시 이 목록에도 추가할 것
+const skipBodyParsing = ['/mcp', '/mcp-remote', '/mcp-openai'];
```

---

### Critical-3: CORS `mcpPaths`에 `/mcp-openai` 누락 위험 ✅

**문제**: `index.ts:97`의 `mcpPaths`에 `/mcp-openai`가 없으면 ChatGPT에서 **preflight(OPTIONS) 요청 차단**.

**해결**: `/mcp-openai` 추가.

```diff
 // index.ts:97
-const mcpPaths = ['/mcp', '/mcp-remote', '/oauth', '/.well-known'];
+// Bearer 토큰으로 보호되므로 모든 origin 허용하는 엔드포인트
+// ⚠️ 새 MCP 엔드포인트 추가 시 반드시 이 목록에도 추가할 것
+const mcpPaths = ['/mcp', '/mcp-remote', '/mcp-openai', '/oauth', '/.well-known'];
```

---

### Critical-4: 핸들러-helper 강결합 → Phase 순서 변경으로 해결 ✅

**문제**: `tools/index.ts`의 핸들러가 내부 helper 4개와 강결합.
- `buildBackendAuthHeaders` (L423)
- `toPublicPostUrl` (L407)
- `toPublicBlogUrl` (L417)
- `incrementPostsCreated` (L593)

"한 줄도 변경 없음"으로 이동하는 것은 **현실적으로 불가능**.

**해결**: **Strangler 방식** — Phase 1에서는 handler 추출을 **보류**하고 기존 handler를 직접 import해서 호출. Phase 2에서 기존 경로 안정 확인 후 추출.

```
Phase 1 (라우트 분리): /mcp-openai → 기존 registerAllTools 직접 사용
Phase 2 (handler 추출): core/handlers/ 분리 + re-export (Phase 1 안정화 후)
```

---

## Major Findings 대응 (4건)

### Major-1: 위젯 브리지 비표준 위험

**문제**: `window.postMessage` + `ui/notifications/tool-result` 방식이 Apps SDK 공식 계약과 불일치 가능.

**해결**: 구현 시점에 OpenAI 공식 `@openai/apps-sdk-ui` 패키지의 bridge 계약을 기준으로 구현. `_meta["openai/outputTemplate"]`, `_meta["openai/widgetDescription"]` 등 **공식 reference 우선**. 자체 postMessage는 fallback으로만. MVP에서 위젯 없이 **text-first** 접근하고, 위젯은 2차 개선으로 분리 가능.

---

### Major-2: MVP Tool 범위 축소

**문제**: 5개 전체 등록 시 이미지 2-step(upload→finalize) UX가 복잡해 심사 리스크 상승.

**해결**: MVP는 **3개**로 출시 + 이미지 tool은 2차.

| MVP (1차 출시) | 2차 추가 |
|---|---|
| `check_auth` | `get_image_upload_url` |
| `get_writing_style_guide` | `finalize_uploaded_image` |
| `create_post` | |

---

### Major-3: check_auth 개인정보 최소화

**문제**: `tools/index.ts:252`에서 이메일 노출 (`${context.userData.user.email}`).

**해결**: `/mcp-openai` 전용 adapter에서 이메일 제거. 기존 `/mcp`, `/mcp-remote`는 현재 응답 유지.

```typescript
// platforms/openai-app/ToolRegistrar.ts
// check_auth 응답에서 이메일 제거 (ChatGPT surface 전용)
const text = `✅ *** CODEBASE.BLOG 유저 인증이 완료됨 ***
✅ ${context.userData.user.username}
✅ 블로그 주소 : ${publicBlogUrl}
✅ 인증 방식 : OAuth 2.1`;
// email 필드 노출하지 않음
```

---

### Major-4: `verify-tool-parity.mjs` 영향

**문제**: 기존 스크립트는 `/mcp` ↔ `/mcp-remote` 동치성을 검증. `/mcp-openai`는 3개 tool만 등록하므로 **의도적 불일치**.

**해결**: 별도 검증 스크립트 추가.

```bash
# 기존 (유지) — /mcp ↔ /mcp-remote 동치성
node scripts/verify-tool-parity.mjs

# 신규 추가 — /mcp-openai 전용 계약 검증
node scripts/verify-openai-app-contract.mjs
```

---

## Medium Findings 대응 (2건)

| # | 문제 | 해결 |
|---|------|------|
| M-1 | `index.ts` diff에서 import가 블록 중간 | top-level import로 정리 |
| M-2 | Stage 3 "API Playground" 과대평가 | 보조 검증으로 격하, Developer Mode가 최종 기준 |

---

## 추가 개선 사항 반영

### Feature Flag 도입

```typescript
// config/env.validation.ts 에 추가
OPENAI_APP_ENABLED: process.env.OPENAI_APP_ENABLED === 'true' || false,
```

```typescript
// index.ts 에서 조건부 마운트
if (config.OPENAI_APP_ENABLED) {
  const openAiAppRouter = createOpenAiAppRouter(storage, metricsService);
  app.use('/mcp-openai', openAiAppRouter);
  logger.info('🤖 OpenAI ChatGPT App enabled at /mcp-openai');
}
```

### 운영 메트릭 route 라벨 분리

```typescript
// 기존 metricsService.recordRequest('success') 에 route 라벨 추가
metricsService.recordRequest('success', toolName, 'mcp-openai');
// 기존 /mcp, /mcp-remote 는 기존 호출 유지 (호환성 보호)
```

### Text-First Fallback

위젯 렌더 실패해도 `content` 텍스트만으로 작업 완료 가능하도록 설계:
```typescript
return {
  content: [{ type: 'text', text: '✅ Post created: ...' }],  // 항상 제공
  structuredContent: { ... },                                   // 위젯용 (optional)
};
```

---

## 폴더 구조 (v5)

```
mcp-proxy-server/src/
│
├── index.ts                            # [MODIFY] 아래 4건 수정
│                                       #   1. skipBodyParsing에 /mcp-openai 추가
│                                       #   2. mcpPaths(CORS)에 /mcp-openai 추가
│                                       #   3. /mcp-openai 라우터 마운트 (feature flag)
│                                       #   4. /mcp-remote 주석 보강
│
├── config/
│   └── env.validation.ts               # [MODIFY] OPENAI_APP_ENABLED 추가
│
├── platforms/                          # [NEW] 플랫폼별 어댑터
│   └── openai-app/
│       ├── index.ts                    # Express 라우터 팩토리
│       ├── OpenAiServerFactory.ts      # MCP 서버 생성 + tool 등록
│       ├── ToolRegistrar.ts            # 기존 handler 직접 호출 + adapter 래핑
│       ├── AnnotationConfig.ts         # Tool Annotations
│       └── widget/                     # React 위젯 (2차 개선)
│           └── ...
│
├── oauth/
│   └── index.ts                        # [MODIFY] oauthMiddleware export 승격
│                                       #          createOAuthRouter 반환에 storage 추가
│                                       #          주석: "Claude 전용" → "OAuth 공유"
│
├── scripts/
│   └── verify-openai-app-contract.mjs  # [NEW] /mcp-openai 전용 계약 검증
│
├── tools/                              # Phase 1에서 변경 없음
├── services/                           # 변경 없음
└── utils/                              # 변경 없음
```

---

## 구현 Phase (Strangler 방식)

### Phase 1: 라우트 분리 먼저 (handler 추출 없음)

> 이 Phase만으로 ChatGPT App이 동작합니다.

| 단계 | 파일 | 작업 | DOD |
|------|------|------|-----|
| 1-0 | `feature/integ/chatgpt-app` | 브랜치 생성 | 브랜치 존재 |
| 1-1 | `oauth/index.ts` | `oauthMiddleware` export 승격 + `storage` 반환 추가 + 주석 보강 | tsc 통과 + `/mcp-remote` 정상 |
| 1-2 | `config/env.validation.ts` | `OPENAI_APP_ENABLED` 추가 | tsc 통과 |
| 1-3 | `index.ts` | skipBodyParsing + mcpPaths + 라우터 마운트 + 주석 보강 | tsc 통과 + 기존 경로 정상 |
| 1-4 | `platforms/openai-app/AnnotationConfig.ts` | Tool Annotations 정의 | — |
| 1-5 | `platforms/openai-app/ToolRegistrar.ts` | 기존 handler **직접 호출** + email 제거 adapter | — |
| 1-6 | `platforms/openai-app/OpenAiServerFactory.ts` | MCP 서버 팩토리 | — |
| 1-7 | `platforms/openai-app/index.ts` | Express 라우터 | — |
| 1-8 | `scripts/verify-openai-app-contract.mjs` | 전용 계약 검증 스크립트 | — |

**Phase 1 검증 (DOD)**:
```bash
# 1. TypeScript 컴파일
pnpm --dir mcp-proxy-server tsc --noEmit

# 2. 기존 경로 회귀 테스트
node scripts/verify-tool-parity.mjs              # /mcp ↔ /mcp-remote 동치성
OPENAI_APP_ENABLED=true pnpm --dir mcp-proxy-server dev &
npx -y mcporter call codebase-blog-oauth.check_auth  # Skills 경로 정상

# 3. 신규 경로 검증
node scripts/verify-openai-app-contract.mjs       # /mcp-openai 전용 계약
curl -s http://localhost:3002/mcp-openai | jq .tools
```

**커밋**: `feat(mcp): add /mcp-openai ChatGPT App route with feature flag`

---

### Phase 2: handler 추출 (Phase 1 안정화 후)

> Phase 1이 프로덕션에서 안정 동작 확인 후 진행.

| 단계 | 파일 | 작업 |
|------|------|------|
| 2-1 | `core/types.ts` | ToolContext, ToolResult 타입 추출 |
| 2-2 | `core/handlers/shared.ts` | 공유 helper 이동 (4개 함수) |
| 2-3 | `core/handlers/*.ts` | 각 handler 이동 |
| 2-4 | `core/handlers/index.ts` | barrel re-export |
| 2-5 | `tools/index.ts` | core/handlers/ import → re-export |
| 2-6 | `platforms/openai-app/ToolRegistrar.ts` | core/handlers/ import로 변경 |

**Phase 2 검증**: Phase 1과 동일한 3가지 체크 반복.

**커밋**: `refactor(mcp): extract tool handlers to core/handlers/ with re-export compatibility`

---

### Phase 3: React 위젯 (2차 개선)

MVP에서는 text-first로 출시하고, 위젯은 심사 통과 후 추가.

---

## OpenAI Platform 계정 안내

> **OpenAI Platform** = 기존 ChatGPT 계정과 동일합니다.
> [platform.openai.com](https://platform.openai.com) 에 로그인 → Organization 생성/확인 → 개인 검증 완료 → Owner 역할 확인.
> 앱 관리: [platform.openai.com/apps-manage](https://platform.openai.com/apps-manage)

---

## 테스트 환경

| 단계 | 도구 | 용도 | 비고 |
|------|------|------|------|
| **1차** | MCP Inspector | Tool 호출/응답 검증 | 로컬 즉시 가능 |
| **2차 (최종)** | ChatGPT Developer Mode | OAuth + Tool 선택 + 전체 UX | ngrok 필요 |
| **보조** | API Playground | JSON 로우 로그 | 위젯 미지원 |

---

## 제출 체크리스트

| # | 항목 | 상태 |
|---|------|------|
| 1 | OpenAI Platform Organization 검증 | ☐ |
| 2 | MCP 서버 공개 HTTPS 배포 | ☐ |
| 3 | CSP 설정 | ☐ |
| 4 | Tool Annotations + 심사 근거 | ☐ |
| 5 | Privacy Policy (`https://codebase.blog/privacy`) | ✅ |
| 6 | 테스트 계정 + 샘플 데이터 | ☐ |
| 7 | `platform.openai.com/apps-manage` 제출 | ☐ |
