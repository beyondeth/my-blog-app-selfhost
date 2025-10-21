# Hostinger + Cloudflare CDN 통합 설정 가이드
# codebase.blog 도메인 + Oracle OCI Storage

## 📋 전체 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 브라우저                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│            Cloudflare (DNS + CDN + SSL)                     │
│  - codebase.blog → 백엔드 서버                                │
│  - cdn.codebase.blog → Oracle OCI (이미지)                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌─────────────────┴─────────────────┐
        ↓                                   ↓
┌──────────────────┐              ┌──────────────────┐
│   백엔드 서버      │              │ Oracle OCI       │
│  (프로덕션 배포)   │              │ Object Storage   │
│  NestJS API      │              │ (이미지/파일)     │
└──────────────────┘              └──────────────────┘
```

**도메인 소유자**: Hostinger (codebase.blog)
**DNS 관리**: Cloudflare (Nameserver 위임)
**CDN**: Cloudflare (무료 티어)
**Origin**: Oracle OCI Object Storage (무료 20GB)

---

## 🎯 목표

1. ✅ Hostinger 도메인을 Cloudflare로 위임
2. ✅ Cloudflare DNS 레코드 설정
3. ✅ Cloudflare CDN으로 이미지 캐싱
4. ✅ SSL/TLS 자동 인증서 발급
5. ✅ 백엔드 코드에 CDN 적용

---

## 📝 사전 준비물

- [x] Hostinger 계정 (도메인: codebase.blog)
- [ ] Cloudflare 계정 (무료)
- [ ] Oracle OCI 계정 (설정 완료)
- [ ] 백엔드 서버 공개 IP (프로덕션 배포 시)

---

## 🚀 Step 1: Cloudflare 계정 생성 및 도메인 추가

### 1-1. Cloudflare 가입

1. https://www.cloudflare.com/ 접속
2. **Sign Up** 클릭
3. 이메일 입력: (권장: 프로젝트 전용 이메일)
4. 비밀번호 생성 (강력한 비밀번호)
5. 이메일 인증 완료

### 1-2. 도메인 추가

1. Cloudflare 대시보드 로그인 → **Add a Site** 버튼 클릭
2. 도메인 입력:
   ```
   codebase.blog
   ```
3. **Add Site** 클릭

### 1-3. 플랜 선택

- **Free** 플랜 선택 (월 $0)
- **Confirm Plan** 클릭

### 1-4. DNS 레코드 자동 스캔

Cloudflare가 Hostinger의 기존 DNS 레코드를 자동 스캔합니다.

- 스캔 완료 대기 (1~2분)
- 기존 DNS 레코드 확인
- **Continue** 클릭

### 1-5. Nameserver 정보 확인

Cloudflare가 제공하는 **Nameserver 2개**를 메모하세요:

```
예시:
Nameserver 1: alice.ns.cloudflare.com
Nameserver 2: bob.ns.cloudflare.com
```

> ⚠️ **중요**: 실제 제공된 Nameserver를 메모하세요 (위 예시와 다름)

---

## 🌐 Step 2: Hostinger에서 Nameserver 변경

### 2-1. Hostinger 로그인

1. https://hpanel.hostinger.com/ 접속
2. 계정 로그인

### 2-2. 도메인 관리 페이지 이동

1. 좌측 메뉴에서 **Domains** 클릭
2. `codebase.blog` 도메인 클릭
3. **DNS / Nameservers** 탭 선택

### 2-3. Nameserver 변경

1. **Change Nameservers** 버튼 클릭
2. **Use Custom Nameservers** 선택
3. Cloudflare Nameserver 입력:
   ```
   Nameserver 1: alice.ns.cloudflare.com
   Nameserver 2: bob.ns.cloudflare.com
   ```
   (실제 Cloudflare에서 받은 Nameserver 입력)
4. **Save Changes** 클릭

### 2-4. 확인 메시지

Hostinger에서 경고 메시지가 나타날 수 있습니다:

```
⚠️ Warning: Changing nameservers will transfer DNS management to another provider.
```

**Confirm** 클릭하여 진행

---

## ⏳ Step 3: DNS 전파 대기

### 3-1. 예상 소요 시간

- **최소**: 5분 ~ 1시간
- **평균**: 2~6시간
- **최대**: 24~48시간 (드물게)

### 3-2. Cloudflare에서 상태 확인

1. Cloudflare 대시보드 → codebase.blog 사이트 선택
2. **Overview** 탭 확인:
   ```
   Status: Pending Nameserver Update (대기 중)
   ↓
   Status: Active (완료)
   ```

### 3-3. DNS 전파 확인 도구

**방법 1: 온라인 도구**
- https://www.whatsmydns.net/
- 검색: `codebase.blog`
- 레코드 타입: `NS`
- 결과: `alice.ns.cloudflare.com`, `bob.ns.cloudflare.com`

**방법 2: 터미널 명령어 (macOS/Linux)**
```bash
# Nameserver 확인
dig NS codebase.blog +short

