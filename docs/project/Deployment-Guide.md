# Deployment Guide (배포 가이드)

## 목차
1. [개요](#개요)
2. [Docker 구성](#docker-구성)
3. [환경 변수](#환경-변수)
4. [로컬 개발 환경](#로컬-개발-환경)
5. [프로덕션 배포](#프로덕션-배포)
6. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
7. [모니터링 및 로깅](#모니터링-및-로깅)
8. [백업 및 복구](#백업-및-복구)
9. [문제 해결](#문제-해결)

---

## 개요

이 가이드는 My Blog App을 로컬 개발 환경과 프로덕션 환경에 배포하는 방법을 설명합니다.

### 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx/ALB)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Application Servers                      │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  Frontend (Next)  │             │  Backend (NestJS) │     │
│  │  Port: 3001       │             │  Port: 3000       │     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL  │  │   Redis     │  │    AWS S3/CF        │ │
│  │ Port: 5432  │  │  Port: 6379 │  │  (File Storage)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Docker 구성

### docker-compose.yml

프로젝트 루트에 있는 `docker-compose.yml` 파일은 로컬 개발에 필요한 인프라 서비스를 정의합니다.

```yaml
version: '3.8'

services:
  # PostgreSQL 데이터베이스
  postgres:
    image: postgres:14
    container_name: myblog_postgres
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-blog-db}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - myblog_network

  # Redis 캐시
  redis:
    image: redis:7-alpine
    container_name: myblog_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 6gb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - myblog_network

volumes:
  redis_data:
  postgres_data:

networks:
  myblog_network:
    driver: bridge
```

### Docker 명령어

#### 서비스 시작
```bash
# 모든 서비스 시작 (백그라운드)
docker-compose up -d

# 특정 서비스만 시작
docker-compose up -d postgres redis

# 로그 확인
docker-compose logs -f postgres
docker-compose logs -f redis
```

#### 서비스 중지 및 제거
```bash
# 서비스 중지
docker-compose stop

# 서비스 중지 및 컨테이너 제거
docker-compose down

# 볼륨까지 모두 제거 (데이터 삭제)
docker-compose down -v
```

#### 서비스 상태 확인
```bash
# 실행 중인 컨테이너 확인
docker-compose ps

# 특정 서비스 상태 확인
docker-compose exec postgres pg_isready
docker-compose exec redis redis-cli ping
```

### 프로덕션 Docker 설정

프로덕션 환경에서는 애플리케이션도 Docker로 실행할 수 있습니다.

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 소스 코드 복사 및 빌드
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/views ./dist/views

# 환경 변수
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 소스 코드 복사 및 빌드
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# 프로덕션 의존성 및 빌드 파일
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
```

#### 전체 스택 docker-compose (프로덕션)
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - myblog_network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - myblog_network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      AWS_S3_BUCKET: ${AWS_S3_BUCKET}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - myblog_network
    restart: unless-stopped
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000/api/v1
      NEXT_PUBLIC_BACKEND_URL: http://backend:3000
    depends_on:
      - backend
    networks:
      - myblog_network
    restart: unless-stopped
    ports:
      - "3001:3001"

volumes:
  postgres_data:
  redis_data:

networks:
  myblog_network:
    driver: bridge
```

---

## 환경 변수

### Backend 환경 변수 (backend/.env)

```bash
# Node 환경
NODE_ENV=production  # development | production

# 서버 설정
PORT=3000
HOST=0.0.0.0

# 데이터베이스
DATABASE_URL=postgresql://user:password@localhost:5432/blog-db
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=blog-db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT 인증
JWT_SECRET=your_jwt_secret_key_at_least_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d

# OAuth2 (선택사항)
# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback

# Kakao
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_CALLBACK_URL=http://localhost:3000/api/v1/auth/kakao/callback

# AWS S3
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_CLOUDFRONT_URL=https://your-cloudfront-domain.cloudfront.net

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_ORIGIN=http://localhost:3001

# 세션
SESSION_SECRET=your_session_secret_key

# 이메일 (Nodemailer)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASSWORD=your_email_app_password
MAIL_FROM=noreply@yourdomain.com

# YouTube 썸네일
YOUTUBE_THUMBNAIL_URL=https://img.youtube.com/vi/{id}/maxresdefault.jpg

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# 모니터링 (선택사항)
METRICS_PATH=/internal/health-check-2f4a8b9c
```

### Frontend 환경 변수 (frontend/.env.local)

```bash
# API 엔드포인트
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# WebSocket (Socket.IO)
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# 애플리케이션 URL
NEXT_PUBLIC_APP_URL=http://localhost:3001

# 환경
NODE_ENV=production  # development | production
```

### 환경 변수 관리 팁

1. **보안**: `.env` 파일은 절대 Git에 커밋하지 마세요
2. **템플릿**: `.env.example` 파일을 만들어 필요한 변수 목록 유지
3. **프로덕션**: AWS Secrets Manager, Vault 등 보안 저장소 사용 권장
4. **검증**: 애플리케이션 시작 시 필수 환경 변수 검증

---

## 로컬 개발 환경

### 1. 초기 설정

```bash
# 1. 저장소 클론
git clone <repository-url>
cd my-blog-app

# 2. Docker 서비스 시작
docker-compose up -d

# 3. 백엔드 설정
cd backend
pnpm install
cp .env.example .env  # 환경 변수 설정
pnpm migration:run    # 데이터베이스 마이그레이션

# 4. 프론트엔드 설정
cd ../frontend
pnpm install
cp .env.local.example .env.local  # 환경 변수 설정
```

### 2. 개발 서버 실행

**터미널 1 - 백엔드**
```bash
cd backend
pnpm start:dev
# 서버 시작: http://localhost:3000
# API 문서: http://localhost:3000/api-docs
```

**터미널 2 - 프론트엔드**
```bash
cd frontend
pnpm dev
# 서버 시작: http://localhost:3001
```

### 3. Hot Reload

- **Backend**: NestJS의 `--watch` 모드로 파일 변경 시 자동 재시작
- **Frontend**: Next.js의 Fast Refresh로 실시간 업데이트

---

## 프로덕션 배포

### 배포 체크리스트

#### 사전 준비
- [ ] 환경 변수 설정 완료
- [ ] 데이터베이스 백업
- [ ] SSL 인증서 설정
- [ ] DNS 설정
- [ ] S3 버킷 생성 및 권한 설정
- [ ] Redis 보안 설정 (비밀번호)

#### 보안 설정
- [ ] JWT 시크릿 키 강력하게 설정
- [ ] 데이터베이스 비밀번호 강력하게 설정
- [ ] CORS 허용 origin 제한
- [ ] Rate Limiting 활성화
- [ ] Helmet 보안 헤더 적용
- [ ] SQL Injection 방어 (TypeORM parameterized queries)

#### 성능 최적화
- [ ] Next.js 프로덕션 빌드
- [ ] 이미지 최적화 (Sharp, WebP)
- [ ] CDN 설정 (CloudFront)
- [ ] Redis 캐싱 활성화
- [ ] Database Connection Pooling
- [ ] 응답 압축 (Gzip/Brotli)

### AWS 배포 (EC2 + RDS + ElastiCache)

#### 1. RDS PostgreSQL 설정
```bash
# RDS 인스턴스 생성
- Engine: PostgreSQL 14
- Instance Class: db.t3.micro (개발) / db.m5.large (프로덕션)
- Storage: 20GB (Auto Scaling 활성화)
- Multi-AZ: Yes (프로덕션)
- Public Access: No
- VPC Security Group: PostgreSQL (5432) 허용

# 연결 테스트
psql -h <rds-endpoint> -U postgres -d blog-db
```

#### 2. ElastiCache Redis 설정
```bash
# ElastiCache 클러스터 생성
- Engine: Redis 7
- Node Type: cache.t3.micro (개발) / cache.m5.large (프로덕션)
- Number of Replicas: 1 (프로덕션)
- Encryption: Yes
- Auth Token: 설정 권장
```

#### 3. S3 + CloudFront 설정
```bash
# S3 버킷 생성
aws s3 mb s3://my-blog-app-uploads

# CORS 설정
aws s3api put-bucket-cors --bucket my-blog-app-uploads --cors-configuration file://cors.json

# cors.json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://yourdomain.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}

# CloudFront 배포 생성
- Origin: S3 버킷
- Viewer Protocol Policy: Redirect HTTP to HTTPS
- Compress Objects Automatically: Yes
```

#### 4. EC2 배포
```bash
# EC2 인스턴스 생성
- AMI: Amazon Linux 2023
- Instance Type: t3.small (개발) / t3.large (프로덕션)
- Security Group: HTTP (80), HTTPS (443), SSH (22)

# 인스턴스 연결
ssh -i keypair.pem ec2-user@<instance-ip>

# Node.js 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
npm install -g pnpm pm2

# 애플리케이션 배포
git clone <repository-url>
cd my-blog-app

# 백엔드 빌드 및 시작
cd backend
pnpm install --prod
pnpm build
pm2 start dist/main.js --name backend

# 프론트엔드 빌드 및 시작
cd ../frontend
pnpm install --prod
pnpm build
pm2 start npm --name frontend -- start

# PM2 자동 시작 설정
pm2 startup
pm2 save
```

### Nginx 리버스 프록시 설정

```nginx
# /etc/nginx/nginx.conf
server {
    listen 80;
    server_name yourdomain.com;

    # HTTP to HTTPS 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL 인증서 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 프론트엔드 (Next.js)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 백엔드 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket (Socket.IO)
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # 정적 파일 캐싱
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Let's Encrypt SSL 인증서 설정

```bash
# Certbot 설치
sudo yum install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 자동 갱신 설정 (Cron)
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 데이터베이스 마이그레이션

### 마이그레이션 명령어

```bash
# 새 마이그레이션 생성
cd backend
pnpm migration:generate -- src/migrations/MigrationName

# 마이그레이션 실행
pnpm migration:run

# 마이그레이션 되돌리기
pnpm migration:revert

# 마이그레이션 상태 확인
npm run typeorm migration:show
```

### 프로덕션 마이그레이션 절차

1. **백업 생성**
```bash
pg_dump -h <db-host> -U <db-user> -d blog-db > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **테스트 환경에서 검증**
```bash
# 테스트 DB에 마이그레이션 적용
NODE_ENV=test pnpm migration:run
# 애플리케이션 테스트
pnpm test
```

3. **프로덕션 적용**
```bash
# 메인터넌스 모드 활성화
# 마이그레이션 실행
NODE_ENV=production pnpm migration:run
# 애플리케이션 재시작
pm2 restart backend
```

4. **롤백 계획 준비**
```bash
# 문제 발생 시 롤백
pnpm migration:revert
# 백업에서 복구
psql -h <db-host> -U <db-user> -d blog-db < backup_20250113_100000.sql
```

---

## 모니터링 및 로깅

### PM2 모니터링

```bash
# 프로세스 상태 확인
pm2 status

# 로그 확인
pm2 logs backend
pm2 logs frontend

# 메모리 및 CPU 모니터링
pm2 monit

# 프로세스 재시작
pm2 restart backend
pm2 restart frontend

# 로그 파일 위치
~/.pm2/logs/
```

### Prometheus 메트릭

백엔드에 Prometheus 메트릭이 구현되어 있습니다:

```bash
# 메트릭 엔드포인트
curl http://localhost:3000/internal/health-check-2f4a8b9c

# 주요 메트릭
- http_requests_total: HTTP 요청 수
- http_request_duration_seconds: 응답 시간
- nodejs_heap_size_used_bytes: 메모리 사용량
```

### 로그 관리

```bash
# Backend 로그 레벨 설정
LOG_LEVEL=error,warn,log  # 프로덕션
LOG_LEVEL=error,warn,log,debug,verbose  # 개발

# Nginx 로그
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 백업 및 복구

### 데이터베이스 백업

#### 자동 백업 스크립트
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
DB_HOST="your-rds-endpoint"
DB_USER="postgres"
DB_NAME="blog-db"

# 백업 생성
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

#### Cron 설정
```bash
# 매일 새벽 2시 백업
0 2 * * * /path/to/backup-db.sh
```

### 복구

```bash
# 백업에서 복구
gunzip < backup_20250113_100000.sql.gz | psql -h <db-host> -U postgres -d blog-db

# 또는 압축 해제 후 복구
gunzip backup_20250113_100000.sql.gz
psql -h <db-host> -U postgres -d blog-db < backup_20250113_100000.sql
```

### S3 파일 백업

```bash
# S3 버킷 간 복사 (백업)
aws s3 sync s3://my-blog-app-uploads s3://my-blog-app-backups

# 스케줄링 (Cron)
0 3 * * * aws s3 sync s3://my-blog-app-uploads s3://my-blog-app-backups
```

---

## 문제 해결

### 1. 데이터베이스 연결 실패

**증상**: `ECONNREFUSED` 또는 `connection timeout`

**해결방법**:
```bash
# PostgreSQL 실행 확인
docker-compose ps postgres
# 또는
sudo systemctl status postgresql

# 포트 확인
lsof -i :5432

# 연결 테스트
psql -h localhost -U postgres -d blog-db

# Docker 로그 확인
docker-compose logs postgres
```

### 2. Redis 연결 실패

**증상**: Redis connection error

**해결방법**:
```bash
# Redis 실행 확인
docker-compose ps redis

# 연결 테스트
redis-cli ping

# 비밀번호 설정 시
redis-cli -a <password> ping

# Docker 로그
docker-compose logs redis
```

### 3. 포트 충돌

**증상**: `EADDRINUSE: address already in use`

**해결방법**:
```bash
# 포트 사용 프로세스 확인
lsof -i :3000  # 백엔드
lsof -i :3001  # 프론트엔드

# 프로세스 종료
kill -9 <PID>
```

### 4. 메모리 부족

**증상**: Out of memory error

**해결방법**:
```bash
# Node.js 메모리 제한 증가
NODE_OPTIONS=--max-old-space-size=4096 npm start

# PM2 메모리 제한
pm2 start app.js --max-memory-restart 1G
```

### 5. S3 업로드 실패

**증상**: 파일 업로드 시 403 Forbidden

**해결방법**:
- AWS 자격 증명 확인
- S3 버킷 권한 확인
- CORS 설정 확인

```bash
# AWS 자격 증명 테스트
aws s3 ls s3://my-blog-app-uploads

# CORS 설정 확인
aws s3api get-bucket-cors --bucket my-blog-app-uploads
```

### 6. 빌드 실패

**증상**: `pnpm build` 실패

**해결방법**:
```bash
# 노드 모듈 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 캐시 정리
pnpm cache clean --force

# TypeScript 타입 체크
pnpm type-check
```

---

## 성능 최적화

### 1. Database Query 최적화
- 적절한 인덱스 생성
- N+1 쿼리 문제 해결 (Eager Loading)
- Connection Pooling 설정

### 2. Redis 캐싱
- 자주 조회되는 데이터 캐싱
- TTL 적절히 설정
- Cache Invalidation 전략

### 3. CDN 활용
- 정적 파일 CloudFront로 서빙
- 이미지 최적화 (WebP, 리사이징)
- 브라우저 캐싱 설정

### 4. 애플리케이션 최적화
- Next.js Code Splitting
- React Query 캐싱
- 이미지 Lazy Loading
- API Response 압축

---

## 보안 권장사항

1. **환경 변수**: 민감한 정보는 환경 변수로 관리
2. **HTTPS**: 프로덕션에서 반드시 HTTPS 사용
3. **JWT 시크릿**: 최소 32자 이상의 강력한 키
4. **Rate Limiting**: API 남용 방지
5. **CORS**: 허용된 origin만 접근 가능
6. **SQL Injection**: TypeORM의 parameterized queries 사용
7. **XSS**: DOMPurify로 사용자 입력 sanitization
8. **CSRF**: SameSite 쿠키 설정
9. **업데이트**: 정기적인 의존성 업데이트
10. **모니터링**: 의심스러운 활동 모니터링

---

## 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [NestJS 배포 가이드](https://docs.nestjs.com/deployment)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [AWS EC2 문서](https://docs.aws.amazon.com/ec2/)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [Redis 공식 문서](https://redis.io/documentation)

---

**마지막 업데이트**: 2025-01-13
