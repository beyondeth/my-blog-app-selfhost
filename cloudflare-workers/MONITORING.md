# Cloudflare Workers 모니터링 가이드

Cloudflare Workers CDN 프록시의 성능, 사용량, 에러를 모니터링하는 방법을 설명합니다.

---

## 📊 1. Workers Analytics 대시보드

### 1.1 접속 방법

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. 좌측 메뉴: **Workers & Pages** 클릭
3. `cdn-proxy` Worker 클릭
4. **Metrics** 탭 선택

### 1.2 주요 메트릭

#### Requests (요청 수)
- **중요도**: 🔴 매우 높음
- **무료 제한**: **100,000 requests/day**
- **확인 주기**: 매일 1회 (오전/저녁)
- **목표**: < 80,000 requests/day (안전 마진 20%)

**초과 시 대응**:
- 즉시 대응: Backend 직접 제공으로 전환 (`CDN_ENABLED=false`)
- 근본 해결: 이미지 lazy loading, 캐시 TTL 증가

#### Success Rate (성공률)
- **목표**: > 99%
- **정상 범위**: 98-100%
- **경고 범위**: 95-98% (조사 필요)
- **위험 범위**: < 95% (즉시 대응)

**실패 원인**:
- Oracle OCI PAR 만료
- Origin 서버 장애
- 잘못된 파일 경로

#### CPU Time (CPU 사용 시간)
- **무료 제한**: 10ms/request (평균)
- **정상 범위**: 1-5ms/request
- **목표**: < 3ms/request
- **초과 원인**: 과도한 로직, 외부 API 호출 지연

#### Errors (에러율)
- **목표**: < 1%
- **확인 항목**:
  - 404 에러: 파일이 실제로 없는 경우 (정상)
  - 500 에러: Worker 코드 버그 또는 Origin 장애
  - 403 에러: PAR 만료 또는 권한 문제

---

## 🚨 2. 무료 Tier 제한 관리

### 2.1 일일 요청 수 추적

#### 실시간 확인 방법

**Workers Dashboard**:
```
Metrics 탭 → Time Range: "Last 24 hours" 선택
→ Total Requests 확인
```

**알림 설정** (수동):
- 매일 오전 9시, 오후 9시에 대시보드 확인
- Google Sheets나 Notion에 일일 요청 수 기록
- 추세 파악 (증가/감소/안정)

#### 요청 수 계산 예시

**시나리오 1: 블로그 방문자 1,000명/일**
- 포스트 1개당 이미지 평균 5장
- 방문자 1명당 포스트 3개 조회
- 계산: 1,000 × 3 × 5 = **15,000 requests/day** ✅ 안전

**시나리오 2: 블로그 방문자 10,000명/일**
- 포스트 1개당 이미지 평균 5장
- 방문자 1명당 포스트 2개 조회
- 계산: 10,000 × 2 × 5 = **100,000 requests/day** ⚠️ 제한 도달

**시나리오 3: 캐시 적중률 90%**
- 실제 Workers 요청: 100,000 × 10% = **10,000 requests/day** ✅ 매우 안전
- 나머지 90%는 Cloudflare Edge에서 캐시 제공

### 2.2 무료 제한 초과 시 대응 방안

#### Option 1: Backend 직접 제공으로 임시 전환
```bash
# backend/.env.development 수정
CDN_ENABLED=false

# Backend 재시작
docker restart my-blog-app-backend
```

**효과**: Workers 요청 0으로 감소, S3 Presigned URL 사용

#### Option 2: Cloudflare Workers Paid Plan으로 업그레이드
- **비용**: $5/월 (10M requests 포함)
- **추가**: 초과 시 $0.50/1M requests

#### Option 3: 이미지 최적화로 요청 수 감소
- Lazy Loading 구현 (viewport 진입 시 로드)
- WebP 포맷 강제 (파일 크기 감소)
- Thumbnail 사용 (리스트에서는 작은 이미지)
- Sprite 이미지 사용 (아이콘류)

#### Option 4: Cache TTL 증가
```javascript
// cdn-proxy.js 수정
if (contentType.startsWith('image/')) {
  // 24시간 → 7일로 증가
  cacheControl = 'public, max-age=604800, s-maxage=604800, immutable';
}
```

**효과**: 캐시 히트율 증가 → Workers 요청 감소

---

## 📈 3. Cache Performance 모니터링

### 3.1 Cache Hit Rate 확인

#### Cloudflare Dashboard
1. **Analytics** → **Caching** 클릭
2. **Cache Hit Ratio** 확인