# 예상 결과:
# alice.ns.cloudflare.com
# bob.ns.cloudflare.com
```

**방법 3: Windows 명령어**
```cmd
nslookup -type=NS codebase.blog
```

> 💡 **팁**: Status가 "Active"로 변경될 때까지 기다린 후 다음 단계 진행

---

## 🔧 Step 4: Cloudflare DNS 레코드 설정

### 4-1. DNS 관리 페이지 이동

Cloudflare 대시보드 → **DNS** → **Records** 탭

### 4-2. 기존 레코드 확인 및 정리

자동 스캔된 레코드 중 불필요한 것 삭제:
- Hostinger 주차(Parking) 레코드
- 사용하지 않는 서브도메인

### 4-3. 메인 도메인 레코드 추가 (백엔드 서버용)

> ⚠️ **현재 배포 상태에 따라 다름**

#### 시나리오 A: 아직 프로덕션 배포 안 함 (로컬 개발만)

**임시로 Cloudflare Parking Page 사용**:
```
Type: A
Name: @
IPv4 Address: 192.0.2.1 (Cloudflare Parking IP)
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

#### 시나리오 B: 프로덕션 서버가 있는 경우

```
Type: A
Name: @
IPv4 Address: <백엔드 서버 공개 IP 주소>
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

**Add Record** 클릭

### 4-4. www 서브도메인 추가

```
Type: CNAME
Name: www
Target: codebase.blog
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

**Add Record** 클릭

### 4-5. CDN 전용 서브도메인 추가 (중요!)

```
Type: CNAME
Name: cdn
Target: codebase.blog
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

**Add Record** 클릭

> 💡 **설명**: `cdn.codebase.blog`는 이미지/파일 전용 URL로 사용됩니다.

### 4-6. API 서브도메인 추가 (선택 사항)

```
Type: CNAME
Name: api
Target: codebase.blog
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

### 4-7. 최종 DNS 레코드 확인

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | @ | <서버 IP 또는 192.0.2.1> | Proxied | Auto |
| CNAME | www | codebase.blog | Proxied | Auto |
| CNAME | cdn | codebase.blog | Proxied | Auto |
| CNAME | api | codebase.blog | Proxied | Auto |

---

## 🖼️ Step 5: Cloudflare Cache Rules 설정

### 5-1. Cache Rules 페이지 이동

Cloudflare 대시보드 → **Caching** → **Cache Rules**

### 5-2. 이미지 파일 캐싱 규칙 생성

**Create Rule** 클릭:

```yaml
Rule Name: Cache Static Images

When incoming requests match:
  Field: Hostname
  Operator: equals
  Value: cdn.codebase.blog

  AND

  Field: URI Path
  Operator: starts with
  Value: /uploads/

Then:
  Cache eligibility: Eligible for cache

  Edge Cache TTL:
    Status Code: All
    Duration: 1 month

  Browser Cache TTL:
    Override origin: ON
    Duration: 1 day
```

**Deploy** 클릭

### 5-3. 모든 정적 파일 캐싱 (선택)

**Create Rule** 클릭:

```yaml
Rule Name: Cache All Static Files

When incoming requests match:
  Field: Hostname
  Operator: equals
  Value: cdn.codebase.blog

Then:
  Cache eligibility: Eligible for cache

  Edge Cache TTL:
    Status Code: All
    Duration: 1 week

  Browser Cache TTL:
    Override origin: ON
    Duration: 4 hours
```

**Deploy** 클릭

---

## 🔐 Step 6: SSL/TLS 설정

### 6-1. SSL/TLS 모드 설정

Cloudflare 대시보드 → **SSL/TLS** → **Overview**

#### 현재 배포 상태에 따라 선택:

**A. 백엔드 서버에 SSL 인증서가 없는 경우 (로컬 개발 또는 HTTP만)**
```
Encryption Mode: Flexible
```
> ⚠️ **주의**: Origin과 Cloudflare 간 암호화 안 됨 (임시 설정)

**B. 백엔드 서버에 유효한 SSL 인증서가 있는 경우**
```
Encryption Mode: Full (Strict)
```
> ✅ **권장**: Let's Encrypt 무료 인증서 사용

### 6-2. Always Use HTTPS 활성화

Cloudflare 대시보드 → **SSL/TLS** → **Edge Certificates**

```
Always Use HTTPS: ON (활성화)
```

이제 `http://codebase.blog` 접속 시 자동으로 `https://codebase.blog`로 리다이렉트됩니다.

### 6-3. Automatic HTTPS Rewrites

```
Automatic HTTPS Rewrites: ON (활성화)
```

### 6-4. Minimum TLS Version

```
Minimum TLS Version: TLS 1.2 (권장)
```

---

## 🎨 Step 7: Cloudflare 성능 최적화

### 7-1. Auto Minify

Cloudflare 대시보드 → **Speed** → **Optimization**

```
Auto Minify:
  ✅ JavaScript
  ✅ CSS
  ✅ HTML
```

### 7-2. Brotli 압축

```
Brotli: ON (활성화)
```

### 7-3. Image Optimization (Polish)

```
Polish: Lossy (WebP 자동 변환)
```

> 💡 **Free Tier**: 기본 이미지 압축만 제공
>
> **Pro Tier ($20/월)**: Image Resizing API 사용 가능

### 7-4. Rocket Loader (선택)

```
Rocket Loader: OFF (React 앱과 충돌 가능성 있음)
```

---

## 🔑 Step 8: Cloudflare API Token 생성

### 8-1. Zone ID 확인

1. Cloudflare 대시보드 → **Overview** 탭
2. 오른쪽 사이드바에서 **Zone ID** 확인
3. **Copy** 버튼 클릭하여 복사

```
Zone ID: abc123def456ghi789jkl012mno345pq
```

메모장에 저장하세요.

### 8-2. API Token 생성

1. Cloudflare 대시보드 → 우측 상단 **프로필 아이콘** 클릭
2. **My Profile** 선택
3. 좌측 메뉴 → **API Tokens** 클릭
4. **Create Token** 버튼 클릭

### 8-3. Custom Token 설정

**Use Custom Token** 클릭:

```yaml
Token Name: Codebase Blog Cache Purge

Permissions:
  Zone - Cache Purge - Purge

Zone Resources:
  Include - Specific zone - codebase.blog

Client IP Address Filtering: (비워둠)

TTL: (비워둠 - 만료 없음)
```

**Continue to Summary** → **Create Token** 클릭

### 8-4. API Token 복사

```
API Token: 1234567890abcdefghijklmnopqrstuvwxyz
```

> ⚠️ **매우 중요**: 이 토큰은 단 한 번만 표시됩니다!
>
> 안전한 곳에 저장하세요 (비밀번호 관리자 권장)

**Copy** 버튼 클릭 → 메모장에 저장

---

## 💻 Step 9: 백엔드 환경변수 설정

### 9-1. .env.development 파일 수정

```bash
# ============================================
# CDN (Cloudflare - OCI Origin)
# ============================================
# CDN 사용 활성화
CDN_ENABLED=true

# Cloudflare CDN 도메인 (이미지/파일 전용)
CDN_DOMAIN=cdn.codebase.blog

# Cloudflare Zone ID (Step 8-1에서 복사한 값)
CLOUDFLARE_ZONE_ID=abc123def456ghi789jkl012mno345pq

# Cloudflare API Token (Step 8-4에서 복사한 값)
CLOUDFLARE_API_TOKEN=1234567890abcdefghijklmnopqrstuvwxyz
```

