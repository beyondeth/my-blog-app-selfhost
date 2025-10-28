# Legal 문서 Cloudflare 캐싱 가이드

> 새로운 개발자를 위한 Legal 문서 캐싱 시스템 완벽 가이드

**최종 업데이트**: 2025년 1월 29일
**대상**: 프론트엔드/백엔드 개발자, DevOps

---

## 📋 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [파일 구조](#파일-구조)
4. [Cloudflare 설정 가이드](#cloudflare-설정-가이드)
5. [문서 업데이트 절차](#문서-업데이트-절차)
6. [검증 및 테스트](#검증-및-테스트)
7. [트러블슈팅](#트러블슈팅)
8. [FAQ](#faq)
9. [부록](#부록)

---

## 개요

### 무엇인가요?

Legal 문서(이용약관, 개인정보처리방침 등)를 Cloudflare CDN에서 캐싱하여:
- ⚡ **응답 속도 개선**: ~10ms (Edge) vs ~200ms (Origin)
- 💰 **비용 절감**: Origin 서버 부하 감소
- 🔄 **자동 버전 관리**: 파일명 변경 시 자동 캐시 갱신

### 왜 필요한가요?

**기존 문제점**:
```
사용자 → Next.js 서버 → Markdown 파일 읽기 → 렌더링 → 응답
└─ 매번 서버 부하 발생
```

**개선된 방식**:
```
사용자 → Cloudflare Edge (캐시 HIT) → 즉시 응답
└─ Origin 서버 접근 불필요 (99% 요청)
```

### 주요 이점

| 항목 | 기존 | 개선 후 |
|------|------|---------|
| 응답 시간 | ~200ms | ~10ms |
| Origin 부하 | 100% | <1% |
| 대역폭 비용 | 높음 | 낮음 |
| 캐시 무효화 | 수동 Purge | 자동 (URL 변경) |

---

## 시스템 아키텍처

### 전체 플로우

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │ GET /legal/privacy
       ↓
┌─────────────────────┐
│  Cloudflare Edge    │
│  (전 세계 300+ PoP) │
└──────┬──────────────┘
       │
       ├─ 캐시 HIT (99%) → 즉시 응답 ✅
       │
       └─ 캐시 MISS (1%) → Origin 요청
                              ↓
                   ┌──────────────────┐
                   │  Next.js Server  │
                   │  (codebase.blog) │
                   └──────────────────┘
                              ↓
                   /public/legal/ko/privacy-policy-20251029-v1.0.md
```

### 버전 관리 방식

**파일명에 버전 포함**:
```
{문서타입}-{날짜YYYYMMDD}-v{major}.{minor}.md

예시: privacy-policy-20251029-v1.0.md
      ↑            ↑         ↑
      문서명       날짜      버전
```

**자동 캐시 무효화 메커니즘**:
```
1. 문서 업데이트
2. legalVersions.ts에서 버전 변경
   PRIVACY: '20251029-v1.0' → '20251030-v1.1'
3. 새 파일명 생성
   privacy-policy-20251030-v1.1.md
4. 새 URL 생성 (Cloudflare가 새로운 캐시 엔트리로 인식)
   /legal/ko/privacy-policy-20251029-v1.0.md (구버전, 만료 대기)
   /legal/ko/privacy-policy-20251030-v1.1.md (신버전, 새 캐시)
```

---

## 파일 구조

### 디렉토리 레이아웃

```
my-blog-app/
├── frontend/
│   ├── public/
│   │   └── legal/
│   │       └── ko/                          # 법적 문서 저장소
│   │           ├── privacy-policy-20251029-v1.0.md
│   │           ├── terms-of-service-20251029-v1.0.md
│   │           ├── community-guidelines-20251029-v1.0.md
│   │           ├── marketing-consent-20251029-v1.0.md
│   │           └── newsletter-consent-20251029-v1.0.md
│   │
│   └── src/
│       ├── constants/
│       │   └── legalVersions.ts             # 🔑 중앙 버전 관리 파일
│       │
│       ├── app/
│       │   └── legal/
│       │       ├── privacy/page.tsx          # 개인정보처리방침 페이지
│       │       ├── terms/page.tsx            # 이용약관 페이지
│       │       ├── guidelines/page.tsx       # 커뮤니티 가이드라인
│       │       ├── marketing-consent/page.tsx
│       │       └── newsletter-consent/page.tsx
│       │
│       └── components/
│           └── legal/
│               ├── LegalPageLayout.tsx       # Legal 페이지 공통 레이아웃
│               └── MarkdownRenderer.tsx      # Markdown 렌더링
│
└── docs/
    └── LEGAL_CACHING.md                     # 이 문서
```

### 핵심 파일 설명

#### 1. `/frontend/src/constants/legalVersions.ts` (중앙 버전 관리)

```typescript
/**
 * Legal 문서 버전 중앙 관리
 * 문서 업데이트 시 이 파일만 수정하면 모든 링크가 자동으로 업데이트됩니다.
 */
export const LEGAL_VERSIONS = {
  PRIVACY: '20251029-v1.0',      // 개인정보처리방침
  TERMS: '20251029-v1.0',        // 이용약관
  GUIDELINES: '20251029-v1.0',   // 커뮤니티 가이드라인
  MARKETING: '20251029-v1.0',    // 마케팅 정보 수신 동의
  NEWSLETTER: '20251029-v1.0',   // 뉴스레터 수신 동의
} as const;

/**
 * Legal 문서 파일 경로 생성 헬퍼 함수
 */
export function getLegalFilePath(
  type: keyof typeof LEGAL_VERSIONS,
  lang: 'ko' | 'en' = 'ko'
): string {
  const typeMap = {
    PRIVACY: 'privacy-policy',
    TERMS: 'terms-of-service',
    GUIDELINES: 'community-guidelines',
    MARKETING: 'marketing-consent',
    NEWSLETTER: 'newsletter-consent',
  };

  const fileName = typeMap[type];
  const version = LEGAL_VERSIONS[type];

  return `/legal/${lang}/${fileName}-${version}.md`;
}
```

#### 2. `/frontend/src/components/legal/LegalPageLayout.tsx`

버전 관리된 Markdown 파일을 직접 fetch하여 렌더링:

```typescript
// 버전 관리 시스템: /public/legal/ko 에서 직접 로드
const filePath = getLegalFilePath(versionKey, 'ko');
const response = await fetch(filePath);  // Cloudflare 캐시에서 응답

const markdown = await response.text();
setContent(markdown);
```

---

## Cloudflare 설정 가이드

### 사전 준비

- [ ] Cloudflare 계정 및 도메인 연결 완료
- [ ] Cache Rules 접근 권한 (Zone 편집 권한 필요)
- [ ] 기존 "Public Folder Static Assets" 규칙 존재 확인

### Step 1: Cloudflare Dashboard 접속

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. `codebase.blog` 도메인 선택
3. 좌측 메뉴에서 **Caching** → **Cache Rules** 클릭

### Step 2: 기존 규칙 확인

**현재 존재하는 규칙**: "Public Folder Static Assets"

현재 설정 내용:
```
Rule name: Public Folder Static Assets

If incoming requests match:
  (http.host eq "www.codebase.blog" and
   (starts_with(http.request.uri.path, "/fonts/") or
    starts_with(http.request.uri.path, "/character/") or
    starts_with(http.request.uri.path, "/assets/")))

Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 year
  - Browser TTL: 1 year
  - Status code TTL:
    - 200-299: 1 year
    - 404: No cache
    - 500-599: No cache
```

### Step 3: 규칙 수정

1. "Public Folder Static Assets" 규칙 우측 **Edit** 버튼 클릭

2. **"When incoming requests match…"** 섹션 찾기

3. Expression 수정:

   **변경 전**:
   ```
   (http.host eq "www.codebase.blog" and
     (starts_with(http.request.uri.path, "/fonts/") or
      starts_with(http.request.uri.path, "/character/") or
      starts_with(http.request.uri.path, "/assets/")))
   ```

   **변경 후** (마지막 줄에 `/legal/` 추가):
   ```
   (http.host eq "www.codebase.blog" and
     (starts_with(http.request.uri.path, "/fonts/") or
      starts_with(http.request.uri.path, "/character/") or
      starts_with(http.request.uri.path, "/assets/") or
      starts_with(http.request.uri.path, "/legal/")))
   ```

4. **나머지 설정은 그대로 유지**:
   - ✅ Edge TTL: 1 year
   - ✅ Browser TTL: 1 year
   - ✅ Status code TTL: 동일

5. **Save** 버튼 클릭

### Step 4: 배포 확인

- 저장 후 약 **30초 내** 전 세계 Cloudflare Edge에 배포됨
- 별도의 배포 작업 불필요

---

## 문서 업데이트 절차

### 시나리오: 개인정보처리방침 업데이트

#### 1. 새 Markdown 파일 작성

```bash
# 현재 버전 확인
cat frontend/src/constants/legalVersions.ts
# PRIVACY: '20251029-v1.0'

# 새 파일 생성 (버전 증가)
cp frontend/public/legal/ko/privacy-policy-20251029-v1.0.md \
   frontend/public/legal/ko/privacy-policy-20251029-v1.1.md

# 내용 수정
vim frontend/public/legal/ko/privacy-policy-20251029-v1.1.md
```

#### 2. 버전 상수 업데이트

```bash
vim frontend/src/constants/legalVersions.ts
```

```typescript
export const LEGAL_VERSIONS = {
  PRIVACY: '20251029-v1.1',  // ← 버전 변경
  TERMS: '20251029-v1.0',
  // ...
} as const;
```

#### 3. 로컬 테스트

```bash
# 개발 서버 실행
cd frontend
pnpm dev

# 브라우저에서 확인
open http://localhost:3001/legal/privacy
```

**확인 사항**:
- ✅ 새 내용이 표시되는가?
- ✅ 404 에러가 없는가?
- ✅ 링크가 올바른가?

#### 4. 배포

```bash
# 변경 사항 커밋
git add .
git commit -m "docs: Update privacy policy to v1.1"

# 프로덕션 배포
git push origin main

# 또는 Docker 빌드
cd frontend
docker build -t my-blog-frontend:latest .
```

#### 5. 프로덕션 검증

```bash
# 첫 요청 (MISS)
curl -I https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.1.md

# 예상 응답:
# cf-cache-status: MISS

# 두 번째 요청 (HIT)
curl -I https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.1.md

# 예상 응답:
# cf-cache-status: HIT
# cache-control: public, max-age=31536000
```

### 버전 번호 규칙

**날짜 변경**:
- 새로운 날짜에 작성: `20251029` → `20251030`

**버전 변경**:
- **Minor 변경** (v1.0 → v1.1): 경미한 수정 (오타, 문구 개선)
- **Major 변경** (v1.0 → v2.0): 중요한 내용 변경 (정책 변경, 법적 개정)

**예시**:
```
privacy-policy-20251029-v1.0.md  (최초 작성)
privacy-policy-20251029-v1.1.md  (오타 수정)
privacy-policy-20251030-v1.0.md  (다음 날 작성)
privacy-policy-20251030-v2.0.md  (중요 정책 변경)
```

---

## 검증 및 테스트

### 1. curl로 캐시 헤더 확인

```bash
# Legal 문서 캐시 확인
curl -I https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md
```

**예상 응답**:
```http
HTTP/2 200
date: Wed, 29 Jan 2025 12:00:00 GMT
content-type: text/markdown; charset=utf-8
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT
cf-ray: 8a1b2c3d4e5f-ICN
age: 3600
```

**주요 헤더 설명**:
| 헤더 | 의미 |
|------|------|
| `cf-cache-status: HIT` | Cloudflare 캐시에서 응답 (성공) |
| `cf-cache-status: MISS` | Origin에서 응답 (첫 요청 시 정상) |
| `cache-control: max-age=31536000` | 브라우저 캐시 1년 |
| `age: 3600` | 캐시된 지 1시간 경과 |

### 2. 브라우저 DevTools 확인

1. Chrome DevTools 열기 (F12)
2. **Network** 탭 선택
3. `/legal/privacy` 페이지 방문
4. Markdown 파일 요청 찾기
5. **Headers** 탭에서 확인:
   - Response Headers → `cf-cache-status: HIT`
   - General → Size: `(from disk cache)` 또는 `(from memory cache)`

### 3. Cloudflare Analytics 모니터링

**접속**: Cloudflare Dashboard → **Analytics** → **Caching**

**확인 항목**:
- **Cache Hit Ratio**: 목표 95% 이상
- **Bandwidth Saved**: Origin 트래픽 절감량
- **Requests by Cache Status**:
  - HIT: 95%+
  - MISS: 5%-
  - EXPIRED/STALE: 거의 없음

**24시간 후 확인**:
```
Total Requests: 10,000
├─ HIT:    9,800 (98%)  ✅ 우수
├─ MISS:     180 (1.8%)
└─ BYPASS:    20 (0.2%)
```

### 4. 성능 측정

```bash
# 응답 시간 측정
time curl -s https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md > /dev/null

# 예상 결과 (Edge HIT):
# real    0m0.012s  ← 12ms (우수)

# 예상 결과 (Origin MISS):
# real    0m0.203s  ← 203ms
```

---

## 트러블슈팅

### 문제 1: `cf-cache-status: BYPASS` 표시

**증상**: Cloudflare가 캐싱을 우회함

**원인**:
- Cache Rule이 적용되지 않음
- Expression이 잘못됨

**해결**:
1. Cloudflare Dashboard → Cache Rules 확인
2. Expression에 `/legal/` 경로가 포함되어 있는지 확인
3. `http.host eq "www.codebase.blog"` 조건 확인 (서브도메인 일치 필요)

```bash
# 현재 Expression 테스트
curl -H "Host: www.codebase.blog" \
  https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md
```

### 문제 2: 구 버전이 계속 표시됨

**증상**: `legalVersions.ts` 업데이트했는데 이전 문서가 보임

**원인**:
- 브라우저 캐시
- 새 파일을 생성하지 않음

**해결**:
```bash
# 1. 새 파일이 생성되었는지 확인
ls -la frontend/public/legal/ko/ | grep privacy-policy

# 2. legalVersions.ts의 버전 확인
cat frontend/src/constants/legalVersions.ts | grep PRIVACY

# 3. 브라우저 강력 새로고침 (캐시 무시)
# Chrome: Cmd+Shift+R (Mac) 또는 Ctrl+Shift+R (Windows)

# 4. 프로덕션 배포 확인
curl https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.1.md
```

### 문제 3: 404 Not Found

**증상**: Legal 페이지 접속 시 404 에러

**원인**:
- 파일명 불일치
- 파일이 배포되지 않음

**해결**:
```bash
# 1. 로컬 파일 존재 확인
ls frontend/public/legal/ko/privacy-policy-20251029-v1.0.md

# 2. legalVersions.ts와 파일명 일치 확인
cat frontend/src/constants/legalVersions.ts

# 3. Next.js 빌드 디렉토리 확인
ls frontend/.next/static/

# 4. Docker 컨테이너 내부 확인 (배포 후)
docker exec -it my-blog-frontend ls /app/public/legal/ko/
```

### 문제 4: TTL이 너무 짧음

**증상**: `cache-control: max-age=3600` (1시간)으로 표시

**원인**:
- Cloudflare Edge TTL 설정이 1년이 아님
- Origin에서 짧은 TTL 전송

**해결**:
1. Cloudflare Dashboard → Cache Rules
2. "Public Folder Static Assets" 규칙 확인
3. **Edge TTL** 설정 확인:
   - ✅ "Ignore cache-control header and use this TTL" → 1 year
4. **Status code TTL** 확인:
   - ✅ 200-299: 1 year

### 문제 5: Cloudflare 규칙이 너무 많음

**증상**: 3개 규칙 제한 도달 (무료 플랜)

**해결**:
- Legal 문서는 **기존 규칙에 추가** (권장)
- 또는 유료 플랜 업그레이드 (Pro: $20/월, 20개 규칙)

**규칙 통합 예시**:
```
규칙 1: Public Static Assets (fonts, character, assets, legal)
규칙 2: API Bypass (api/v1/)
규칙 3: Dynamic Pages (default)
```

---

## FAQ

### Q1: 문서 수정 시 캐시 퍼지(Purge)가 필요한가요?

**A**: ❌ **필요 없습니다.**

파일명에 버전이 포함되어 있어 URL이 변경되므로, Cloudflare는 자동으로 새 캐시 엔트리를 생성합니다.

```
구버전: /legal/ko/privacy-policy-20251029-v1.0.md (계속 캐시됨)
신버전: /legal/ko/privacy-policy-20251029-v1.1.md (새 캐시)
```

구버전은 1년 후 자동으로 만료되거나, 아무도 요청하지 않으면 자연스럽게 삭제됩니다.

---

### Q2: 버전 번호는 어떻게 정하나요?

**A**: **날짜-버전** 조합 사용

| 상황 | 버전 형식 | 예시 |
|------|----------|------|
| 최초 작성 | `YYYYMMDD-v1.0` | `20251029-v1.0` |
| 경미한 수정 (오타, 문구) | Minor 증가 | `20251029-v1.1` |
| 중요 정책 변경 | Major 증가 | `20251029-v2.0` |
| 다음 날 작성 | 날짜 변경 | `20251030-v1.0` |

**권장 규칙**:
- 날짜는 **문서 작성일** 사용 (배포일 아님)
- 하루에 여러 번 수정 시 Minor 버전만 증가

---

### Q3: 영어 문서를 추가하려면?

**A**: 다음 단계 수행

1. **영어 디렉토리 생성**:
   ```bash
   mkdir -p frontend/public/legal/en
   ```

2. **영어 문서 작성**:
   ```bash
   cp frontend/public/legal/ko/privacy-policy-20251029-v1.0.md \
      frontend/public/legal/en/privacy-policy-20251029-v1.0.md

   # 영어로 번역
   vim frontend/public/legal/en/privacy-policy-20251029-v1.0.md
   ```

3. **`legalVersions.ts`는 수정 불필요** (이미 `lang` 파라미터 지원)

4. **페이지에서 언어 토글 추가**:
   ```typescript
   // LegalPageLayout.tsx
   const filePath = getLegalFilePath(versionKey, 'en');  // 'ko' → 'en'
   ```

5. **Cloudflare 규칙은 수정 불필요** (`/legal/` 전체 캐싱)

---

### Q4: 캐시 히트율(Hit Ratio)은 어떻게 확인하나요?

**A**: Cloudflare Analytics 사용

**접속 경로**:
1. Cloudflare Dashboard 로그인
2. `codebase.blog` 도메인 선택
3. **Analytics** → **Caching** 탭

**주요 지표**:
- **Total Bandwidth**: 전체 트래픽
- **Cached Bandwidth**: 캐시에서 제공된 트래픽
- **Cache Hit Ratio**: 캐시 적중률 (목표: 95%+)

**계산식**:
```
Cache Hit Ratio = (Cached Requests / Total Requests) × 100%

예시:
Total:  10,000 requests
Cached:  9,800 requests
Ratio:   98% ✅
```

---

### Q5: TTL 1년이 너무 긴 것 아닌가요?

**A**: ✅ **안전합니다.**

**이유**:
1. **버전 관리**: 파일명에 버전 포함 → URL 변경 시 새 캐시
2. **즉시 업데이트**: 새 버전 배포 시 즉시 반영
3. **비용 절감**: 긴 TTL = 높은 캐시 히트율 = 낮은 Origin 부하

**비교**:
| TTL | 장점 | 단점 |
|-----|------|------|
| 1시간 | 빠른 갱신 | 높은 Origin 부하 |
| 1일 | 균형 | 중간 부하 |
| **1년** | **최적 성능, 비용** | 구버전 공간 사용 (미미) |

**구버전 파일 관리**:
- 자동 만료: 1년 후 Cloudflare가 삭제
- 수동 삭제: 필요 시 Cloudflare 캐시 퍼지
- 공간 사용: Markdown 파일 크기 ~30KB × 5개 = 150KB (무시 가능)

---

### Q6: 여러 도메인에서 서비스할 경우?

**A**: Expression에 도메인 추가

```
(
  (http.host eq "www.codebase.blog" or http.host eq "codebase.blog") and
  starts_with(http.request.uri.path, "/legal/")
)
```

또는 **모든 도메인** 적용:
```
starts_with(http.request.uri.path, "/legal/")
```

---

### Q7: 개발 환경에서 캐시를 테스트하려면?

**A**: 로컬에서는 캐시 없음 (프로덕션만 적용)

**로컬 테스트** (Next.js dev 서버):
```bash
cd frontend
pnpm dev

# localhost:3001에서는 Cloudflare 캐시 없음
# 파일 직접 읽기만 확인
```

**프로덕션 테스트**:
```bash
# Staging 환경 배포
git push origin staging

# 또는 Docker로 로컬 프로덕션 빌드
docker build -t frontend:test .
docker run -p 3001:3001 frontend:test

# curl로 헤더 확인
curl -I https://staging.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md
```

---

## 부록

### A. Cloudflare Cache Rule 전체 설정

```yaml
Rule Name: Public Folder Static Assets

# Expression
(http.host eq "www.codebase.blog" and
  (starts_with(http.request.uri.path, "/fonts/") or
   starts_with(http.request.uri.path, "/character/") or
   starts_with(http.request.uri.path, "/assets/") or
   starts_with(http.request.uri.path, "/legal/")))

# Settings
Cache Eligibility: Eligible for cache

Edge TTL:
  Mode: Ignore cache-control header and use this TTL
  Value: 1 year (31,536,000 seconds)

Status Code TTL:
  - Range 200-299: 1 year
  - Single 404: No cache
  - Range 500-599: No cache

Browser TTL:
  Mode: Override origin and use this TTL
  Value: 1 year (31,536,000 seconds)

Serve Stale Content: Off
Respect Strong ETags: Off
Origin Error Page Pass-through: Off
```

### B. 관련 파일 목록

| 파일 경로 | 역할 | 수정 빈도 |
|----------|------|----------|
| `/frontend/src/constants/legalVersions.ts` | 버전 관리 (중앙) | 문서 업데이트 시 |
| `/frontend/public/legal/ko/*.md` | Legal 문서 (한국어) | 문서 업데이트 시 |
| `/frontend/src/components/legal/LegalPageLayout.tsx` | 렌더링 로직 | 거의 없음 |
| `/frontend/src/app/legal/*/page.tsx` | 페이지 라우트 | 새 문서 추가 시 |
| `/docs/LEGAL_CACHING.md` | 이 가이드 | 시스템 변경 시 |

### C. 유용한 명령어 모음

```bash
# Legal 문서 목록 확인
ls -lh frontend/public/legal/ko/

# 버전 확인
cat frontend/src/constants/legalVersions.ts | grep -A 10 "LEGAL_VERSIONS"

# 캐시 상태 확인
curl -I https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md | grep -i "cf-cache"

# 모든 Legal 문서 캐시 상태 일괄 확인
for file in privacy-policy terms-of-service community-guidelines marketing-consent newsletter-consent; do
  echo "=== $file ==="
  curl -sI "https://www.codebase.blog/legal/ko/${file}-20251029-v1.0.md" | grep -i "cf-cache"
done

# 프로덕션 빌드 및 배포
cd frontend
pnpm build
docker build -t my-blog-frontend:latest .
docker push my-blog-frontend:latest

# Cloudflare 캐시 퍼지 (필요 시)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://www.codebase.blog/legal/ko/privacy-policy-20251029-v1.0.md"]}'
```

### D. 참고 문서

**Cloudflare 공식 문서**:
- [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Cache TTL](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [Purge Cache](https://developers.cloudflare.com/cache/how-to/purge-cache/)

**프로젝트 내부 문서**:
- `/cloudflare-workers/SETUP_GUIDE.md` - CDN Worker 설정
- `/cloudflare-workers/MONITORING.md` - 모니터링 가이드
- `/docs/DEPLOYMENT_ORACLE.md` - 배포 가이드

**관련 코드**:
- `/frontend/src/constants/legalVersions.ts` - 버전 관리 시스템
- `/frontend/src/components/legal/LegalPageLayout.tsx` - Legal 페이지 레이아웃
- `/frontend/src/app/legal/*/page.tsx` - Legal 라우트 페이지

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2025-01-29 | v1.0 | 최초 작성 | Claude Code |

---

**문의**: 이 가이드에 대한 질문이나 개선 제안은 프로젝트 관리자에게 문의하세요.

**라이선스**: 이 문서는 프로젝트 내부 사용을 위한 것이며, 외부 공개 시 검토가 필요합니다.
