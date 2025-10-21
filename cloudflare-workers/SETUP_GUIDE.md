# Cloudflare Workers CDN 설정 가이드 (Private Bucket 방식)

**Bucket을 Private으로 유지**하면서 Cloudflare Workers로 안전하게 CDN을 구성하는 프로덕션 권장 방법입니다.

## ✅ 목표

- **Bucket**: Private 유지 (보안 강화)
- **Pre-Authenticated Request (PAR)**: Oracle이 제공하는 안전한 접근 방법
- **Workers**: PAR URL로 프록시하여 파일 제공
- **사용자**: CDN URL만 알고, 원본 URL은 노출 안 됨

## 📋 전제 조건

- ✅ Cloudflare 계정 (codebase.blog 도메인 연결됨)
- ✅ Oracle OCI Object Storage 버킷 (`codebase-bucket-20251021`)
- ✅ Bucket은 **Private 상태 유지**
- ✅ `cdn.codebase.blog` DNS 레코드 설정됨

---

## 🔐 단계 1: Oracle OCI PAR (Pre-Authenticated Request) 생성

### 1-1. Oracle Cloud Console 접속
1. https://cloud.oracle.com 로그인
2. 좌측 메뉴: **Storage → Buckets** 클릭
3. `codebase-bucket-20251021` 클릭

### 1-2. PAR 생성
1. 좌측 메뉴: **Pre-Authenticated Requests** 클릭
2. **Create Pre-Authenticated Request** 클릭
3. 설정:
   - **Name**: `cdn-access` (아무 이름이나 가능)
   - **Pre-Authenticated Request Target**: **Bucket** 선택
   - **Access Type**: **Permit object reads** 선택
   - **Expiration**: 충분히 길게 설정
     - 예: 2026-10-21 (1년 후)
     - 💡 팁: 만료일이 지나면 갱신 필요

4. **Create Pre-Authenticated Request** 클릭

### 1-3. PAR URL 복사 ⚠️ 매우 중요!

생성 완료 후 표시되는 **Pre-Authenticated Request URL**을 즉시 복사하세요!

**예시 URL**:
```
https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/p/oA3bX9JhF4JY3bFfgf6hHYQdppM_QsdfBvcN1jK/n/axricjc5utqz/b/codebase-bucket-20251021/o/
```

⚠️ **주의사항**:
- 이 URL은 **단 한 번만** 표시됩니다!
- 안전한 곳에 저장하세요 (메모장, 비밀번호 관리자 등)
- URL 끝에 `/o/`가 있어야 합니다 (파일 경로 시작점)

### 1-4. 테스트

터미널에서 PAR URL이 작동하는지 확인:

```bash
# 실제 파일 경로로 테스트 (PAR URL + 파일 경로)
curl -I "https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/p/{YOUR_PAR_TOKEN}/n/axricjc5utqz/b/codebase-bucket-20251021/o/uploads/image/2025/10/3a05317a-91e8-49f4-9022-01024b16972b.webp"
```

**성공 응답**: `HTTP/1.1 200 OK`
**실패 응답**: `HTTP/1.1 404 Not Found` → PAR 설정 다시 확인

---

## ⚙️ 단계 2: Cloudflare Workers 생성

### 2-1. Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 로그인
2. 좌측 메뉴: **Workers & Pages** 클릭
3. **Create Worker** 클릭

### 2-2. Worker 코드 작성
1. Worker 이름 입력: `cdn-proxy`
2. 기본 코드를 모두 삭제
3. 아래 코드 전체 복사하여 붙여넣기:

