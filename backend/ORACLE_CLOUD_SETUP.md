# Oracle Cloud Infrastructure (OCI) Object Storage 설정 가이드

## 📋 개요

이 프로젝트는 AWS S3와 Oracle Object Storage를 모두 지원합니다. Oracle Cloud Free Tier를 사용하면 **20GB 저장 공간**과 **10TB/월 아웃바운드 전송**을 무료로 사용할 수 있습니다.

---

## 🚀 Oracle Cloud Free Tier 스펙

| 항목 | Always Free 제공량 |
|------|-------------------|
| **Object Storage** | 20GB |
| **Outbound Data Transfer** | 10TB/월 |
| **API 요청** | 무제한 |
| **S3 호환 API** | ✅ 지원 |

---

## 📝 Oracle Cloud 계정 생성 및 설정

### 1. Oracle Cloud 계정 생성
1. [Oracle Cloud 가입](https://www.oracle.com/cloud/free/)
2. 무료 계정 생성 (신용카드 필요, 무료 티어 사용 시 과금 없음)
3. 홈 리전 선택: **South Korea Central (Seoul)** 권장

### 2. Object Storage Bucket 생성

1. **OCI 콘솔 로그인**
   ```
   https://cloud.oracle.com
   ```

2. **좌측 메뉴** → **Storage** → **Buckets**

3. **Create Bucket** 클릭
   - Bucket Name: `my-blog-files` (원하는 이름)
   - Default Storage Tier: **Standard**
   - Encryption: **Encrypt using Oracle managed keys** (기본값)
   - **Create** 클릭

### 3. Object Storage Namespace 확인

1. **Bucket 목록** 페이지 상단에서 **Namespace** 확인
   - 예: `axab1c2d3e4f` (각 계정마다 고유)
   - 이 값을 `.env` 파일의 `OCI_NAMESPACE`에 입력

### 4. Customer Secret Key 생성 (S3 호환 API 인증)

1. **우측 상단 프로필 아이콘** → **User Settings**

2. **Resources** → **Customer Secret Keys** 클릭

3. **Generate Secret Key** 클릭
   - Name: `my-blog-s3-key` (원하는 이름)
   - **Generate Secret Key** 클릭

4. **생성된 키 저장** (한 번만 표시됨!)
   - Access Key: `abcdef1234567890...` → `.env`의 `AWS_S3_ACCESS_KEY_ID`
   - Secret Key: `XxXxXxXxXxXxXxXxXxXx...` → `.env`의 `AWS_S3_SECRET_ACCESS_KEY`

---

## ⚙️ 환경변수 설정

### backend/.env 파일 수정

```bash
# =============================================
# Object Storage Provider 선택
# =============================================
# 'aws' = AWS S3 사용 (기본값)
# 'oci' = Oracle Object Storage 사용
STORAGE_PROVIDER=oci

# =============================================
# Oracle Object Storage 설정 (OCI 사용 시)
# =============================================
# OCI Namespace (콘솔에서 확인)
OCI_NAMESPACE=axab1c2d3e4f

# OCI Region (서울 리전)
# 다른 리전 목록: https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm
AWS_REGION=ap-seoul-1

# OCI Bucket 이름
AWS_S3_BUCKET=my-blog-files

# OCI Customer Secret Key (S3 호환 API 인증)
AWS_S3_ACCESS_KEY_ID=abcdef1234567890...
AWS_S3_SECRET_ACCESS_KEY=XxXxXxXxXxXxXxXxXxXx...

# =============================================
# Cloudflare CDN 설정 (선택사항)
# =============================================
# CDN 사용 여부 (기본값: false)
CDN_ENABLED=false

# Cloudflare Zone ID (CDN 사용 시)
# CLOUDFLARE_ZONE_ID=your_zone_id_here

# Cloudflare API Token (CDN 캐시 무효화용)
# CLOUDFLARE_API_TOKEN=your_api_token_here

# CDN 도메인 (Cloudflare 설정 후)
# CDN_DOMAIN=cdn.yourdomain.com
```

---

## 🔧 OCI S3 호환 엔드포인트

Oracle Object Storage는 S3 호환 API를 제공합니다:

```
https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
```

**예시 (서울 리전):**
```
https://axab1c2d3e4f.compat.objectstorage.ap-seoul-1.oraclecloud.com
```

---

## 🧪 테스트

### 1. 서버 시작 시 로그 확인

```bash
pnpm start:dev
```

**OCI 사용 시 로그:**
```
✅ Oracle Object Storage initialized
   Namespace: axab1c2d3e4f
   Region: ap-seoul-1
   Bucket: my-blog-files
   Endpoint: https://axab1c2d3e4f.compat.objectstorage.ap-seoul-1.oraclecloud.com
```

### 2. 파일 업로드 테스트

1. 프론트엔드에서 프로필 이미지 업로드 시도
2. 백엔드 로그 확인:
   ```
   File uploaded: v2/users/.../profile/avatar/20250130_142335_a3b4c5d6_avatar.jpeg (OCI)
   ```

### 3. 파일 다운로드 테스트

1. 업로드한 이미지가 프로필에 표시되는지 확인
2. 브라우저 네트워크 탭에서 URL 확인:
   ```
   https://axab1c2d3e4f.compat.objectstorage.ap-seoul-1.oraclecloud.com/my-blog-files/v2/users/.../avatar.jpeg?...
   ```

---

## 🌐 Cloudflare CDN 연동 (선택사항)

Oracle Object Storage는 자체 CDN을 제공하지 않으므로, Cloudflare를 Origin으로 연결하는 것을 권장합니다.

### Cloudflare 설정 방법

1. **Cloudflare 계정 생성** (무료)
   - https://dash.cloudflare.com/sign-up

2. **도메인 추가**
   - `yourdomain.com` 추가

3. **Page Rule 생성** (무료 3개)
   ```
   URL Pattern: *cdn.yourdomain.com/api/v1/files/proxy/*
   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   ```

4. **DNS CNAME 레코드 추가**
   ```
   Type: CNAME
   Name: cdn
   Target: {namespace}.compat.objectstorage.{region}.oraclecloud.com
   Proxy status: Proxied (🟠)
   ```

5. **.env 파일 업데이트**
   ```bash
   CDN_ENABLED=true
   CDN_DOMAIN=cdn.yourdomain.com
   CLOUDFLARE_ZONE_ID=your_zone_id
   CLOUDFLARE_API_TOKEN=your_api_token
   ```

---

## 📊 비용 비교

| 항목 | AWS S3 | Oracle OCI |
|------|--------|-----------|
| **저장 공간** | $0.023/GB/월 | **20GB 무료** |
| **아웃바운드 전송** | $0.09/GB | **10TB/월 무료** |
| **API 요청** | $0.0004/1000 PUT | **무제한 무료** |
| **월 예상 비용 (20GB)** | ~$3-5 | **$0** |

---

## ⚠️ 주의사항

### 1. Always Free 리소스 제한
- 계정당 20GB까지만 무료
- 20GB 초과 시 Standard Tier 과금 시작

### 2. Region 주의
- 홈 리전 변경 불가
- 서울 리전 (`ap-seoul-1`) 권장 (한국 사용자)

### 3. Customer Secret Key 보안
- Secret Key는 한 번만 표시됨 (분실 시 재생성 필요)
- `.env` 파일을 Git에 커밋하지 마세요

### 4. Presigned URL TTL
- OCI Presigned URL은 기본 1시간 유효
- Cloudflare CDN 사용 시 캐싱으로 TTL 문제 해결

---

## 🔄 AWS S3 → OCI 마이그레이션

기존 AWS S3 데이터를 OCI로 이전하려면:

### 방법 1: rclone 사용 (권장)

```bash
# rclone 설치
brew install rclone  # macOS
# or
sudo apt install rclone  # Linux

# AWS S3 설정
rclone config
# name: aws-s3
# type: s3
# provider: AWS
# access_key_id: your_aws_key
# secret_access_key: your_aws_secret

# OCI S3 설정
rclone config
# name: oci-s3
# type: s3
# provider: Other
# endpoint: https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
# access_key_id: your_oci_key
# secret_access_key: your_oci_secret

# 동기화 (Dry Run)
rclone sync aws-s3:your-bucket oci-s3:my-blog-files --dry-run

# 실제 동기화
rclone sync aws-s3:your-bucket oci-s3:my-blog-files --progress
```

### 방법 2: AWS CLI + OCI CLI

```bash
# AWS S3에서 다운로드
aws s3 sync s3://your-bucket ./temp-files

# OCI S3로 업로드
aws s3 sync ./temp-files s3://my-blog-files \
  --endpoint-url https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
```

---

## 📚 참고 문서

- [Oracle Object Storage 문서](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)
- [OCI S3 호환 API](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm)
- [Oracle Free Tier](https://www.oracle.com/cloud/free/)
- [Cloudflare 무료 플랜](https://www.cloudflare.com/plans/free/)

---

## 🆘 문제 해결

### 에러: "S3 configuration is incomplete"
- `.env` 파일에 `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` 확인

### 에러: "OCI_NAMESPACE is required"
- `STORAGE_PROVIDER=oci` 사용 시 `OCI_NAMESPACE` 필수
- OCI 콘솔 → Buckets 페이지에서 Namespace 확인

### 파일 업로드 실패
1. Customer Secret Key 권한 확인
2. Bucket이 올바른 Region에 생성되었는지 확인
3. 백엔드 로그에서 정확한 엔드포인트 URL 확인

### Presigned URL 접근 불가
- Bucket이 Private인 경우 Presigned URL로만 접근 가능 (정상)
- Public Access 필요 시 Bucket Policy 설정 필요 (권장하지 않음)

---

**작성일:** 2025-01-30
**버전:** 1.0.0
**프로젝트:** Multi-user Blog Platform
**Storage:** AWS S3 + Oracle OCI 하이브리드 지원