**목표**:
- 이미지: > 95%
- 전체: > 90%

**Cache 상태 의미**:
- `HIT`: Cloudflare에서 캐시 제공 (Workers 요청 없음) ✅
- `MISS`: 첫 요청 (Origin에서 가져옴) → 정상
- `EXPIRED`: 캐시 만료 → TTL 재조정 필요
- `BYPASS`: 캐시 안 됨 → Cache Rules 확인 필요

### 3.2 cURL로 Cache 상태 확인

```bash
# 첫 요청 (MISS 예상)
curl -I https://cdn.aigory.com/uploads/test.webp

# 응답 헤더:
# cf-cache-status: MISS

# 두 번째 요청 (HIT 예상)
curl -I https://cdn.aigory.com/uploads/test.webp

# 응답 헤더:
# cf-cache-status: HIT
# age: 10  (캐시된 지 10초 경과)
```

### 3.3 브라우저 개발자 도구에서 확인

1. **F12** (개발자 도구 열기)
2. **Network** 탭
3. 이미지 요청 선택
4. **Headers** 섹션에서 확인:
   - `cf-cache-status: HIT` → 캐시 제공 ✅
   - `server: cloudflare` → CDN 경유 확인

---

## 🔔 4. 알림 설정 (수동 방식)

### 4.1 Email Alerts (Cloudflare Pro 이상 필요)

> ⚠️ **무료 플랜 제한**: Cloudflare Free Tier는 자동 알림 미지원

**Pro 플랜 기능** ($20/월):
- Workers 에러율 > 5% 시 이메일 알림
- Origin 다운타임 감지
- DDoS 공격 탐지

### 4.2 수동 모니터링 루틴 (무료 방식)

#### 매일 체크리스트

**오전 점검 (9:00 AM)**:
- [ ] Workers 요청 수 확인 (< 80,000/day)
- [ ] 에러율 확인 (< 1%)
- [ ] Cache Hit Rate 확인 (> 90%)

**저녁 점검 (9:00 PM)**:
- [ ] 일일 누적 요청 수 확인
- [ ] 500 에러 발생 여부 확인
- [ ] PAR 만료일 확인 (D-7일 이내면 갱신)

#### 주간 점검 (월요일)

- [ ] 지난 7일 평균 요청 수 계산
- [ ] 트렌드 분석 (증가/감소)
- [ ] Oracle OCI Egress 트래픽 확인
- [ ] Cloudflare Analytics 리포트 다운로드

### 4.3 Google Sheets 모니터링 템플릿

**컬럼**:
| 날짜 | Workers 요청 수 | 에러율 (%) | Cache Hit (%) | PAR 만료일 | 비고 |
|------|----------------|-----------|---------------|-----------|------|
| 2025-10-21 | 15,234 | 0.5% | 96.2% | 2026-10-21 | 정상 |
| 2025-10-22 | 18,921 | 0.3% | 97.1% | 2026-10-21 | 정상 |

**Google Sheets 링크 예시**:
```
https://docs.google.com/spreadsheets/d/your-sheet-id/edit
```

---

## 🛠️ 5. 트러블슈팅 가이드

### 5.1 요청 수 급증 (Spike)

**증상**: 평소 20k/day → 갑자기 80k/day

**원인 파악**:
1. **Analytics** → **Top Paths** 확인
   - 특정 이미지가 과도하게 요청되는지 확인
   - Bot 트래픽 여부 확인

2. **Network** 탭에서 Referer 확인
   - 외부 사이트에서 이미지 hotlinking 여부

**대응**:
- Hotlinking 방지 (Worker 코드에 Referer 체크 추가)
- Bot 차단 (Cloudflare Firewall Rules)
- 문제 이미지 캐시 TTL 증가

### 5.2 에러율 상승

**에러 유형별 대응**:

#### 404 Not Found (정상 범위: < 5%)
- **원인**: 사용자가 삭제된 파일 요청
- **대응**: 불필요 (정상 동작)

#### 403 Forbidden (즉시 조치 필요)
- **원인**: Oracle OCI PAR 만료
- **대응**:
  1. Oracle Cloud Console → PAR 재생성
  2. Workers → Settings → Environment Variables → `ORIGIN_BASE_URL` 업데이트
  3. Worker 재배포

