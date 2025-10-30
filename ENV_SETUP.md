# 환경 변수 설정 가이드 (Environment Variables Setup Guide)

> 프로젝트의 환경 변수 구조와 설정 방법을 안내합니다.

---

## 📁 환경 변수 파일 구조

### 프로덕션 환경

```
my-blog-app/
├── .env.production          # ✅ 프로덕션 환경 변수 (실제 사용)
│                            # - Docker Compose가 참조
│                            # - GitHub Actions가 생성/배포
│                            # - 전체 시스템 설정 포함 (Backend + Frontend + Infrastructure)
│
└── frontend/
    ├── .env.production      # ❌ 삭제됨 (데드 코드)
    └── .env.local           # ✅ 로컬 개발용 (Git 무시)
```

### 개발 환경

```
my-blog-app/
└── frontend/
    ├── .env.local           # ✅ 개발 환경 변수 (Git 무시)
    │                        # - localhost:3000 API 연결
    │                        # - 개발자별로 독립적으로 관리
    │
    └── .env                 # ⚠️ 기본값 (Git 포함, 선택사항)
```

---

## 🔄 Next.js 환경 변수 로딩 우선순위

Next.js는 다음 순서로 환경 변수를 로드합니다 (번호가 작을수록 우선순위 높음):

```
1. process.env                    # 시스템 환경 변수 (Docker ENV 등)
2. .env.production.local          # 프로덕션 + 로컬 오버라이드 (Git 무시)
3. .env.production                # 프로덕션 전용 ← Docker가 사용
4. .env.local                     # 개발 + 프로덕션 공통 (Git 무시)
5. .env                           # 기본값 (Git 포함)
```

**중요**: Next.js는 **자신의 프로젝트 루트 디렉토리의 .env 파일만 읽습니다**.
- **Next.js 프로젝트 루트**: `frontend/` 폴더 (package.json, next.config.js 위치)
- **읽는 파일**: `frontend/.env`, `frontend/.env.local` 등
- **읽지 않는 파일**: 상위 폴더의 `.env.production` (개발 환경에서)

---

## 🔍 Next.js 환경 변수 로딩 메커니즘 (중요!)

### 프로젝트 구조와 환경변수 로딩

이 프로젝트는 **모노레포 구조**로 backend와 frontend가 분리되어 있습니다:

```
my-blog-app/                    (모노레포 루트)
├── backend/                    (NestJS 프로젝트)
├── frontend/                   (Next.js 프로젝트 루트 ✅)
│   ├── package.json
│   ├── next.config.js
│   ├── .env.local             # Next.js가 읽음 (개발 최우선)
│   └── .env                   # Next.js가 읽음 (기본값)
├── .env                        # Backend용 (Next.js는 읽지 않음)
└── .env.production             # Docker/Backend용 (Next.js는 읽지 않음)
```

### 개발 환경 (pnpm dev)

```bash
# 실행 위치
cd /path/to/my-blog-app/frontend
pnpm dev

# Next.js가 읽는 .env 파일 경로
✅ frontend/.env.local        (최우선)
✅ frontend/.env              (fallback)
❌ ../.env.production         (상위 폴더, 읽지 않음)
❌ ../.env                    (상위 폴더, 읽지 않음)
```

**핵심**: Next.js는 **자신의 package.json이 있는 폴더**를 프로젝트 루트로 인식하고, 해당 폴더 내부의 .env 파일만 읽습니다.

### 프로덕션 환경 (Docker 빌드)

프로덕션에서는 .env 파일을 직접 읽지 않고, **Docker ARG/ENV를 통해 환경변수를 주입**합니다:

```yaml
# docker-compose.prod.oracle.yml
services:
  frontend:
    env_file:
      - .env.production         # 1️⃣ Docker Compose가 읽음
    build:
      args:
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}  # 2️⃣ ARG로 전달

# frontend/Dockerfile.prod
ARG NEXT_PUBLIC_SITE_URL                               # 3️⃣ ARG 받음
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL         # 4️⃣ ENV 설정
RUN pnpm build                                         # 5️⃣ 빌드 시 코드에 임베딩
```

