# 🛡️ codebase.blog 보안 감사 보고서

> **감사 일자**: 2026-01-05  
> **프로젝트**: codebase.blog (SaaS 블로그 플랫폼)  
> **평가 기준**: 11개 보안 카테고리 체크리스트

---

## 📊 종합 점수

| 구분 | 점수 | 등급 |
|:---|:---:|:---:|
| **코드 완성도** | **82/100** | 🟢 B+ |
| **보안 수준** | **78/100** | 🟡 B |
| **취약점 위험도** | **중간** (Medium) | 🟡 |

---

## 🔍 카테고리별 평가

### 1️⃣ 인증/인가 (AuthN/AuthZ) · 계정 보안 — 85/100 🟢

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| 비밀번호 해싱 | ✅ 양호 | bcrypt 사용 (salt round: 12) |
| Access Token 수명 | ⚠️ 개선필요 | 현재 1일 → **15분~1시간 권장** |
| Refresh Token 회전 | ✅ 양호 | DB 저장 + 만료 시간 검증 |
| Token 타입 검증 | ✅ 양호 | `tokenType: "refresh"` 검증 |
| JWT aud/iss 검증 | ⚠️ 미구현 | 토큰에 audience/issuer 없음 |
| 로그인 실패 Rate Limit | ✅ 양호 | 글로벌 RateLimitGuard 적용 |
| MFA 지원 | ✅ 양호 | 2FA(TOTP) 구현됨 |
| 리소스 소유권 체크 | ✅ 양호 | 대부분 컨트롤러에서 userId 검증 |

### 2️⃣ 멀티테넌시 방어선 — N/A

> 본 프로젝트는 **단일 테넌트** 구조입니다. 멀티테넌시 관련 항목은 해당 없음.

### 3️⃣ 백엔드 API 보안 — 80/100 🟢

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| DTO 스키마 검증 | ✅ 양호 | `ValidationPipe` 글로벌 적용 (`whitelist: true`) |
| Unknown field 거부 | ⚠️ 부분적 | `forbidNonWhitelisted: false` 설정됨 |
| 파일 업로드 MIME 검증 | ✅ 양호 | `allowedTypes` 체크 구현됨 |
| 파일 크기 제한 | ✅ 양호 | 업로드 DTO에 크기 제한 |
| 민감정보 마스킹 | ✅ 양호 | `toJSON()`에서 password/email/token 제외 |
| 에러 스택트레이스 | ✅ 양호 | 프로덕션에서 숨김 (개발 환경만 노출) |
| CSRF 방어 | ✅ 양호 | `express-session` + `sameSite: strict` |
| Rate Limiting | ✅ 양호 | `RateLimitGuard` 글로벌 적용 |
| SSRF 방어 | ✅ 양호 | `ipaddr.js`로 내부망 IP 차단 (OpenGraph) |

### 4️⃣ 프론트엔드 보안 — 85/100 🟢

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| CSP (Content Security Policy) | ✅ 양호 | nonce 기반 CSP 적용 |
| HSTS | ✅ 양호 | Helmet 기본 설정 |
| X-Content-Type-Options | ✅ 양호 | Helmet 기본 설정 |
| CORS | ✅ 양호 | allowlist 기반 (`*` 미사용) |
| 토큰 저장 | ⚠️ 개선필요 | localStorage 사용 중 (httpOnly cookie 권장) |
| XSS 방어 | ✅ 양호 | React 기본 이스케이프 + CSP |

### 5️⃣ 아키텍처/네트워크 — 75/100 🟡

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| DB 네트워크 분리 | ✅ 양호 | Docker 내부망 + pgbouncer |
| 관리자 패널 분리 | ✅ 양호 | `/admin/*` 엔드포인트 Role 검증 |
| 비밀 관리 | ✅ 양호 | `.gitignore`에 `.env*` 포함 |
| Egress 제어 | ⚠️ 개선필요 | OpenGraph만 allowlist 적용, 나머지는 무제한 |
| 서비스 간 인증 | ⚠️ 개선필요 | MCP Proxy→Backend 통신에 시크릿 없음 |

