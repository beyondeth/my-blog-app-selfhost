# Docker 환경 표준화 및 배포 가이드

## 📋 변경 사항 요약

### 1. 환경변수 정리 및 표준화
- **삭제된 파일**: 9개 이상의 중복/산재된 .env 파일
- **새로운 구조**:
  - `.env.development` - 로컬 개발 환경 (PostgreSQL 컨테이너)
  - `.env.production` - Oracle VM 프로덕션 환경 (AWS RDS)
  - `.env.example` - Git 커밋용 템플릿
  - `backend/.env.example` - Backend 독립 실행용 템플릿
  - `frontend/.env.example` - Frontend 독립 실행용 템플릿

### 2. Docker Compose 구조 개선
- **Base 파일**: `docker-compose.yml` - Redis 등 공통 인프라
- **개발 환경**: `docker-compose.dev.yml` - PostgreSQL + Hot Reload
- **프로덕션**: `docker-compose.prod.yml` - AWS RDS + 최적화 빌드

### 3. 컨테이너 네이밍 표준화
```
이전: myblog_redis, unified-prometheus (일관성 없음)
이후: codebase-{env}-{service} 또는 codebase-{category}-{service}
```

**적용된 네이밍**:
- `codebase-dev-backend`, `codebase-dev-mcp-proxy`, `codebase-dev-postgres`
- `codebase-shared-redis` (개발/프로덕션 공유)
- `codebase-monitoring-prometheus`, `codebase-monitoring-grafana`

### 4. Docker 이미지 버전 고정
- **Node.js**: `22-alpine` (LTS until 2027-04-30)
- **PostgreSQL**: `16-alpine` (안정화 버전)
- **Redis**: `7.4-alpine`
- **Prometheus**: `v2.54.0`
- **Grafana**: `11.3.0`
- **Redis Exporter**: `v1.62.0-alpine`
- **Node Exporter**: `v1.8.2`

### 5. Multi-stage Dockerfile 생성
- **Development Stage**: Hot Reload 지원, volume 마운트
- **Builder Stage**: 의존성 설치 및 빌드
- **Production Stage**: 최적화된 런타임, 비-루트 사용자

### 6. .gitignore 업데이트
```
# 실제 값 포함된 환경변수 파일들 무시
**/.env
**/.env.local
**/.env.development
**/.env.production
**/.env.monitoring

# 템플릿 파일은 Git에 포함
!**/.env.example
```

## 🚀 사용 방법

### 개발 환경 실행
```bash
# 개발 환경 시작 (PostgreSQL 컨테이너 + Hot Reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 로그 확인
docker compose logs -f backend
docker compose logs -f mcp-proxy

# 중지
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### 프로덕션 빌드 (Oracle VM)
```bash
# 프로덕션 빌드 및 시작 (AWS RDS 연결)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 중지
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

### 모니터링 스택 실행
```bash
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml up -d

# 접속 정보
# Grafana: http://localhost:3030 (admin/admin)
# Prometheus: http://localhost:9090
```

## 📊 실행 중인 컨테이너

### 개발 환경 컨테이너
```
codebase-dev-backend        - NestJS Backend (Hot Reload)
codebase-dev-mcp-proxy     - MCP Proxy Server (Hot Reload)
codebase-dev-postgres      - PostgreSQL 16
codebase-shared-redis      - Redis 7.4
```

### 모니터링 컨테이너
```
codebase-monitoring-prometheus      - 메트릭 수집
codebase-monitoring-grafana         - 대시보드
codebase-monitoring-redis-exporter  - Redis 메트릭
codebase-monitoring-node-exporter   - 시스템 메트릭
```

## 🔧 환경변수 설정

### 개발 환경 (.env.development)
```bash
NODE_ENV=development
COMPOSE_PROJECT_NAME=codebase-dev

# PostgreSQL (로컬 컨테이너)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/blog-dev?sslmode=disable

# OAuth (localhost 콜백)
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# MCP Roots
MCP_ROOTS_ALLOWED_DIRS=/Users/sihyungpark/Desktop/code/codebase,/Users/sihyungpark/Documents
```

