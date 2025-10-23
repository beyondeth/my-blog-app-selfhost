# Oracle Cloud Free Tier 프로덕션 배포 가이드

## 목차
1. [시스템 개요](#시스템-개요)
2. [사전 준비사항](#사전-준비사항)
3. [초기 서버 설정](#초기-서버-설정)
4. [애플리케이션 배포](#애플리케이션-배포)
5. [업데이트 배포 프로세스](#업데이트-배포-프로세스)
6. [IP 화이트리스트 관리](#ip-화이트리스트-관리)
7. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
8. [모니터링 및 로그](#모니터링-및-로그)
9. [트러블슈팅](#트러블슈팅)

---

## 시스템 개요

### 하드웨어 스펙 (Oracle Cloud Free Tier)
- **CPU**: 4 OCPU (ARM64)
- **RAM**: 24 GB
- **스토리지**: 100 GB Block Volume (SSD)
- **네트워크**: Public IP + Cloudflare CDN

### 소프트웨어 스택
- **OS**: Ubuntu 22.04 LTS (ARM64)
- **웹서버**: Nginx (네이티브 설치)
- **컨테이너**: Docker + Docker Compose
- **프론트엔드**: Next.js 14 (Standalone)
- **백엔드**: NestJS 10
- **데이터베이스**: PostgreSQL 18
- **캐시/큐**: Redis 7.4
- **모니터링**: VictoriaMetrics + Grafana

### 리소스 할당
```
총 CPU: 3.8 OCPU (4 OCPU 중 95%, 0.2 OCPU 여유)
총 RAM: 18.3 GB (24 GB 중 76%, 5.7 GB 여유)

서비스별:
- frontend:        0.4 OCPU, 768 MB
- backend:         1.2 OCPU, 2.5 GB
- postgres:        1.0 OCPU, 8 GB (실제 4~5GB 사용)
- redis:           0.3 OCPU, 5.5 GB (실제 3.5GB 사용)
- mcp-proxy:       0.5 OCPU, 1 GB
- victoriametrics: 0.1 OCPU, 100 MB
- grafana:         0.2 OCPU, 300 MB
- redis-exporter:  0.1 OCPU, 50 MB
```

---

## 사전 준비사항

### 1. 로컬 환경
```bash
# Git 저장소 최신 버전
git pull origin main

# Docker 및 Docker Compose 설치 확인
docker --version  # 20.10+ 권장
docker compose version  # 2.0+ 권장
```

### 2. 필요한 파일 및 정보
- SSH Private Key: `ssh-key-2025-10-23.key`
- 서버 IP: `158.178.236.98`
- 도메인: `codebase.blog`, `www.codebase.blog`, `mcp.codebase.blog`
- `.env.production` 파일 (서버에 직접 생성)

### 3. DNS 설정 (Cloudflare)
```
codebase.blog (루트)     → 158.178.236.98 → 🟠 Proxied
www.codebase.blog        → 158.178.236.98 → 🟠 Proxied
mcp.codebase.blog        → 158.178.236.98 → 🟠 Proxied
```

---

## 초기 서버 설정

### 1. SSH 접속
```bash
ssh -i "/path/to/ssh-key-2025-10-23.key" ubuntu@158.178.236.98
```

### 2. 시스템 패키지 업데이트
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Docker 설치 (ARM64)
```bash
# Docker 공식 설치 스크립트
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 사용자 권한 추가
sudo usermod -aG docker ubuntu
newgrp docker

# Docker Compose 설치 (v2)
sudo apt install docker-compose-plugin -y
```

### 4. Nginx 설치 및 설정
```bash
# Nginx 설치
sudo apt install nginx -y

# SSL 인증서 설정 (Certbot)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d codebase.blog -d www.codebase.blog -d mcp.codebase.blog
```

### 5. Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/default
```

**설정 내용** (`/etc/nginx/sites-available/default`):
```nginx
# ============================================
# IP 화이트리스트 (허용된 IP = 1, 그 외 = 0)
# ============================================
geo $allowed_ip {
    default 0;
    124.60.151.144 1;  # 개발자 IP (필요 시 추가)
}

# ============================================
# HTTP → HTTPS 리다이렉트
# ============================================
server {
    listen 80;
    listen [::]:80;
    server_name codebase.blog www.codebase.blog mcp.codebase.blog;
    return 301 https://$host$request_uri;
}

# ============================================
# HTTPS - www.codebase.blog (메인 웹사이트)
# ============================================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.codebase.blog codebase.blog;

    # SSL 인증서 (Certbot 자동 생성)
    ssl_certificate /etc/letsencrypt/live/codebase.blog/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/codebase.blog/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Coming Soon 페이지 서빙
    location = /coming-soon.html {
        root /var/www/html;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # IP 화이트리스트 체크 (루트 경로만)
    location / {
        if ($allowed_ip = 0) {
            return 302 /coming-soon.html;
        }

        # Next.js Frontend (SSR)
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API (IP 체크 제외 - API는 항상 접근 가능)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS 헤더 (백엔드에서 처리하므로 불필요)
        # add_header Access-Control-Allow-Origin "*";
    }

    # Socket.IO (WebSocket)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 파일 업로드 크기 제한
    client_max_body_size 50M;
}

# ============================================
# HTTPS - mcp.codebase.blog (MCP Proxy)
# ============================================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mcp.codebase.blog;

    # SSL 인증서
    ssl_certificate /etc/letsencrypt/live/codebase.blog/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/codebase.blog/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # MCP Proxy (IP 체크 없음 - API 서버)
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10M;
}
```

### 6. Coming Soon 페이지 생성
```bash
sudo mkdir -p /var/www/html
sudo nano /var/www/html/coming-soon.html
```

**Coming Soon 페이지 내용**:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coming Soon - Codebase.blog</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            animation: gradientShift 10s ease infinite;
            background-size: 200% 200%;
        }

        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        .container {
            text-align: center;
            color: white;
            padding: 2rem;
            animation: fadeIn 1s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .emoji {
            font-size: 5rem;
            margin-bottom: 1rem;
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }

        h1 {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        p {
            font-size: 1.25rem;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🚀</div>
        <h1>Coming Soon</h1>
        <p>곧 멋진 서비스로 찾아뵙겠습니다!</p>
    </div>
</body>
</html>
```

### 7. Nginx 재시작
```bash
sudo nginx -t  # 설정 파일 검증
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 8. Block Volume 마운트
```bash
# Block Volume 생성 및 마운트 (Oracle Cloud 콘솔에서 수행)
sudo mkdir -p /mnt/data
sudo mkfs.ext4 /dev/sdb  # Block Volume 디바이스 확인 필요
sudo mount /dev/sdb /mnt/data

# 영구 마운트 설정
echo '/dev/sdb /mnt/data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab

# 데이터 디렉토리 생성
sudo mkdir -p /mnt/data/{postgres,redis,grafana,victoriametrics}
sudo chown -R 999:999 /mnt/data/postgres  # PostgreSQL UID
sudo chown -R 999:999 /mnt/data/redis      # Redis UID
sudo chown -R 472:472 /mnt/data/grafana    # Grafana UID
sudo chmod -R 755 /mnt/data
```

---

## 애플리케이션 배포

### 1. 코드 복사
```bash
# 로컬에서 서버로 코드 복사
rsync -avz --exclude 'node_modules' --exclude '.git' \
  -e "ssh -i /path/to/ssh-key-2025-10-23.key" \
  /Users/sihyungpark/Desktop/code/my-blog-app/ \
  ubuntu@158.178.236.98:~/my-blog-app/
```

또는 Git을 사용:
```bash
# 서버에서 실행
cd ~
git clone https://github.com/your-username/my-blog-app.git
cd my-blog-app
```

### 2. 환경 변수 설정
```bash
cd ~/my-blog-app

# .env.production 파일 생성
nano .env.production
```

**.env.production 템플릿**:
```env
# ============================================
# 프로덕션 환경 변수
# ============================================

# Node.js 환경
NODE_ENV=production

# 데이터베이스 (PostgreSQL)
DB_HOST=postgres
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=blog_prod
DB_URL=postgresql://your_db_user:your_secure_password@postgres:5432/blog_prod?sslmode=disable

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# JWT 인증
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=30d

# OAuth2 (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://www.codebase.blog/api/v1/auth/google/callback

# OAuth2 (GitHub)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://www.codebase.blog/api/v1/auth/github/callback

# OAuth2 (Kakao)
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_CALLBACK_URL=https://www.codebase.blog/api/v1/auth/kakao/callback

# AWS S3 (파일 업로드)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket_name

# Frontend URLs
NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1
NEXT_PUBLIC_BACKEND_URL=https://www.codebase.blog
NEXT_PUBLIC_OAUTH_CALLBACK_URL=https://www.codebase.blog/oauth/callback

# MCP Proxy
MCP_BACKEND_URL=http://backend:3000
MCP_BACKEND_INTERNAL_HEALTH_CHECK_TOKEN=your_internal_token

# Grafana
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=your_grafana_password
GF_LOG_LEVEL=info

# Docker Compose
COMPOSE_PROJECT_NAME=codebase-prod
DOMAIN=codebase.blog
```

### 3. Docker 이미지 빌드 및 실행
```bash
# 프로덕션 Docker Compose 실행
docker compose -f docker-compose.prod.oracle.yml up -d --build

# 로그 확인
docker compose -f docker-compose.prod.oracle.yml logs -f

# 서비스 상태 확인
docker compose -f docker-compose.prod.oracle.yml ps
```

### 4. 데이터베이스 마이그레이션 실행
```bash
# Backend 컨테이너 접속
docker exec -it codebase-prod-backend bash

# 마이그레이션 실행
npm run migration:run

# 확인
npm run migration:show

# 종료
exit
```

### 5. 헬스체크 확인
```bash
# Frontend
curl http://localhost:3001

# Backend API
curl http://localhost:3000/api/v1/health

# MCP Proxy
curl http://localhost:3002/health

# PostgreSQL
docker exec codebase-prod-postgres pg_isready -U your_db_user -d blog_prod

# Redis
docker exec codebase-prod-redis redis-cli ping
```

---

## 업데이트 배포 프로세스

### 일반적인 업데이트 (코드 변경만)

```bash
# 1. 로컬에서 변경사항 커밋 및 푸시
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# 2. 서버에서 최신 코드 가져오기
ssh -i "/path/to/ssh-key-2025-10-23.key" ubuntu@158.178.236.98
cd ~/my-blog-app
git pull origin main

# 3. Docker 컨테이너 재빌드 및 재시작
docker compose -f docker-compose.prod.oracle.yml up -d --build

# 4. 헬스체크 확인
docker compose -f docker-compose.prod.oracle.yml ps
```

### 프론트엔드만 업데이트
```bash
# 서버에서 실행
cd ~/my-blog-app
git pull origin main

# Frontend만 재빌드
docker compose -f docker-compose.prod.oracle.yml stop frontend
docker compose -f docker-compose.prod.oracle.yml build frontend
docker compose -f docker-compose.prod.oracle.yml up -d frontend

# 로그 확인
docker compose -f docker-compose.prod.oracle.yml logs -f frontend
```

### 백엔드만 업데이트
```bash
# 서버에서 실행
cd ~/my-blog-app
git pull origin main

# Backend만 재빌드
docker compose -f docker-compose.prod.oracle.yml stop backend
docker compose -f docker-compose.prod.oracle.yml build backend
docker compose -f docker-compose.prod.oracle.yml up -d backend

# 로그 확인
docker compose -f docker-compose.prod.oracle.yml logs -f backend
```

### 환경 변수 변경 시
```bash
# 1. .env.production 파일 수정
nano ~/my-blog-app/.env.production

# 2. 영향받는 서비스만 재시작
docker compose -f docker-compose.prod.oracle.yml restart backend

# 3. Frontend 환경변수 변경 시 재빌드 필수 (NEXT_PUBLIC_* 변수)
docker compose -f docker-compose.prod.oracle.yml stop frontend
docker compose -f docker-compose.prod.oracle.yml build frontend
docker compose -f docker-compose.prod.oracle.yml up -d frontend
```

### 데이터베이스 스키마 변경 시
```bash
# 1. 로컬에서 마이그레이션 생성
cd backend
pnpm migration:generate -- src/migrations/YourMigrationName

# 2. Git 커밋 및 푸시
git add src/migrations/
git commit -m "db: 새로운 마이그레이션 추가"
git push origin main

# 3. 서버에서 코드 가져오기 및 재빌드
cd ~/my-blog-app
git pull origin main
docker compose -f docker-compose.prod.oracle.yml stop backend
docker compose -f docker-compose.prod.oracle.yml build backend
docker compose -f docker-compose.prod.oracle.yml up -d backend

# 4. 마이그레이션 실행
docker exec -it codebase-prod-backend npm run migration:run
docker exec -it codebase-prod-backend npm run migration:show
```

### 롤백 (문제 발생 시)
```bash
# 1. Git 이전 커밋으로 복원
cd ~/my-blog-app
git log --oneline  # 이전 커밋 확인
git checkout <commit-hash>

# 2. 재빌드 및 재시작
docker compose -f docker-compose.prod.oracle.yml up -d --build

# 3. 데이터베이스 마이그레이션 롤백 (필요 시)
docker exec -it codebase-prod-backend npm run migration:revert
```

---

## IP 화이트리스트 관리

### IP 추가하기
```bash
# 1. Nginx 설정 파일 수정
sudo nano /etc/nginx/sites-available/default

# 2. geo 블록에 IP 추가
geo $allowed_ip {
    default 0;
    124.60.151.144 1;     # 기존 IP
    203.0.113.45 1;       # 새로운 IP 추가
    192.168.1.100 1;      # 추가 IP
}

# 3. 설정 검증 및 재시작
sudo nginx -t
sudo systemctl restart nginx
```

### IP 범위 추가 (CIDR 표기)
```nginx
geo $allowed_ip {
    default 0;
    124.60.151.144 1;         # 개별 IP
    203.0.113.0/24 1;         # IP 범위 (203.0.113.0 ~ 203.0.113.255)
    192.168.1.0/24 1;         # 사내 네트워크
}
```

### IP 화이트리스트 비활성화 (전체 공개)
```bash
# 1. Nginx 설정 파일 수정
sudo nano /etc/nginx/sites-available/default

# 2. IP 체크 블록 주석 처리
# location / {
#     if ($allowed_ip = 0) {
#         return 302 /coming-soon.html;
#     }
#     proxy_pass http://127.0.0.1:3001;
# }

# 3. 단순 프록시로 변경
location / {
    proxy_pass http://127.0.0.1:3001;
    # ... (나머지 설정 동일)
}

# 4. 재시작
sudo nginx -t
sudo systemctl restart nginx
```

### Coming Soon 페이지 수정
```bash
sudo nano /var/www/html/coming-soon.html

# 내용 수정 후 저장 (Nginx 재시작 불필요)
```

---

## 데이터베이스 마이그레이션

### 마이그레이션 생성 (로컬 개발)
```bash
cd backend
pnpm migration:generate -- src/migrations/AddNewFeature
```

### 마이그레이션 실행 (프로덕션)
```bash
# Backend 컨테이너 접속
docker exec -it codebase-prod-backend bash

# 마이그레이션 실행
npm run migration:run

# 실행된 마이그레이션 확인
npm run migration:show

# 종료
exit
```

### 마이그레이션 롤백
```bash
# 마지막 마이그레이션 1개 롤백
docker exec -it codebase-prod-backend npm run migration:revert

# 특정 마이그레이션까지 롤백 (여러 개)
docker exec -it codebase-prod-backend npm run migration:revert
docker exec -it codebase-prod-backend npm run migration:revert
```

### 데이터베이스 백업
```bash
# 백업 생성
docker exec codebase-prod-postgres pg_dump -U your_db_user blog_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# 백업 복원 (주의: 기존 데이터 삭제됨)
cat backup_20251023_120000.sql | docker exec -i codebase-prod-postgres psql -U your_db_user blog_prod
```

---

## 모니터링 및 로그

### Grafana 대시보드
- URL: `http://158.178.236.98:3030` (로컬 포트 포워딩)
- 계정: `.env.production`의 `GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`

### Docker 로그 확인
```bash
# 전체 서비스 로그 (실시간)
docker compose -f docker-compose.prod.oracle.yml logs -f

# 특정 서비스 로그
docker compose -f docker-compose.prod.oracle.yml logs -f backend
docker compose -f docker-compose.prod.oracle.yml logs -f frontend
docker compose -f docker-compose.prod.oracle.yml logs -f postgres

# 최근 100줄만 보기
docker compose -f docker-compose.prod.oracle.yml logs --tail 100 backend
```

### 시스템 리소스 모니터링
```bash
# Docker 컨테이너 리소스 사용량
docker stats

# 시스템 전체 리소스
htop  # 또는 top

# 디스크 사용량
df -h
du -sh /mnt/data/*
```

### PostgreSQL 쿼리 모니터링
```bash
# 느린 쿼리 로그 확인
docker exec codebase-prod-postgres tail -f /var/lib/postgresql/data/pgdata/log/postgresql-*.log

# 실행 중인 쿼리 확인
docker exec codebase-prod-postgres psql -U your_db_user blog_prod -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"
```

### Redis 모니터링
```bash
# Redis 메모리 사용량
docker exec codebase-prod-redis redis-cli INFO memory

# Redis 키 개수
docker exec codebase-prod-redis redis-cli DBSIZE

# Redis 실시간 명령어 모니터링
docker exec codebase-prod-redis redis-cli MONITOR
```

---

## 트러블슈팅

### 1. CORS 에러 발생
**증상**: 프론트엔드에서 API 호출 시 CORS 에러

**원인**: 프론트엔드가 잘못된 API URL로 요청

**해결**:
```bash
# 1. frontend/.env.production 확인
cat ~/my-blog-app/frontend/.env.production
# NEXT_PUBLIC_API_URL=https://www.codebase.blog/api/v1 확인

# 2. Frontend 재빌드 (환경변수는 빌드 타임에 고정됨)
docker compose -f docker-compose.prod.oracle.yml stop frontend
docker compose -f docker-compose.prod.oracle.yml build frontend
docker compose -f docker-compose.prod.oracle.yml up -d frontend
```

### 2. PostgreSQL 연결 실패
**증상**: `no pg_hba.conf entry for host` 에러

**원인**: PostgreSQL 인증 설정 문제

**해결**:
```bash
# 1. pg_hba.conf 확인
cat ~/my-blog-app/postgres/pg_hba.conf
# hostnossl all all 0.0.0.0/0 md5 확인

# 2. DATABASE_URL 확인 (.env.production)
# postgresql://user:pass@postgres:5432/blog_prod?sslmode=disable

# 3. PostgreSQL 재시작
docker compose -f docker-compose.prod.oracle.yml restart postgres

# 4. 연결 테스트
docker exec codebase-prod-backend sh -c 'psql $DATABASE_URL -c "SELECT 1;"'
```

### 3. 마이그레이션 실패
**증상**: `Cannot find migrations at /app/src/migrations/`

**원인**: 프로덕션 환경에서 TypeScript 소스 경로 사용

**해결**:
```bash
# 1. backend/src/data-source.ts 확인
# isProduction 변수로 경로 자동 전환 확인

# 2. Backend 재빌드
docker compose -f docker-compose.prod.oracle.yml stop backend
docker compose -f docker-compose.prod.oracle.yml build backend
docker compose -f docker-compose.prod.oracle.yml up -d backend

# 3. 마이그레이션 재실행
docker exec -it codebase-prod-backend npm run migration:run
```

### 4. Frontend 빌드 실패 (Lockfile 에러)
**증상**: `ERR_PNPM_OUTDATED_LOCKFILE`

**원인**: `pnpm-lock.yaml` 버전 불일치

**해결**:
```bash
# Dockerfile.prod에 --no-frozen-lockfile 옵션 확인
# RUN pnpm install --prod --no-frozen-lockfile

# 재빌드
docker compose -f docker-compose.prod.oracle.yml build frontend --no-cache
```

### 5. Nginx 502 Bad Gateway
**증상**: 웹사이트 접속 시 502 에러

**원인**: 백엔드/프론트엔드 컨테이너 다운

**해결**:
```bash
# 1. 컨테이너 상태 확인
docker compose -f docker-compose.prod.oracle.yml ps

# 2. 문제 컨테이너 로그 확인
docker compose -f docker-compose.prod.oracle.yml logs backend
docker compose -f docker-compose.prod.oracle.yml logs frontend

# 3. 재시작
docker compose -f docker-compose.prod.oracle.yml restart backend frontend

# 4. Nginx 재시작
sudo systemctl restart nginx
```

### 6. 디스크 공간 부족
**증상**: `no space left on device`

**원인**: Docker 이미지/볼륨 누적

**해결**:
```bash
# Docker 정리 (주의: 사용하지 않는 모든 데이터 삭제)
docker system prune -a --volumes

# 특정 이미지만 삭제
docker images
docker rmi <image-id>

# 로그 파일 정리
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### 7. 메모리 부족 (OOM Killer)
**증상**: 컨테이너 갑자기 종료

**원인**: 메모리 제한 초과

**해결**:
```bash
# 1. 메모리 사용량 확인
docker stats

# 2. docker-compose.prod.oracle.yml에서 mem_limit 조정
# backend:
#   mem_limit: 2.5g  → 3g로 증가

# 3. 재시작
docker compose -f docker-compose.prod.oracle.yml up -d --force-recreate backend
```

### 8. SSL 인증서 만료
**증상**: 브라우저에서 "Your connection is not private" 경고

**원인**: Let's Encrypt 인증서 만료 (90일)

**해결**:
```bash
# 인증서 갱신 (자동)
sudo certbot renew

# 수동 갱신
sudo certbot renew --nginx

# Nginx 재시작
sudo systemctl restart nginx

# Cron 자동 갱신 설정 확인
sudo systemctl status certbot.timer
```

---

## 보안 체크리스트

### 배포 전 필수 확인사항
- [ ] `.env.production` 파일의 모든 시크릿 키 변경 (예시 값 사용 금지)
- [ ] JWT_SECRET, JWT_REFRESH_SECRET 최소 32자 이상
- [ ] 데이터베이스 비밀번호 강력하게 설정
- [ ] Grafana 관리자 비밀번호 변경
- [ ] OAuth2 Callback URL이 프로덕션 도메인으로 설정
- [ ] Nginx SSL 인증서 정상 작동 확인
- [ ] IP 화이트리스트 활성화 (초기 배포 시)
- [ ] 방화벽 규칙 확인 (Oracle Cloud Security List)

### 운영 중 주기적 점검
- [ ] SSL 인증서 만료일 확인 (90일마다 자동 갱신)
- [ ] Docker 이미지 보안 업데이트
- [ ] PostgreSQL, Redis, Nginx 버전 업데이트
- [ ] 로그 파일 정기 정리
- [ ] 데이터베이스 백업 (일/주 단위)
- [ ] 모니터링 알림 설정 (Grafana)

---

## 참고 자료

### 주요 포트 정리
```
3000 - Backend (NestJS) - 외부 노출 안됨
3001 - Frontend (Next.js) - 외부 노출 안됨
3002 - MCP Proxy - 외부 노출 안됨
3030 - Grafana - 외부 노출 안됨 (SSH 터널 사용)
5432 - PostgreSQL - 내부 전용
6379 - Redis - 내부 전용
8428 - VictoriaMetrics - 내부 전용
9121 - Redis Exporter - 내부 전용

80   - Nginx (HTTP → HTTPS 리다이렉트)
443  - Nginx (HTTPS) - 유일한 외부 노출 포트
```

### 유용한 명령어 모음
```bash
# 전체 서비스 재시작
docker compose -f docker-compose.prod.oracle.yml restart

# 특정 서비스만 재빌드
docker compose -f docker-compose.prod.oracle.yml up -d --build backend

# 로그 실시간 확인 (모든 서비스)
docker compose -f docker-compose.prod.oracle.yml logs -f

# 컨테이너 내부 접속
docker exec -it codebase-prod-backend bash

# 데이터베이스 접속
docker exec -it codebase-prod-postgres psql -U your_db_user blog_prod

# Redis CLI 접속
docker exec -it codebase-prod-redis redis-cli

# 시스템 리소스 확인
docker stats
htop
df -h
```

### 긴급 연락처
- 도메인 DNS: Cloudflare
- 서버 호스팅: Oracle Cloud Free Tier
- SSL 인증서: Let's Encrypt (Certbot)

---

**최종 업데이트**: 2025-10-23
**작성자**: Sihyung Park
**버전**: 1.0.0