**결과**: `process.env.NEXT_PUBLIC_SITE_URL` → 빌드 시 하드코딩됨

### 환경별 로딩 경로 요약

| 환경 | 실행 위치 | 읽는 파일 | 결과 |
|------|----------|----------|------|
| **개발** | `pnpm dev` | `frontend/.env.local` | `http://localhost:3001` |
| **프로덕션** | Docker | 루트 `.env.production` → ARG/ENV | `https://www.codebase.blog` |

---

## 🚀 프로덕션 배포 시 환경 변수 주입 방식

### 1. GitHub Actions → 서버 업로드

```yaml
# .github/workflows/deploy-production.yml
steps:
  - name: Create .env.production from Secrets
    run: |
      cat > .env.production << 'EOF'
      ${{ secrets.ENV_FILE }}  # GitHub Secrets에서 읽음
      EOF

  - name: Upload to Server
    source: ".env.production"
    target: "/home/ubuntu/my-blog-app/"  # ← 루트 디렉토리
```

### 2. Docker Compose → 환경 변수 주입

```yaml
# docker-compose.prod.oracle.yml
services:
  frontend:
    env_file:
      - .env.production  # ← 루트 디렉토리의 .env.production 참조
    build:
      args:
        # 빌드 타임에 환경 변수 주입
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_BACKEND_URL: ${NEXT_PUBLIC_BACKEND_URL}
        # ...기타 NEXT_PUBLIC_* 변수들

  backend:
    env_file:
      - .env.production  # ← 동일 파일 참조
```

### 3. Dockerfile → 빌드 시 임베딩

```dockerfile
# frontend/Dockerfile.prod
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# Next.js 빌드 시 NEXT_PUBLIC_* 변수는 정적으로 코드에 임베딩됨
RUN npm run build
```

**중요**: Next.js 빌드 시 `NEXT_PUBLIC_*` 변수는 **정적으로 JavaScript 코드에 임베딩**됩니다. 런타임에 변경할 수 없습니다.

---

## 💻 개발 환경 설정 방법

### 1. `.env.local` 파일 생성 (Frontend)

```bash
cd frontend
cp .env.example .env.local  # 예제 파일이 있다면
# 또는 직접 생성
cat > .env.local << 'EOF'
# 로컬 개발용 환경 변수
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_DEBUG_MODE=true

# 선택: 외부 서비스 (개발용 API 키)
NEXT_PUBLIC_MIXPANEL_TOKEN=your_dev_token
NEXT_PUBLIC_GA_MEASUREMENT_ID=your_dev_id
EOF
```

### 2. Backend 환경 변수

```bash
# backend/.env (Git 무시)
cd backend
cat > .env << 'EOF'
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=blog-dev

# JWT
JWT_SECRET=your_dev_secret_key_at_least_32_characters
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SMTP (개발용 - Mailtrap 등)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_user
SMTP_PASS=your_pass
EOF
```

### 3. 개발 서버 실행

```bash
# Terminal 1: Backend (Port 3000)
cd backend
pnpm start:dev

# Terminal 2: Frontend (Port 3001)
cd frontend
pnpm dev
```

---

## 🧪 로컬 프로덕션 빌드 테스트

### 방법 1: 루트 .env.production 사용

```bash
cd frontend

# 루트 디렉토리의 .env.production 변수를 사용하여 빌드
dotenv -e ../.env.production -- pnpm build

# 빌드 결과 확인
pnpm start
```

### 방법 2: 임시 환경 변수 주입

```bash
cd frontend

# 환경 변수를 직접 주입하여 빌드
NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1 \
NEXT_PUBLIC_BACKEND_URL=https://www.codebase.blog \
NEXT_PUBLIC_SITE_URL=https://www.codebase.blog \
pnpm build
```

### 방법 3: Docker Compose 사용 (가장 정확)

