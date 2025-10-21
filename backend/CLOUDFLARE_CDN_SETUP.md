# Cloudflare CDN 설정 가이드
# codebase.blog + Oracle OCI Object Storage

## 📋 개요

- **도메인**: codebase.blog (Hostinger 구입)
- **Origin**: Oracle OCI Object Storage (ap-singapore-1)
- **CDN**: Cloudflare Free Tier
- **목적**: 이미지 캐싱, 전 세계 배포, 로딩 속도 개선

---

## 🚀 1단계: Cloudflare 계정 생성 및 도메인 추가

### 1.1 Cloudflare 가입

1. https://www.cloudflare.com/ 접속
2. **Sign Up** 클릭
3. 이메일/비밀번호 입력 후 계정 생성
4. 이메일 인증 완료

### 1.2 도메인 추가

1. Cloudflare 대시보드 로그인
2. **Add a Site** 버튼 클릭
3. 도메인 입력: `codebase.blog`
4. **Free** 플랜 선택 (월 $0)
5. **Continue** 클릭

### 1.3 DNS 레코드 자동 스캔

- Cloudflare가 기존 DNS 레코드를 자동으로 스캔
- 확인 후 **Continue** 클릭

---

## 🔧 2단계: Hostinger에서 Nameserver 변경

### 2.1 Cloudflare Nameserver 확인

Cloudflare가 제공하는 Nameserver 2개를 메모하세요:

```
예시:
- alice.ns.cloudflare.com
- bob.ns.cloudflare.com
```

### 2.2 Hostinger에서 변경