```javascript
/**
 * Cloudflare Workers: Private Bucket CDN Proxy
 */
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // OPTIONS 요청 처리 (CORS Preflight)
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // Oracle OCI PAR URL 구성
      const originUrl = `${env.ORIGIN_BASE_URL}${pathname}`;

      // Oracle OCI로 요청 전달
      const ociResponse = await fetch(originUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Cloudflare-Worker-Proxy/1.0',
        },
      });

      // 404 처리
      if (!ociResponse.ok) {
        return new Response(`File not found: ${pathname}`, {
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
          },
        });
      }

      // 파일 타입별 캐시 TTL 설정
      const contentType = ociResponse.headers.get('content-type') || 'application/octet-stream';
      let cacheControl = 'public, max-age=3600, s-maxage=3600';

      if (contentType.startsWith('image/')) {
        // 이미지: 24시간 캐시
        cacheControl = 'public, max-age=86400, s-maxage=86400, immutable';
      }

      // 응답 재구성 (보안 헤더 + 캐싱 + CORS)
      const newResponse = new Response(ociResponse.body, {
        status: ociResponse.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Content-Type-Options': 'nosniff',
        },
      });

      // Oracle OCI 내부 헤더 제거 (보안)
      newResponse.headers.delete('x-amz-id-2');
      newResponse.headers.delete('x-amz-request-id');
      newResponse.headers.delete('opc-request-id');

      return newResponse;

    } catch (error) {
      return new Response(`Internal error: ${error.message}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
        },
      });
    }
  },
};
```

4. **Save and Deploy** 클릭

---

## 🔑 단계 3: 환경 변수 설정 (PAR URL 등록)

### 3-1. 환경 변수 추가
1. Worker 대시보드에서 `cdn-proxy` 클릭
2. **Settings** 탭 클릭
3. **Variables and Secrets** 섹션 찾기
4. **Add variable** 클릭
5. 설정:
   - **Variable name**: `ORIGIN_BASE_URL`
   - **Value**: 단계 1-3에서 복사한 PAR URL 입력
     ```
     https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/p/{YOUR_PAR_TOKEN}/n/axricjc5utqz/b/codebase-bucket-20251021/o
     ```
   - **Type**: **Plain text** 선택 (Secret 아님)

6. **Save** 클릭

⚠️ **중요**: URL 끝에 `/o`가 있어야 하고, 그 뒤에 `/`를 추가하지 마세요!

### 3-2. Worker 재배포
- **Quick Edit** → **Save and Deploy** 클릭 (변경사항 반영)

---

## 🌐 단계 4: Custom Domain 연결

### 4-1. Workers에 도메인 추가
1. Workers 대시보드에서 `cdn-proxy` 클릭
2. **Triggers** 탭 클릭
3. **Add Custom Domain** 클릭
4. Domain 입력: `cdn.codebase.blog`
5. **Add Custom Domain** 클릭

⏱️ **DNS 전파 대기**: 약 1-5분

---

## ✅ 단계 5: 최종 테스트

### 5-1. 브라우저에서 테스트

아래 URL을 브라우저에서 열어보세요:

```
https://cdn.codebase.blog/uploads/image/2025/10/3a05317a-91e8-49f4-9022-01024b16972b.webp
```

**성공**: 이미지가 표시됨 🎉
**실패**: 404 에러 → 단계 3의 PAR URL 확인

### 5-2. cURL로 테스트

```bash
curl -I https://cdn.codebase.blog/uploads/image/2025/10/3a05317a-91e8-49f4-9022-01024b16972b.webp
```

**성공 응답 예시**:
```
HTTP/2 200
content-type: image/webp
cache-control: public, max-age=86400, s-maxage=86400, immutable
access-control-allow-origin: *
server: cloudflare
```

### 5-3. 프론트엔드에서 확인

1. 브라우저에서 `http://localhost:3001` 접속
2. **하드 리프레시**: `Cmd + Shift + R` (Mac) 또는 `Ctrl + Shift + F5` (Windows)
3. 개발자 도구(F12) → **Network** 탭
4. 프로필 이미지 요청 확인
5. URL이 `https://cdn.codebase.blog/...`로 시작하면 **성공**!

---

## 🎯 완료 체크리스트

- [ ] Oracle OCI PAR 생성 및 URL 복사
- [ ] PAR URL 테스트 (`curl` 명령으로 200 OK 확인)
- [ ] Cloudflare Worker 생성 및 코드 배포
- [ ] 환경 변수 `ORIGIN_BASE_URL` 설정
- [ ] Custom Domain (`cdn.codebase.blog`) 연결
- [ ] 브라우저에서 CDN URL 테스트
- [ ] 프론트엔드에서 이미지 로드 확인

---

## 🔧 문제 해결

### 문제 1: Workers에서 404 에러

**원인**: PAR URL이 잘못되었거나 파일 경로가 틀림

**해결**:
1. `ORIGIN_BASE_URL` 환경 변수 확인
2. PAR URL 끝에 `/o`가 있는지 확인
3. Oracle OCI Console → Buckets → Objects에서 실제 파일 경로 확인

### 문제 2: Workers에서 403 Forbidden

**원인**: PAR이 만료되었거나 권한이 잘못됨

**해결**:
1. Oracle OCI Console → Pre-Authenticated Requests에서 만료일 확인
2. 만료되었다면 새로운 PAR 생성
3. 환경 변수 `ORIGIN_BASE_URL` 업데이트

### 문제 3: CORS 에러

**원인**: Worker 코드에서 CORS 헤더 누락

**해결**: 코드에 이미 포함되어 있음 → Worker 재배포 확인

### 문제 4: 캐시가 작동하지 않음

**확인 방법**:
```bash
curl -I https://cdn.codebase.blog/... | grep -i cf-cache-status
```

**기대 결과**:
- 첫 요청: `cf-cache-status: MISS`
- 두 번째 요청: `cf-cache-status: HIT`

---

## 📊 성능 모니터링

### Cloudflare Workers Analytics
1. Workers Dashboard → `cdn-proxy` → **Metrics**
2. 확인 사항:
   - 요청 수 (Requests)
   - 성공률 (Success Rate)
   - CPU 시간 (CPU Time)

### Cloudflare Cache Analytics
1. Cloudflare Dashboard → **Analytics** → **Cache**
2. Cache Hit Rate 확인 (목표: 95% 이상)

---

## 💰 비용 예상

### Cloudflare Workers 무료 티어
- **요청 수**: 100,000회/일
- **CPU 시간**: 10ms/요청
- **예상**: 월 10만 명 방문 시 무료 범위 내

### Oracle OCI Egress (아웃바운드)
- **무료**: 10TB/월
- **Cloudflare 캐싱 효과**: Oracle 트래픽 90% 이상 절감
- **예상**: 대부분 Cloudflare에서 캐시 처리 → Oracle 트래픽 최소화

---

## 🎉 성공 시 기대 효과

✅ **보안**: Bucket Private 유지, 원본 URL 노출 안 됨
✅ **성능**: 전 세계 Cloudflare Edge에서 캐싱
✅ **비용**: 무료 티어로 충분
✅ **확장성**: 트래픽 증가해도 무료

---

**작성일**: 2025-10-21
**작성자**: Claude (Anthropic)
**방식**: Pre-Authenticated Request (PAR) + Cloudflare Workers