#### 500 Internal Server Error (긴급)
- **원인**: Worker 코드 버그 또는 Origin 장애
- **대응**:
  1. Workers → Logs 확인 (에러 메시지 파악)
  2. Oracle OCI 상태 확인 (https://status.cloud.oracle.com/)
  3. 필요 시 CDN 비활성화 (`CDN_ENABLED=false`)

### 5.3 캐시 히트율 저하 (< 80%)

**원인**:
- Cache-Control 헤더 잘못 설정
- URL에 쿼리 파라미터 포함 (캐시 키 분산)
- TTL이 너무 짧음

**해결**:
```javascript
// cdn-proxy.js 확인
// Cache-Control 헤더가 올바르게 설정되었는지 확인
console.log('Cache-Control:', cacheControl);
```

**Cloudflare Cache Rules 확인**:
- Dashboard → Caching → Cache Rules
- `cdn.aigory.com/uploads/*` 규칙이 활성화되어 있는지 확인

---

## 📊 6. 성능 최적화 체크리스트

### 현재 상태 점검

- [ ] Workers 일일 요청 수 < 50k (안전 마진 50%)
- [ ] 에러율 < 0.5%
- [ ] Cache Hit Rate > 95%
- [ ] 평균 CPU Time < 3ms
- [ ] Oracle OCI PAR 만료일 > 30일 남음

### 최적화 액션

- [ ] 프론트엔드에 이미지 Lazy Loading 구현
- [ ] WebP 포맷 강제 (JPEG/PNG 업로드 시 자동 변환)
- [ ] 포스트 리스트에서 썸네일 사이즈 축소 (500px → 300px)
- [ ] Cache TTL 증가 (24시간 → 7일)
- [ ] Service Worker로 브라우저 캐싱 강화

---

## 💰 7. 비용 예측

### 무료 Tier 한계

**100k requests/day 도달 시나리오**:
- 블로그 방문자: 약 5,000-10,000명/일
- 포스트당 이미지: 5장
- Cache Hit Rate: 90%

**계산**:
```
실제 Workers 요청 = 총 이미지 요청 × (100% - Cache Hit Rate)
= 1,000,000 requests/day × 10%
= 100,000 requests/day
```

### Paid Plan 비교

| 플랜 | 월 비용 | 포함 요청 수 | 초과 시 비용 |
|------|--------|-------------|-------------|
| Free | $0 | 100k/day | 사용 불가 |
| Workers Paid | $5 | 10M/month | $0.50/1M |
| Workers Bundled | $5 + CF 플랜 | 10M/month | $0.30/1M |

**추천**:
- 트래픽 < 5,000명/일: Free Tier 충분 ✅
- 트래픽 5,000-50,000명/일: Workers Paid ($5/월)
- 트래픽 > 50,000명/일: Pro 플랜 고려 ($20/월)

---

## 🎯 8. 모니터링 대시보드 구성 (선택사항)

### 8.1 Google Sheets 자동화

**Apps Script로 자동 수집** (고급):
```javascript
function fetchWorkersMetrics() {
  // Cloudflare API 호출
  const url = 'https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics/workers';
  const options = {
    headers: {
      'Authorization': 'Bearer YOUR_API_TOKEN',
    },
  };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  // Google Sheets에 기록
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), data.result.totals.requests]);
}
```

### 8.2 Grafana + Prometheus (프로덕션용)

**구성**:
1. Cloudflare Analytics API → Prometheus Exporter
2. Prometheus → Grafana
3. 알림: Slack/Email 연동

**비용**: 무료 (Self-hosted)

---

## ✅ 최종 점검 체크리스트

### 초기 설정 완료
- [ ] Cloudflare Workers Analytics 접속 확인
- [ ] 현재 일일 요청 수 파악 (베이스라인 설정)
- [ ] Cache Hit Rate 확인 (> 90%)
- [ ] Oracle OCI PAR 만료일 기록 (캘린더에 D-7일 알림 설정)

### 일상 운영
- [ ] 매일 2회 점검 루틴 설정 (오전/저녁)
- [ ] Google Sheets 모니터링 템플릿 생성
- [ ] 주간 리포트 작성 습관화

### 비상 대응
- [ ] CDN 비활성화 절차 숙지 (`CDN_ENABLED=false`)
- [ ] PAR 재생성 절차 숙지
- [ ] Cloudflare Support 연락 방법 확인

---

## 📚 참고 자료

- [Cloudflare Workers Analytics](https://developers.cloudflare.com/workers/observability/analytics/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Oracle OCI PAR 문서](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usingpreauthenticatedrequests.htm)
- [Cloudflare Cache Analytics](https://developers.cloudflare.com/cache/about/analytics/)

---

**작성일**: 2025-01-21
**프로젝트**: Aigory Platform
**버전**: 1.0
**유지보수**: 매월 업데이트 권장