### 6️⃣ DB 보안 — 80/100 🟢

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| 쿼리 파라미터 바인딩 | ✅ 양호 | TypeORM QueryBuilder 사용 |
| Raw SQL 사용 | ⚠️ 주의 | `createQueryBuilder` 180+곳 (안전하게 사용 중) |
| 암호화 (at-rest) | ✅ 양호 | 클라우드 스토리지 기본 암호화 |
| 암호화 (in-transit) | ✅ 양호 | HTTPS + TLS |
| 백업 | ❓ 미확인 | PostgreSQL 백업 설정 확인 필요 |

### 7️⃣ 로깅/메트릭/감사 — 70/100 🟡

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| 감사 로그 (Audit) | ✅ 양호 | `AuditService` 구현됨 |
| 민감정보 로그 금지 | ✅ 양호 | AllExceptionsFilter에서 마스킹 |
| console.log 금지 | ❌ 위반 | **246개+** `console.log` 발견 (Logger 사용 권장) |
| 분산 추적 (trace_id) | ❓ 미확인 | 구현 여부 확인 필요 |
| 보안 경보 | ⚠️ 개선필요 | 자동 알림 시스템 미구현 |

### 8️⃣ 공급망/의존성 — 75/100 🟡

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| lockfile 커밋 | ✅ 양호 | `pnpm-lock.yaml` 버전 관리 |
| 취약점 스캔 (SCA) | ⚠️ 미구현 | CI에 `pnpm audit` 미포함 |
| 정적 분석 (SAST) | ⚠️ 미구현 | ESLint 보안 룰 미적용 |
| 라이선스 체크 | ⚠️ 미구현 | 의존성 라이선스 검증 없음 |

### 9️⃣ 배포/운영/런타임 — 80/100 🟢

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| CI/CD 파이프라인 | ✅ 양호 | GitHub Actions 사용 |
| 시크릿 스캐닝 | ⚠️ 미구현 | CI에 시크릿 스캔 미포함 |
| 컨테이너 root 금지 | ⚠️ 미확인 | Dockerfile 검토 필요 |
| 리소스 제한 | ✅ 양호 | docker-compose에 cpu/mem 제한 |
| 환경변수 검증 | ✅ 양호 | 배포 시 필수 변수 체크 |

### 🔟 코드 품질 (DI/SRP/클린코드) — 75/100 🟡

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| 단일 책임 원칙 (SRP) | ✅ 양호 | Controller/Service/Repository 분리 |
| 의존성 주입 (DI) | ✅ 양호 | NestJS DI 컨테이너 활용 |
| 보안 로직 중복 | ⚠️ 개선필요 | 일부 Guard 로직 중복 |
| 인가 테스트 | ⚠️ 부족 | "권한 없음" 케이스 테스트 부족 |
| 린트 룰 | ⚠️ 개선필요 | 보안 관련 ESLint 플러그인 미적용 |

### 1️⃣1️⃣ 고급 체크 (해커 수준 가정) — 70/100 🟡

| 항목 | 상태 | 비고 |
|:---|:---:|:---|
| SSRF/리다이렉트 차단 | ✅ 양호 | OpenGraph에 IP 검증 구현 |
| 파일 메타데이터 처리 | ⚠️ 미확인 | EXIF 제거 여부 확인 필요 |
| 캐시/프리뷰 공격 표면 | ⚠️ 주의 | 링크카드 OG 스크래핑 주의 필요 |
| 권한 상승 방지 | ✅ 양호 | 메서드별 Guard 적용 |
| 결제 동시성 | ⚠️ 미확인 | Idempotency key 구현 여부 확인 필요 |

---

## 🚨 위험도별 수정 포인트

### 🔴 Critical (즉시 조치 필요)

| # | 위치 | 문제 | 권장 조치 |
|:---:|:---|:---|:---|
| 1 | 없음 | - | 현재 Critical 이슈 없음 ✅ |

### 🟠 High (1주 내 조치 권장)

| # | 위치 | 문제 | 권장 조치 |
|:---:|:---|:---|:---|
| 1 | `main.ts` | Access Token 수명 1일은 너무 김 | `JWT_ACCESS_EXPIRES_IN: "15m"` ~ `"1h"` |
| 2 | `UsersController` | `/users/:id/mcp-info` 내부 API 노출 | MCP Proxy만 호출하도록 시크릿 검증 추가 |
| 3 | `PaymentWebhookController` | Stripe/Toss 웹훅 서명 미검증 | 구현 시 서명 검증 필수 |
| 4 | 프론트엔드 | 토큰 localStorage 저장 | httpOnly cookie로 전환 권장 |