```bash
# 프로덕션 환경과 동일한 방식으로 빌드
docker compose -f docker-compose.prod.oracle.yml build frontend

# 빌드 시 환경 변수 주입 확인
docker compose -f docker-compose.prod.oracle.yml build frontend --progress=plain 2>&1 | grep NEXT_PUBLIC
```

---

## ⚠️ 주의사항

### 1. `NEXT_PUBLIC_*` 변수는 클라이언트에 노출됨

```typescript
// ✅ 서버 사이드 전용 (노출 안됨)
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key

// ⚠️ 클라이언트에 노출됨 (브라우저에서 확인 가능)
NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1

// ❌ 민감한 정보는 NEXT_PUBLIC_ 사용 금지
NEXT_PUBLIC_PRIVATE_KEY=xxx  # 절대 안됨!
```

### 2. 빌드 후 환경 변수 변경 불가

```bash
# ❌ 잘못된 방법: 빌드 후 환경 변수 변경해도 적용 안됨
pnpm build
NEXT_PUBLIC_API_URL=https://new-api.com pnpm start  # 변경 안됨!

# ✅ 올바른 방법: 환경 변수 변경 후 다시 빌드
NEXT_PUBLIC_API_URL=https://new-api.com pnpm build
pnpm start
```

### 3. 중복 `/api/v1` 경로 주의

```typescript
// ❌ 잘못된 패턴
const API_URL = process.env.NEXT_PUBLIC_API_URL;  // http://localhost:3000/api/v1
fetch(`${API_URL}/api/v1/blogs`);  // ← /api/v1/api/v1/blogs (중복!)

// ✅ 올바른 패턴
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
fetch(`${API_URL}/blogs`);  // ← /api/v1/blogs (정상)
```

### 4. `.env.local`은 Git에 커밋하지 않음

```bash
# .gitignore에 포함되어야 함
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local
```

### 5. 프로덕션 환경 변수 보안

- **GitHub Secrets**에 민감한 정보 저장
- `.env.production` 파일은 서버에만 존재 (로컬 Git에 커밋하지 않음)
- 환경 변수에 API 키, 비밀번호 등 포함 시 절대 공개 저장소에 커밋하지 않기

---

## 📊 환경 변수 체크리스트

### 프로덕션 배포 전

- [ ] 루트 `.env.production`에 올바른 URL 설정 확인
  - `NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1`
  - `NEXT_PUBLIC_BACKEND_URL=https://www.codebase.blog`
  - `NEXT_PUBLIC_SITE_URL=https://www.codebase.blog`

- [ ] GitHub Secrets의 `ENV_FILE` 값 확인

- [ ] Docker 빌드 시 환경 변수 주입 확인
  ```bash
  docker compose -f docker-compose.prod.oracle.yml build frontend --progress=plain 2>&1 | grep NEXT_PUBLIC
  ```

- [ ] 빌드된 코드에 잘못된 URL이 없는지 확인
  ```bash
  # localhost가 포함되어 있으면 안됨
  docker exec codebase-prod-frontend grep -r "localhost:3000" .next/ || echo "OK"
  ```

### 로컬 개발 시

- [ ] `frontend/.env.local` 파일 생성 확인
- [ ] `backend/.env` 파일 생성 확인
- [ ] 데이터베이스 연결 확인
- [ ] Redis 연결 확인 (필요시)

---

## 🔗 관련 문서

- [Next.js 환경 변수 공식 문서](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Docker Compose 환경 변수](https://docs.docker.com/compose/environment-variables/)
- [프로젝트 개발 가이드](./CLAUDE.md)

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-01-30 | 초기 문서 작성, `frontend/.env.production` 제거 |
| 2025-10-30 | Next.js 환경 변수 로딩 메커니즘 섹션 추가, `frontend/.env.development` 삭제, `frontend/.env`에 NEXT_PUBLIC_SITE_URL 추가 |

---

**Last Updated**: 2025-10-30
**Maintainer**: Codebase Development Team