**저장** (Cmd/Ctrl + S)

### 9-2. .env.production 파일 생성 (프로덕션 배포 시)

```bash
cp .env.development .env.production
```

동일한 CDN 설정 적용:
```bash
CDN_ENABLED=true
CDN_DOMAIN=cdn.codebase.blog
CLOUDFLARE_ZONE_ID=abc123def456ghi789jkl012mno345pq
CLOUDFLARE_API_TOKEN=1234567890abcdefghijklmnopqrstuvwxyz
```

---

## 🔄 Step 10: 백엔드 재시작 및 테스트

### 10-1. Docker 컨테이너 재시작

```bash
# 현재 디렉토리 확인
cd /Users/sihyungpark/Desktop/code/my-blog-app

# 백엔드 컨테이너만 재시작
docker restart my-blog-app-backend

# 또는 전체 재시작
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart
```

### 10-2. 로그 확인

```bash
# 백엔드 로그 확인 (CDN 초기화 메시지 확인)
docker logs my-blog-app-backend --tail 50

# 예상 출력:
# ✅ Cloudflare CDN enabled with domain: cdn.codebase.blog
```

### 10-3. CDN URL 생성 테스트

**브라우저에서 프로필 이미지 업로드**:

1. http://localhost:3001 접속
2. 프로필 설정 페이지 이동
3. 이미지 업로드

**개발자 도구 → Network 탭 확인**:
```
예상 URL:
https://cdn.codebase.blog/uploads/12345678-1234-1234-1234-123456789abc.webp
```

> ⚠️ **현재 상태**: DNS가 아직 전파 중이면 실패할 수 있음
>
> **해결**: Step 3 DNS 전파 완료까지 대기

---

## 🧪 Step 11: CDN 작동 확인

### 11-1. DNS 전파 완료 확인 (필수)

```bash
# CDN 서브도메인 확인
dig CNAME cdn.codebase.blog +short

# 예상 결과:
# codebase.blog
```

### 11-2. Cloudflare Cache 확인

**터미널 테스트**:
```bash
# 이미지 URL로 HTTP 헤더 확인 (실제 업로드한 이미지 URL 사용)
curl -I https://cdn.codebase.blog/uploads/test-image.webp

# 확인할 헤더:
# server: cloudflare
# cf-cache-status: HIT (캐시됨) 또는 MISS (첫 요청)
# cf-ray: <고유 ID>
```

**헤더 의미**:
- `cf-cache-status: MISS` → 첫 요청 (Origin에서 가져옴)
- `cf-cache-status: HIT` → 캐시됨 (Cloudflare Edge에서 반환)
- `cf-cache-status: EXPIRED` → 만료됨 (재검증 필요)

### 11-3. 브라우저 테스트

1. **이미지 업로드**:
   - http://localhost:3001/new-story 접속
   - 에디터에 이미지 추가
   - 업로드 완료

2. **Network 탭 확인**:
   - 개발자 도구 (F12) → Network 탭
   - 이미지 URL 클릭
   - Headers 탭에서 `cf-cache-status` 확인

3. **Cache Hit 테스트**:
   - 페이지 새로고침 (F5)
   - 두 번째 요청부터 `cf-cache-status: HIT` 표시

---

## 📊 Step 12: Cloudflare Analytics 확인

### 12-1. Analytics 대시보드

Cloudflare 대시보드 → **Analytics & Logs** → **Traffic**

**확인 항목**:
- **Requests**: 총 요청 수
- **Bandwidth**: 전송량
- **Unique Visitors**: 방문자 수
- **Threats Mitigated**: 차단된 위협

### 12-2. Caching 성능 확인

Cloudflare 대시보드 → **Analytics & Logs** → **Performance**

**목표**:
- **Cache Hit Rate**: 80% 이상 (높을수록 좋음)
- **Bandwidth Saved**: 50% 이상

