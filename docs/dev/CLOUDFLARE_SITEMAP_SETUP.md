# Cloudflare Sitemap & SEO 설정 가이드

## 📋 개요

이 문서는 Codebase 블로그 플랫폼의 Sitemap과 SEO를 위한 Cloudflare 캐싱 설정 방법을 안내합니다.

---

## ✅ 완료된 구현 사항

### 1. Backend API 엔드포인트

#### **GET /api/v1/blogs/sitemap/all**
- 모든 공개 블로그 조회
- 응답: `{ slug, updatedAt }[]`
- 인증: 불필요 (@Public)
- 최적화: 최소 필드만 SELECT

#### **GET /api/v1/posts/sitemap/all**
- 모든 발행된 포스트 조회
- 응답: `{ slug, blogSlug, updatedAt }[]`
- 인증: 불필요 (@Public)
- 최적화: 공개 블로그의 포스트만 포함

### 2. Frontend Sitemap

#### **파일: `/frontend/src/app/sitemap.ts`**
- Next.js 14 Native Sitemap 사용
- ISR 재검증: 12시간 (43200초)
- 정적 라우트 9개 포함
- 동적 라우트: 블로그 + 포스트
- 에러 핸들링: API 실패 시 정적 라우트만 반환
- 타임아웃: 5초

**생성되는 URL:**
- `/sitemap.xml` - 자동 생성됨

### 3. Frontend Robots.txt

#### **파일: `/frontend/src/app/robots.ts`**
- Next.js 14 Native Robots 사용
- 34개 민감 경로 차단
- Sitemap 위치 명시

**생성되는 URL:**
- `/robots.txt` - 자동 생성됨

**차단 경로:**
```
/admin/*          # 관리자 (11개)
/settings/*       # 사용자 설정 (7개)
/api/*            # API 엔드포인트
/login, /register # 인증 (6개)
/dm/*             # DM
/bookmarks        # 북마크
/new-story        # 글쓰기
/account/*        # 계정 관리
/p/*/edit         # 포스트 편집
/mock-checkout    # 테스트 결제
/debug-*          # 디버그
```

### 4. SEO 메타데이터

#### **홈페이지** (`/frontend/src/app/layout.tsx`)
- 기본 메타데이터: title, description, keywords
- Open Graph 태그
- Twitter Card
- Canonical URL

#### **Pricing 페이지** (`/frontend/src/app/pricing/layout.tsx`)
- 구독 요금제 전용 메타데이터
- SEO 최적화된 설명

#### **Landing 페이지** (`/frontend/src/app/landing/layout.tsx`)
- MCP 자동 포스팅 전용 메타데이터
- 전환율 최적화 설명

#### **포스트 페이지** (`/frontend/src/app/[blogSlug]/[postSlug]/page.tsx`)
- 이미 구현됨 (generateMetadata)
- JSON-LD 구조화된 데이터 포함

---

## 🔧 Cloudflare 설정 방법

### 1. Cloudflare Dashboard 접속

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) 로그인
2. 도메인 선택: `codebase.blog`
3. 왼쪽 메뉴에서 **"Caching"** → **"Cache Rules"** 선택

### 2. Sitemap.xml 캐싱 규칙 생성

#### Rule 1: Sitemap.xml Caching

**규칙 이름:** `Sitemap XML Cache`

**조건 (When incoming requests match):**
```
Hostname equals "www.codebase.blog"
AND URI Path equals "/sitemap.xml"
```

**동작 (Then):**
```
- Cache eligibility: Eligible
- Edge Cache TTL: 12 hours
- Browser Cache TTL: 12 hours
- Respect origin headers: No
```

**설정 방법:**
1. **"Create rule"** 클릭
2. **Rule name:** `Sitemap XML Cache` 입력
3. **When incoming requests match** 섹션:
   - **Field:** Hostname
   - **Operator:** equals
   - **Value:** `www.codebase.blog`
   - **Add** 클릭
   - **AND** 선택
   - **Field:** URI Path
   - **Operator:** equals
   - **Value:** `/sitemap.xml`
4. **Then** 섹션:
   - **Cache eligibility:** Eligible 선택
   - **Edge Cache TTL:** 12 hours 선택
   - **Browser Cache TTL:** 12 hours 선택
   - **Respect origin headers:** No 선택
5. **Deploy** 클릭

### 3. Robots.txt 캐싱 규칙 생성

#### Rule 2: Robots.txt Caching

**규칙 이름:** `Robots TXT Cache`

**조건 (When incoming requests match):**
```
Hostname equals "www.codebase.blog"
AND URI Path equals "/robots.txt"
```