### 프로덕션 환경 (.env.production)
```bash
NODE_ENV=production
COMPOSE_PROJECT_NAME=codebase-prod

# PostgreSQL (AWS RDS)
DATABASE_URL=postgresql://postgres:postgres@codebase.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com:5432/blog-db

# OAuth (프로덕션 도메인 - 변경 필수!)
GOOGLE_CALLBACK_URL=https://your-domain.com/api/v1/auth/google/callback

# MCP Roots (Oracle VM)
MCP_ROOTS_ALLOWED_DIRS=/home/ubuntu/codebase,/home/ubuntu/documents
```

## ⚠️ 중요 사항

### 프로덕션 배포 전 체크리스트
- [ ] .env.production의 도메인 URL 변경 (your-domain.com → 실제 도메인)
- [ ] JWT_SECRET 및 JWT_REFRESH_SECRET을 강력한 랜덤 키로 변경
- [ ] OAuth 클라이언트 ID/Secret을 프로덕션용으로 교체
- [ ] ENCRYPTION_KEY 및 ENCRYPTION_SALT 재생성
- [ ] SESSION_ENCRYPTION_KEY 재생성
- [ ] AWS RDS 접속 정보 확인
- [ ] CORS_ALLOWED_ORIGINS에 프로덕션 도메인 추가

### 보안 키 생성 방법
```bash
# JWT Secret (64 hex)
openssl rand -hex 64

# Encryption Key (32 hex)
openssl rand -hex 32

# Encryption Salt (16 hex)
openssl rand -hex 16
```

## 🔍 트러블슈팅

### Backend가 PostgreSQL에 연결 실패
```bash
# SSL 에러 해결: DATABASE_URL에 ?sslmode=disable 추가
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=disable

# 연결 테스트
docker exec -it codebase-dev-postgres psql -U postgres -d blog-dev
```

### 컨테이너가 재시작 반복
```bash
# 로그 확인
docker logs codebase-dev-backend --tail 50

# 환경변수 확인
docker exec codebase-dev-backend env | grep DATABASE_URL

# 강제 재빌드
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --force-recreate
```

### Hot Reload가 작동하지 않음
```bash
# Volume 마운트 확인
docker inspect codebase-dev-backend | grep Mounts -A 10

# 올바른 마운트:
# ./backend:/app (소스 코드)
# /app/node_modules (컨테이너 내부)
```

## 📝 파일 구조

```
/Users/sihyungpark/Desktop/code/my-blog-app/
├── .env.development          # 개발 환경변수 (Git 무시)
├── .env.production           # 프로덕션 환경변수 (Git 무시)
├── .env.example              # 환경변수 템플릿 (Git 포함)
├── docker-compose.yml        # Base 설정
├── docker-compose.dev.yml    # 개발 환경 오버라이드
├── docker-compose.prod.yml   # 프로덕션 오버라이드
├── .gitignore                # 환경변수 파일 제외 설정
│
├── backend/
│   ├── Dockerfile            # Multi-stage 빌드
│   └── .env.example          # Backend 독립 실행용 템플릿
│
├── frontend/
│   └── .env.example          # Frontend 독립 실행용 템플릿
│
├── mcp-proxy-server/
│   ├── Dockerfile            # Multi-stage 빌드
│   └── .env.example          # (기존 파일 유지)
│
└── monitoring/
    └── docker-compose.unified-monitoring.yml  # 모니터링 스택
```

## 🎯 다음 단계

### 권장 작업
1. **Frontend Dockerfile 생성** (향후 필요 시)
2. **Nginx 리버스 프록시 설정** (프로덕션 배포 시)
3. **CI/CD 파이프라인 구축** (GitHub Actions)
4. **Database Migration 자동화**
5. **로그 중앙화** (ELK Stack 또는 CloudWatch)

### 모니터링 개선
- Grafana 대시보드 커스터마이징
- Alert 규칙 설정 (Prometheus AlertManager)
- 로그 수집 및 분석 (Loki 추가)
- Trace 수집 (Jaeger 또는 Tempo)

---

**작업 완료일**: 2025-10-15
**작업자**: Claude Code
**환경**: macOS (개발), Oracle VM (프로덕션)
**Docker Compose 버전**: v2 (version 필드 제거)