---

## 🚨 문제 해결 (Troubleshooting)

### 문제 1: DNS 전파가 안 됨 (24시간 이상 대기)

**원인**: Hostinger Nameserver 변경 미적용

**해결**:
1. Hostinger 대시보드에서 Nameserver 확인
2. Cloudflare Nameserver가 정확히 입력되었는지 재확인
3. Hostinger 고객센터 문의 (드물게 수동 승인 필요)

### 문제 2: cdn.codebase.blog 접속 시 404 에러

**원인**: DNS CNAME 레코드 누락 또는 Proxy 미활성화

**해결**:
1. Cloudflare DNS → Records 확인
2. `cdn` CNAME 레코드 존재 확인
3. **Proxy Status**가 "Proxied" (주황색 구름)인지 확인
4. "DNS Only" (회색 구름)이면 클릭하여 "Proxied"로 변경

### 문제 3: 이미지 URL은 생성되지만 로드 안 됨

**원인**: OCI Origin 연결 실패 또는 CSP 차단

**해결 A - Origin 연결 확인**:
```bash
# OCI URL 직접 접근 테스트
curl -I https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/codebase-bucket-20251021/uploads/test.webp
```

**해결 B - CSP 확인**:
```typescript
// backend/src/main.ts 확인
imgSrc: [
  // ...
  "*.oraclecloud.com",  // ✅ 있어야 함
  "cdn.codebase.blog",   // ✅ 추가 권장
],
```

### 문제 4: cf-cache-status 헤더가 항상 MISS

**원인**: Cache Rules 미적용 또는 쿼리 스트링 문제

**해결**:
1. Cloudflare → Caching → Cache Rules 확인
2. `cdn.codebase.blog/uploads/*` 규칙 존재 확인
3. **Cache Eligibility**가 "Eligible for cache"인지 확인
4. Presigned URL 쿼리 파라미터 제거 고려:
   ```typescript
   // cdn.service.ts - 프록시 사용으로 해결됨
   return this.generateCdnUrl(file);
   ```

### 문제 5: SSL 인증서 에러 (ERR_SSL_VERSION_OR_CIPHER_MISMATCH)

**원인**: SSL/TLS 모드 불일치

**해결**:
```
Cloudflare → SSL/TLS → Overview
Encryption Mode: Flexible (임시)

# 백엔드 서버에 Let's Encrypt 인증서 설치 후:
Encryption Mode: Full (Strict) (프로덕션)
```

### 문제 6: Cloudflare API Token 에러 (401 Unauthorized)

**원인**: API Token 권한 부족 또는 만료

**해결**:
1. Cloudflare → My Profile → API Tokens
2. 해당 토큰 확인 → **Edit** 클릭
3. **Permissions** 확인:
   - Zone - Cache Purge - Purge (✅ 필수)
4. **Zone Resources** 확인:
   - codebase.blog 포함되어 있는지 확인

### 문제 7: 한글 파일명 깨짐

**원인**: URL 인코딩 문제

**해결**:
```typescript
// 이미 구현됨 - s3.service.ts
const s3Key = `uploads/${uuidv4()}.${extension}`;
// UUID 사용으로 파일명 충돌 및 인코딩 문제 회피
```

---

## ✅ 최종 체크리스트

### Cloudflare 설정
- [ ] Cloudflare 계정 생성
- [ ] codebase.blog 도메인 추가
- [ ] Free 플랜 선택
- [ ] Nameserver 정보 확인

### Hostinger 설정
- [ ] Hostinger 로그인
- [ ] Nameserver를 Cloudflare로 변경
- [ ] 변경 확인 완료

### DNS 전파
- [ ] DNS 전파 대기 (5분 ~ 48시간)
- [ ] Cloudflare Status: Active 확인
- [ ] dig/nslookup으로 NS 레코드 확인

### Cloudflare DNS 레코드
- [ ] @ (메인 도메인) A 또는 CNAME 레코드
- [ ] www CNAME 레코드
- [ ] cdn CNAME 레코드 (필수!)
- [ ] api CNAME 레코드 (선택)
- [ ] 모든 레코드 Proxy: Proxied 설정