**동작 (Then):**
```
- Cache eligibility: Eligible
- Edge Cache TTL: 24 hours
- Browser Cache TTL: 24 hours
- Respect origin headers: No
```

**설정 방법:**
1. **"Create rule"** 클릭
2. **Rule name:** `Robots TXT Cache` 입력
3. **When incoming requests match** 섹션:
   - **Field:** Hostname
   - **Operator:** equals
   - **Value:** `www.codebase.blog`
   - **Add** 클릭
   - **AND** 선택
   - **Field:** URI Path
   - **Operator:** equals
   - **Value:** `/robots.txt`
4. **Then** 섹션:
   - **Cache eligibility:** Eligible 선택
   - **Edge Cache TTL:** 24 hours 선택
   - **Browser Cache TTL:** 24 hours 선택
   - **Respect origin headers:** No 선택
5. **Deploy** 클릭

### 4. 캐시 무효화 (필요 시)

Sitemap 또는 Robots.txt가 업데이트된 경우:

1. Cloudflare Dashboard → **"Caching"** → **"Configuration"**
2. **"Purge Cache"** 섹션에서 **"Custom Purge"** 선택
3. **"Purge by URL"** 선택
4. 다음 URL 입력:
   ```
   https://www.codebase.blog/sitemap.xml
   https://www.codebase.blog/robots.txt
   ```
5. **"Purge"** 클릭

---

## 📊 캐싱 전략 요약

| 파일 | Edge TTL | Browser TTL | 이유 |
|------|----------|-------------|------|
| sitemap.xml | 12시간 | 12시간 | 기술 블로그는 실시간성 불필요, Google도 하루 1-2번만 크롤링 |
| robots.txt | 24시간 | 24시간 | 거의 변경되지 않음 |

### ISR (Incremental Static Regeneration)

**sitemap.ts 설정:**
```typescript
export const revalidate = 43200; // 12시간마다 재생성
```

**작동 방식:**
1. 첫 요청: 백엔드 API 호출하여 sitemap 생성
2. 12시간 이내: 캐시된 sitemap 반환
3. 12시간 경과 후: 백그라운드에서 재생성, 캐시된 버전 반환
4. 재생성 완료 후: 새로운 sitemap으로 캐시 교체

---

## 🧪 테스트 방법

### 1. Sitemap.xml 확인

**브라우저에서 접속:**
```
https://www.codebase.blog/sitemap.xml
```