1. **Hostinger 콘솔** 로그인 (https://hpanel.hostinger.com/)
2. **도메인** 섹션 이동
3. `codebase.blog` 클릭
4. **DNS / Nameservers** 탭 선택
5. **Change Nameservers** 클릭
6. Cloudflare Nameserver 2개 입력:
   ```
   Nameserver 1: alice.ns.cloudflare.com
   Nameserver 2: bob.ns.cloudflare.com
   ```
7. **저장** 클릭

### 2.3 DNS 전파 대기

- **소요 시간**: 5분 ~ 48시간 (보통 1~2시간)
- **확인 방법**: Cloudflare 대시보드에서 "Status: Active" 표시 확인

> 💡 **팁**: `https://www.whatsmydns.net/` 에서 `codebase.blog`의 NS 레코드를 조회하여 전파 상태 확인 가능

---

## 🌐 3단계: Cloudflare DNS 레코드 설정

### 3.1 기본 DNS 레코드

Cloudflare 대시보드 → **DNS** → **Records** 이동

#### A. 메인 도메인 (codebase.blog)

**백엔드 서버 IP 또는 호스팅 주소 필요**

```
Type: A
Name: @
IPv4 Address: <백엔드 서버 공개 IP>
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

#### B. www 서브도메인

```
Type: CNAME
Name: www
Target: codebase.blog
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

#### C. CDN 전용 서브도메인 (이미지/파일용)

```
Type: CNAME
Name: cdn
Target: codebase.blog
Proxy Status: Proxied (주황색 구름 아이콘 ON)
TTL: Auto
```

### 3.2 Origin 설정 (OCI Object Storage)

**중요**: Cloudflare는 Origin으로 Oracle OCI를 직접 바라봅니다.

**OCI Public URL**:
```
https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/codebase-bucket-20251021
```

---

## ⚙️ 4단계: Cloudflare Cache Rules 설정

### 4.1 Page Rules (Cache Everything)

Cloudflare 대시보드 → **Rules** → **Page Rules** 이동

#### 이미지 파일 캐싱

```
URL Pattern: cdn.codebase.blog/uploads/*

설정:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 day
```

**Add Page Rule** 클릭

#### 정적 파일 캐싱

```
URL Pattern: cdn.codebase.blog/*

설정:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 week
- Browser Cache TTL: 1 day
```

### 4.2 Cache Rules (새 버전 - 권장)

Cloudflare 대시보드 → **Rules** → **Cache Rules** 이동

**Create Rule**:

```yaml
Rule Name: Cache Images
Expression:
  (http.host eq "cdn.codebase.blog" and starts_with(http.request.uri.path, "/uploads/"))

Settings:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 30 days
  - Browser TTL: 1 day
```

---

## 🖼️ 5단계: Cloudflare Image Resizing 설정

### 5.1 Image Resizing 활성화

> ⚠️ **Free Tier 제한**: 무료 플랜은 제한적 지원 (월 1,000회)
> 필요시 **Pro 플랜** ($20/월) 고려

Cloudflare 대시보드 → **Speed** → **Optimization** → **Image Resizing**

**활성화 방법**:
- Pro 플랜 이상에서 사용 가능
- Free 플랜은 Polish 기능만 제공

### 5.2 Polish (이미지 압축)

```
Cloudflare 대시보드 → Speed → Optimization → Polish

설정:
- Polish: Lossy (WebP 자동 변환)
```

---

## 🔐 6단계: Cloudflare API Token 생성 (캐시 무효화용)

### 6.1 Zone ID 확인

Cloudflare 대시보드 → **Overview** 탭 → 오른쪽 사이드바

```
Zone ID: <32자리 문자열>
```

메모해두세요.

### 6.2 API Token 생성

1. Cloudflare 대시보드 → **프로필 아이콘** → **My Profile**
2. **API Tokens** 탭 클릭
3. **Create Token** 클릭
4. **Custom Token** 선택

**Token 설정**:
```yaml
Token Name: Codebase Blog Cache Purge

Permissions:
  - Zone - Cache Purge - Purge

Zone Resources:
  - Include - Specific zone - codebase.blog

Client IP Address Filtering: (비워둠)
TTL: (비워둠)
```

5. **Continue to Summary** → **Create Token**
6. **API Token** 복사 및 안전하게 보관

---

## 🔧 7단계: 환경변수 설정

### 7.1 .env.development 파일 수정

```bash
# ============================================
# CDN (Cloudflare - OCI Origin)
# ============================================
# CDN 사용 활성화
CDN_ENABLED=true

# Cloudflare CDN 도메인 (이미지/파일 전용)
CDN_DOMAIN=cdn.codebase.blog

# Cloudflare Zone ID (대시보드에서 확인)
CLOUDFLARE_ZONE_ID=your_zone_id_here

# Cloudflare API Token (Cache Purge 권한)
CLOUDFLARE_API_TOKEN=your_api_token_here
```

### 7.2 .env.production 파일도 동일하게 설정

---

## 🧪 8단계: 테스트

### 8.1 DNS 전파 확인

```bash
# Nameserver 확인
dig NS codebase.blog

# A 레코드 확인
dig A codebase.blog

# CDN 서브도메인 확인
dig CNAME cdn.codebase.blog
```

### 8.2 CDN URL 테스트

**백엔드 재시작** (환경변수 적용):
```bash
docker restart my-blog-app-backend
```

**이미지 업로드 테스트**:
1. 프로필 이미지 업로드
2. 브라우저 개발자 도구 → Network 탭
3. 이미지 URL 확인: `https://cdn.codebase.blog/uploads/...`

### 8.3 Cache 확인

```bash
# HTTP 헤더 확인
curl -I https://cdn.codebase.blog/uploads/test-image.webp

# 예상 헤더:
# cf-cache-status: HIT (캐시됨) 또는 MISS (첫 요청)
# cf-ray: <ID>
# server: cloudflare
```

### 8.4 Cache Purge 테스트

**NestJS Console** (Docker 컨테이너 내부):
```bash
docker exec -it my-blog-app-backend sh

# NestJS REPL
pnpm repl

# CdnService 테스트
const cdnService = get('CdnService')
await cdnService.invalidateCache(['uploads/test-image.webp'])
```

---

## 🛡️ 9단계: 보안 설정

### 9.1 SSL/TLS 설정

Cloudflare 대시보드 → **SSL/TLS** → **Overview**

```
Encryption Mode: Full (Strict)
```

> ⚠️ **중요**: Origin 서버(백엔드)에 유효한 SSL 인증서 필요
> Let's Encrypt 무료 인증서 사용 권장

### 9.2 Always Use HTTPS

Cloudflare 대시보드 → **SSL/TLS** → **Edge Certificates**

```
Always Use HTTPS: ON (활성화)
```

### 9.3 HSTS (선택)

```
Cloudflare 대시보드 → SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)

설정:
- Enable HSTS: ON
- Max Age: 6 months
- Include Subdomains: ON
- Preload: OFF (첫 설정 시)
```

---

## 📊 10단계: 모니터링

### 10.1 Cloudflare Analytics

Cloudflare 대시보드 → **Analytics & Logs**

확인 항목:
- **Requests**: 총 요청 수
- **Bandwidth**: 전송량
- **Cache Hit Rate**: 캐시 적중률 (높을수록 좋음)
- **Threats**: 차단된 위협

### 10.2 이미지 캐싱 효율 확인

```
목표:
- Cache Hit Rate > 80%
- Bandwidth Saved > 50%
```

---

## 🚨 문제 해결

### DNS 전파가 안 됨

```bash
# 강제 DNS 새로고침 (macOS/Linux)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Windows
ipconfig /flushdns
```

### Cloudflare Cache가 작동 안 함

1. **Proxy Status 확인**: DNS 레코드가 "Proxied" (주황색 구름) 상태인지 확인
2. **Page Rules 순서**: 우선순위가 높은 규칙이 위에 있는지 확인
3. **Cache Purge**: 전체 캐시 삭제 후 재테스트

```
Cloudflare 대시보드 → Caching → Configuration → Purge Everything
```

### SSL 인증서 에러

```
Cloudflare SSL/TLS Mode를 "Flexible"로 임시 변경
(백엔드에 SSL 인증서 설치 후 "Full (Strict)"로 복원)
```

---

## 💰 비용 및 제한

### Cloudflare Free Tier

| 항목 | 제한 |
|------|------|
| 대역폭 | 무제한 (Unmetered) |
| 요청 수 | 무제한 |
| DDoS 방어 | 포함 |
| SSL 인증서 | 포함 (Universal SSL) |
| Cache Purge API | 1,000회/일 |
| Page Rules | 3개 |
| Image Resizing | 제한적 (Pro 플랜 $20/월 필요) |

### Oracle OCI Free Tier

| 항목 | 제한 |
|------|------|
| 스토리지 | 20GB |
| 아웃바운드 전송 | 10TB/월 |
| API 요청 | 무제한 |

> 💡 **최적 조합**: Cloudflare CDN (무료) + OCI Origin (무료) = **완전 무료 CDN**

---

## ✅ 체크리스트

- [ ] Cloudflare 계정 생성
- [ ] codebase.blog 도메인 추가
- [ ] Hostinger에서 Nameserver 변경
- [ ] DNS 전파 완료 (Status: Active)
- [ ] DNS 레코드 설정 (A, CNAME)
- [ ] Cache Rules 설정
- [ ] Zone ID 확인
- [ ] API Token 생성
- [ ] .env.development에 CDN 설정
- [ ] 백엔드 재시작
- [ ] 이미지 업로드 테스트
- [ ] Cache Hit 확인
- [ ] SSL/TLS 설정
- [ ] Always Use HTTPS 활성화

---

## 📚 참고 자료

- [Cloudflare 공식 문서](https://developers.cloudflare.com/)
- [Cloudflare Cache 설정 가이드](https://developers.cloudflare.com/cache/)
- [Oracle OCI + Cloudflare 통합](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/cdn-integration.htm)
- [Hostinger Nameserver 변경 가이드](https://support.hostinger.com/en/articles/1583227-how-to-change-nameservers)

---

**작성일**: 2025-01-21
**프로젝트**: Codebase Blog Platform
**버전**: 1.0