### Cloudflare Cache Rules
- [ ] 이미지 캐싱 규칙 생성
- [ ] Edge TTL: 1 month 설정
- [ ] Browser TTL: 1 day 설정

### SSL/TLS
- [ ] SSL/TLS Mode 설정 (Flexible 또는 Full)
- [ ] Always Use HTTPS 활성화
- [ ] Automatic HTTPS Rewrites 활성화

### 성능 최적화
- [ ] Auto Minify 활성화
- [ ] Brotli 활성화
- [ ] Polish (이미지 압축) 활성화

### API Token
- [ ] Zone ID 복사
- [ ] API Token 생성 (Cache Purge 권한)
- [ ] Token 안전하게 보관

### 백엔드 설정
- [ ] .env.development에 CDN_ENABLED=true
- [ ] CDN_DOMAIN=cdn.codebase.blog
- [ ] CLOUDFLARE_ZONE_ID 설정
- [ ] CLOUDFLARE_API_TOKEN 설정
- [ ] Docker 컨테이너 재시작
- [ ] 로그에서 "CDN enabled" 메시지 확인

### 테스트
- [ ] 이미지 업로드 테스트
- [ ] 브라우저 Network 탭에서 cdn.codebase.blog URL 확인
- [ ] curl로 cf-cache-status 확인
- [ ] Cache HIT 확인 (두 번째 요청)
- [ ] Cloudflare Analytics 확인

---

## 📈 성능 목표

### 개발 환경 (현재)
```
- Image Load Time: < 500ms
- Cache Hit Rate: > 60%
- CDN Coverage: 이미지 파일만
```

### 프로덕션 환경 (배포 후)
```
- Image Load Time: < 200ms (Cloudflare Edge)
- Cache Hit Rate: > 85%
- CDN Coverage: 이미지 + 정적 파일
- Global Latency: < 100ms (Edge Network)
```

---

## 💰 비용 분석

### 월간 예상 비용: $0 (완전 무료)

| 서비스 | 플랜 | 월 비용 | 제한 |
|--------|------|---------|------|
| Hostinger 도메인 | 연간 구입 | ~$1/월 | 도메인 1개 |
| Cloudflare CDN | Free | $0 | 무제한 대역폭 |
| Oracle OCI Storage | Free Tier | $0 | 20GB / 10TB 전송 |
| **합계** | | **~$1/월** | |

### 향후 확장 옵션

**Cloudflare Pro ($20/월)**:
- Image Resizing API
- Polish WebP 변환
- 더 많은 Page Rules (20개)
- 우선 지원

**Oracle OCI 유료 ($0.0255/GB/월)**:
- 20GB 초과 시
- 추가 스토리지 필요 시

---

## 📚 참고 자료

- [Cloudflare 공식 문서](https://developers.cloudflare.com/)
- [Hostinger Nameserver 변경](https://support.hostinger.com/en/articles/1583227)
- [Cloudflare Cache 설정](https://developers.cloudflare.com/cache/)
- [Oracle OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)
- [Cloudflare + OCI 통합](https://blogs.oracle.com/cloud-infrastructure/post/cloudflare-cdn-oracle-cloud)

---

## 🎯 다음 단계

### 즉시 실행
1. ✅ Step 1: Cloudflare 계정 생성
2. ✅ Step 2: Hostinger Nameserver 변경
3. ⏳ Step 3: DNS 전파 대기

### DNS 전파 완료 후
4. ✅ Step 4-8: Cloudflare 설정
5. ✅ Step 9-11: 백엔드 적용 및 테스트

### 프로덕션 배포 시
- 백엔드 서버 공개 IP 확인
- DNS A 레코드 업데이트
- SSL/TLS Full (Strict) 모드로 전환
- Let's Encrypt 인증서 설치

---

**작성일**: 2025-01-21
**프로젝트**: Codebase Blog Platform
**도메인**: codebase.blog
**버전**: 1.0

**문의**: 설정 중 문제 발생 시 이 문서의 "문제 해결" 섹션 참조