### 🟡 Medium (한 달 내 조치)

| # | 위치 | 문제 | 권장 조치 |
|:---:|:---|:---|:---|
| 1 | 전체 백엔드 | `console.log` 246개+ | `Logger` 클래스로 교체 |
| 2 | `main.ts` | JWT에 `aud`/`iss` 클레임 없음 | 토큰 검증 강화 |
| 3 | `CacheController` | `/cache/health`, `/test-connection` 공개 | 관리자 전용으로 변경 or 정보 최소화 |
| 4 | CI/CD | 취약점 스캔 (SCA) 없음 | `pnpm audit` 단계 추가 |
| 5 | CI/CD | 시크릿 스캐닝 없음 | `gitleaks` 또는 GitHub Secret Scanning 활성화 |
| 6 | `ValidationPipe` | `forbidNonWhitelisted: false` | `true`로 변경하여 미정의 필드 거부 |

### 🟢 Low (향후 개선)

| # | 위치 | 문제 | 권장 조치 |
|:---:|:---|:---|:---|
| 1 | `TestBlogStatsController` | 파일은 존재하나 미로드 | 파일 삭제 권장 (불필요) |
| 2 | 에러 응답 | 일부 에러에 내부 정보 포함 가능 | 프로덕션 에러 메시지 일관성 검토 |
| 3 | 분산 추적 | `request_id`/`trace_id` 미구현 | 로그 추적성 향상 |
| 4 | 파일 업로드 | EXIF 메타데이터 처리 미확인 | 이미지 처리 시 EXIF 제거 |
| 5 | 린트 룰 | 보안 ESLint 플러그인 미적용 | `eslint-plugin-security` 추가 |

---

## ✅ 이미 해결된 사항 (이번 감사 중)

| # | 항목 | 조치 내용 |
|:---:|:---|:---|
| 1 | `/api/v1/metrics` 공개 노출 | `@Roles(Role.ADMIN)` 추가 ✅ |
| 2 | `/users/:id` 이메일 노출 | `toJSON()`에서 `email` 제외 ✅ |
| 3 | `/users/profile` 이메일 미표시 | 본인 프로필에서만 `email` 명시적 반환 ✅ |
| 4 | `SimpleTestController` 존재 | 삭제 완료 ✅ |
| 5 | `MinimalTestController` 존재 | 삭제 완료 ✅ |

---

## 📋 빠른 적용 순서 (권장)

```
1순위: Auth/테넌트 경계/권한
  └─ Access Token 수명 단축 (15분~1시간)
  └─ MCP 내부 API 시크릿 검증 추가

2순위: 입력 검증 + SSRF/업로드 + Rate Limit
  └─ forbidNonWhitelisted: true 설정
  └─ 웹훅 서명 검증 구현 (Stripe/Toss)

3순위: 로그/감사/경보
  └─ console.log → Logger 전환
  └─ 보안 경보 시스템 구축

4순위: 시크릿/네트워크 분리/Egress 제어
  └─ 서비스 간 통신 시크릿 추가
  └─ 외부 요청 allowlist 확대

5순위: 공급망/CI 게이트 + 회귀 테스트
  └─ CI에 pnpm audit 추가
  └─ gitleaks 시크릿 스캐닝 추가
  └─ 보안 린트 룰 적용
```

---

## 📝 결론

**codebase.blog**는 전반적으로 **양호한 보안 수준**을 갖추고 있습니다.

- ✅ 인증/인가 체계가 잘 구축됨 (bcrypt, 토큰 회전, MFA)
- ✅ 입력 검증 및 에러 처리가 안전함
- ✅ CSP, CORS, Helmet 등 보안 헤더 적용
- ✅ 민감정보 마스킹 및 로깅 보안 적용

**개선이 필요한 영역:**
- ⚠️ Access Token 수명 단축 필요
- ⚠️ 내부 API 보호 강화 필요 (MCP Proxy 통신)
- ⚠️ console.log 정리 및 Logger 전환
- ⚠️ CI/CD 보안 게이트 추가 필요

**Critical 수준의 취약점은 발견되지 않았습니다.** 🎉

---

*이 보고서는 코드 기반 정적 분석 결과이며, 침투 테스트(Pentest)는 포함되지 않습니다.*