**확인 사항:**
- [ ] XML 형식으로 표시됨
- [ ] 정적 라우트 9개 포함 (/, /pricing, /support, /landing, /legal/*)
- [ ] 블로그 URL 포함 (예: /blog-slug)
- [ ] 포스트 URL 포함 (예: /blog-slug/post-slug)
- [ ] lastModified 날짜 표시됨
- [ ] changeFrequency, priority 값 존재

**cURL 테스트:**
```bash
curl -I https://www.codebase.blog/sitemap.xml
```

**예상 응답 헤더:**
```
HTTP/2 200
content-type: application/xml
cache-control: public, s-maxage=43200, stale-while-revalidate=86400
cf-cache-status: HIT  # Cloudflare 캐시 적중
```

### 2. Robots.txt 확인

**브라우저에서 접속:**
```
https://www.codebase.blog/robots.txt
```

**확인 사항:**
- [ ] 텍스트 형식으로 표시됨
- [ ] User-agent: * 존재
- [ ] Disallow 규칙 34개 존재
- [ ] Sitemap 위치 명시: `https://www.codebase.blog/sitemap.xml`

**cURL 테스트:**
```bash
curl https://www.codebase.blog/robots.txt
```

### 3. Cloudflare 캐싱 확인

**캐시 상태 확인:**
```bash
# Sitemap
curl -I https://www.codebase.blog/sitemap.xml | grep -i "cf-cache-status"

# Robots
curl -I https://www.codebase.blog/robots.txt | grep -i "cf-cache-status"
```

**가능한 값:**
- `HIT`: 캐시에서 제공 (✅ 정상)
- `MISS`: 캐시 미스, Origin에서 가져옴
- `EXPIRED`: 캐시 만료됨
- `BYPASS`: 캐시 규칙에서 제외됨

### 4. SEO 메타데이터 확인

**홈페이지:**
```bash
curl https://www.codebase.blog/ | grep -A 5 "<title>"
```

**Pricing 페이지:**
```bash
curl https://www.codebase.blog/pricing | grep -A 5 "<title>"
```

**Landing 페이지:**
```bash
curl https://www.codebase.blog/landing | grep -A 5 "<title>"
```

---

## 🔍 Google Search Console 등록

### 1. Sitemap 제출

1. [Google Search Console](https://search.google.com/search-console) 접속
2. 속성 선택: `codebase.blog`
3. 왼쪽 메뉴 **"색인 생성"** → **"Sitemaps"** 선택
4. **"새 사이트맵 추가"** 입력:
   ```
   https://www.codebase.blog/sitemap.xml
   ```
5. **"제출"** 클릭

### 2. 색인 생성 상태 모니터링

- **"개요"** 탭에서 색인 생성 상태 확인
- **"범위"** 탭에서 제외된 페이지 확인
- **"성능"** 탭에서 검색 노출 및 클릭 데이터 확인

---

## 📝 환경 변수 확인

### Production (.env.production)

```bash
NEXT_PUBLIC_SITE_URL=https://www.codebase.blog
NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1
```

### 확인 방법

```bash
# Backend 컨테이너에서
docker exec my-blog-app-backend env | grep BACKEND

# Frontend 빌드 시 확인
docker logs my-blog-app-frontend | grep NEXT_PUBLIC
```

---

## 🚨 문제 해결

### 문제 1: Sitemap이 404 에러

**원인:** Next.js 빌드가 완료되지 않았거나, 파일이 생성되지 않음

**해결:**
```bash
# Frontend 재빌드
cd frontend
pnpm build

# Docker 재시작
docker-compose -f docker-compose.prod.oracle.yml restart frontend
```

### 문제 2: Sitemap이 비어있음

**원인:** Backend API가 응답하지 않거나, 타임아웃 발생

**해결:**
```bash
# Backend API 테스트
curl https://www.codebase.blog/api/v1/blogs/sitemap/all
curl https://www.codebase.blog/api/v1/posts/sitemap/all

# Backend 로그 확인
docker logs my-blog-app-backend | grep Sitemap
```

### 문제 3: Cloudflare 캐시가 작동하지 않음

**원인:** Cache Rules가 제대로 설정되지 않음

**해결:**
1. Cloudflare Dashboard → Cache Rules 확인
2. Hostname과 URI Path가 정확한지 확인
3. **"Respect origin headers"**를 **"No"**로 설정했는지 확인

### 문제 4: 메타데이터가 표시되지 않음

**원인:** 클라이언트 컴포넌트에서 메타데이터를 설정함

**해결:**
- 서버 컴포넌트로 변환하거나
- `layout.tsx`에 메타데이터 추가 (현재 구현됨)

---

## 📈 성능 모니터링

### Cloudflare Analytics

1. Cloudflare Dashboard → **"Analytics & Logs"** → **"Web Analytics"**
2. **"Caching"** 탭에서 캐시 성능 확인:
   - Cache Hit Rate (목표: > 90%)
   - Bandwidth Saved
   - Requests Served from Cache

### Google Search Console

1. **"성능"** 탭:
   - 클릭수, 노출수, CTR, 평균 게재순위
2. **"색인 생성"** 탭:
   - 색인 생성된 페이지 수
   - 제외된 페이지 수
3. **"Sitemaps"** 탭:
   - Sitemap 상태
   - 발견된 URL 수
   - 색인 생성된 URL 수

---

## ✅ 체크리스트

### Backend
- [x] `GET /api/v1/blogs/sitemap/all` 엔드포인트 구현
- [x] `GET /api/v1/posts/sitemap/all` 엔드포인트 구현
- [x] 공개 블로그/포스트만 반환
- [x] 최소 필드만 SELECT (성능 최적화)

### Frontend
- [x] `sitemap.ts` 생성 (ISR 포함)
- [x] `robots.ts` 생성 (34개 경로 차단)
- [x] 홈페이지 메타데이터 추가
- [x] Pricing 페이지 메타데이터 추가
- [x] Landing 페이지 메타데이터 추가
- [x] 에러 핸들링 및 Fallback 구현

### Cloudflare
- [ ] Sitemap.xml Cache Rule 생성
- [ ] Robots.txt Cache Rule 생성
- [ ] 캐시 테스트 (cf-cache-status: HIT 확인)

### SEO
- [ ] Google Search Console에 Sitemap 제출
- [ ] robots.txt 크롤링 확인
- [ ] 메타데이터 검증 (Open Graph, Twitter Card)
- [ ] Canonical URL 확인

---

## 📚 참고 자료

- [Next.js Sitemap Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js Robots.txt Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Google Search Console](https://search.google.com/search-console)
- [Open Graph Protocol](https://ogp.me/)

---

**작성일:** 2025-01-21
**버전:** 1.0
**작성자:** Claude Code
