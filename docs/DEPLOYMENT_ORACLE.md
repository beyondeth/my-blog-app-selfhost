# Codebase 블로그 플랫폼 - Oracle Cloud 배포 가이드

## 목차
1. [사전 준비](#1-사전-준비)
2. [VM 초기 설정](#2-vm-초기-설정)
3. [Docker 설치](#3-docker-설치)
4. [Nginx 설치 및 SSL 설정](#4-nginx-설치-및-ssl-설정)
5. [애플리케이션 배포](#5-애플리케이션-배포)
6. [데이터베이스 마이그레이션](#6-데이터베이스-마이그레이션)
7. [모니터링 설정](#7-모니터링-설정)
8. [헬스체크 및 검증](#8-헬스체크-및-검증)
9. [백업 설정](#9-백업-설정)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 사전 준비

### 1.1 필수 정보 준비
배포 전 다음 정보를 준비하세요:

- [ ] Oracle Cloud 인스턴스 Public IP 주소
- [ ] 도메인 DNS 설정 (A 레코드: yourdomain.com → Public IP)
- [ ] GitHub/GitLab 배포용 SSH 키 또는 Personal Access Token
- [ ] 다음 시크릿 키 생성:
```bash
# DB 비밀번호 생성 (32자 이상)
openssl rand -base64 32

# JWT Secret 생성 (32자 이상)
openssl rand -base64 32
```

### 1.2 Oracle Cloud 설정 확인
`docs/ORACLE_CLOUD_SETUP.md`를 참고하여 다음을 완료했는지 확인:

- [ ] Compute Instance 생성 (VM.Standard.A1.Flex, 4 OCPU, 24GB RAM)
- [ ] Block Volume 200GB 생성 및 연결
- [ ] Security List 설정 (포트 22, 80, 443 개방)
- [ ] SSH 키 페어 준비

---

## 2. VM 초기 설정

### 2.1 SSH 접속
```bash
# SSH 키 권한 설정 (로컬 머신에서)
chmod 600 ~/path/to/ssh-key-private.key

# VM 접속
ssh -i ~/path/to/ssh-key-private.key ubuntu@<PUBLIC_IP>
```

### 2.2 시스템 업데이트
```bash
# 패키지 리스트 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 유틸리티 설치
sudo apt install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  ufw \
  fail2ban \
  ca-certificates \
  gnupg \
  lsb-release

# 타임존 설정 (한국 시간)
sudo timedatectl set-timezone Asia/Seoul

# 시스템 재부팅 (커널 업데이트 반영)
sudo reboot
```

### 2.3 Block Volume 마운트
SSH 재접속 후 Block Volume을 영구적으로 마운트합니다.

```bash
# 연결된 블록 볼륨 확인
lsblk
# 출력 예시:
# NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
# sda      8:0    0  200G  0 disk
# └─sda1   8:1    0  200G  0 part

# 파일시스템 생성 (최초 1회만, 이미 생성된 경우 SKIP)
sudo mkfs.ext4 /dev/sda1

# 마운트 디렉토리 생성
sudo mkdir -p /mnt/data

# 임시 마운트
sudo mount /dev/sda1 /mnt/data

# UUID 확인
sudo blkid /dev/sda1
# 출력 예시: /dev/sda1: UUID="abc12345-6789-..." TYPE="ext4"

# fstab에 영구 마운트 설정 추가
echo "UUID=$(sudo blkid -s UUID -o value /dev/sda1) /mnt/data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

# 마운트 확인
df -h | grep /mnt/data
# 출력: /dev/sda1       197G   61M  187G   1% /mnt/data

# Docker 데이터 디렉토리 생성
sudo mkdir -p /mnt/data/{postgres,redis,victoriametrics,grafana}

# 권한 설정
sudo chown -R 1000:1000 /mnt/data
```

### 2.4 방화벽 설정 (UFW)
```bash
# UFW 기본 정책 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH, HTTP, HTTPS 허용
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# UFW 활성화
sudo ufw enable

# 상태 확인
sudo ufw status verbose
```

### 2.5 Fail2Ban 설정
```bash
# Fail2Ban 설정 파일 생성
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

# Fail2Ban 재시작
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# 상태 확인
sudo fail2ban-client status
```

---

## 3. Docker 설치

### 3.1 Docker CE 설치 (ARM64용)
```bash
# 기존 Docker 제거 (설치된 경우)
sudo apt remove -y docker docker-engine docker.io containerd runc

# Docker GPG 키 추가
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Docker Repository 추가 (ARM64)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker 설치
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Docker 버전 확인
docker --version
# 출력: Docker version 24.0.x, build ...

docker compose version
# 출력: Docker Compose version v2.x.x
```

### 3.2 Docker 권한 설정
```bash
# ubuntu 사용자를 docker 그룹에 추가
sudo usermod -aG docker ubuntu

# 변경사항 적용 (로그아웃 후 재로그인 또는)
newgrp docker

# Docker 권한 테스트
docker ps
# 에러 없이 실행되면 성공
```

### 3.3 Docker Daemon 설정
```bash
# Docker daemon.json 생성 (로그 로테이션 설정)
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Docker 재시작
sudo systemctl restart docker
sudo systemctl enable docker

# 상태 확인
sudo systemctl status docker
```

---

## 4. Nginx 설치 및 SSL 설정

### 4.1 Nginx 설치
```bash
# Nginx 설치
sudo apt install -y nginx

# Nginx 버전 확인
nginx -v
# 출력: nginx version: nginx/1.18.0 (Ubuntu)

# Nginx 시작 및 부팅 시 자동 시작 설정
sudo systemctl start nginx
sudo systemctl enable nginx

# 상태 확인
sudo systemctl status nginx
```

### 4.2 Certbot 설치 (Let's Encrypt)
```bash
# Certbot 및 Nginx 플러그인 설치
sudo apt install -y certbot python3-certbot-nginx

# Certbot 버전 확인
certbot --version
# 출력: certbot 1.x.x
```

### 4.3 SSL 인증서 발급
**중요**: 도메인의 DNS A 레코드가 VM의 Public IP를 가리키고 있어야 합니다.

```bash
# SSL 인증서 발급 (도메인을 실제 도메인으로 변경)
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# 프롬프트에서 이메일 입력 및 약관 동의

# 인증서 파일 위치 확인
sudo ls -l /etc/letsencrypt/live/yourdomain.com/
# 출력:
# fullchain.pem  -> SSL 인증서
# privkey.pem    -> 개인 키
```

### 4.4 Nginx 메인 설정 파일
```bash
# 기존 nginx.conf 백업
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 새로운 nginx.conf 작성
sudo tee /etc/nginx/nginx.conf > /dev/null <<'EOF'
# ============================================
# Nginx Production Configuration
# ============================================
# Oracle Cloud Free Tier (1 OCPU, 8GB RAM)
# 동시 처리: 1,000명 목표
# ============================================

user www-data;
worker_processes auto;  # CPU 코어 수만큼 자동 설정 (4개)
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;  # worker당 1024개 연결 (총 4096개)
    use epoll;               # Linux 최적화
    multi_accept on;         # 동시 다중 연결 수락
}

http {
    # ==========================================
    # 기본 설정
    # ==========================================
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 로그 형식
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # ==========================================
    # 성능 최적화
    # ==========================================
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;  # Nginx 버전 숨기기

    # 파일 업로드 크기 제한 (50MB)
    client_max_body_size 50m;
    client_body_buffer_size 128k;

    # Gzip 압축
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";

    # ==========================================
    # 보안 헤더 (전역)
    # ==========================================
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ==========================================
    # Rate Limiting
    # ==========================================
    # IP당 분당 60개 요청 (초당 1개)
    limit_req_zone $binary_remote_addr zone=general:10m rate=60r/m;

    # API 엔드포인트 (분당 120개)
    limit_req_zone $binary_remote_addr zone=api:10m rate=120r/m;

    # 로그인 엔드포인트 (분당 10개)
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;

    # 연결 수 제한 (IP당 동시 10개)
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 10;

    # ==========================================
    # Cloudflare Real IP 복원
    # ==========================================
    # Cloudflare CDN 사용 시 실제 클라이언트 IP 복원
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 2400:cb00::/32;
    set_real_ip_from 2606:4700::/32;
    set_real_ip_from 2803:f800::/32;
    set_real_ip_from 2405:b500::/32;
    set_real_ip_from 2405:8100::/32;
    set_real_ip_from 2c0f:f248::/32;
    set_real_ip_from 2a06:98c0::/29;
    real_ip_header CF-Connecting-IP;

    # ==========================================
    # Virtual Host 설정 로드
    # ==========================================
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
```

### 4.5 Virtual Host 설정 (사이트별 설정)
```bash
# sites-available 디렉토리에 설정 파일 생성
sudo tee /etc/nginx/sites-available/codebase.conf > /dev/null <<'EOF'
# ============================================
# Codebase Blog Platform - Virtual Host
# ============================================
# yourdomain.com 을 실제 도메인으로 변경하세요
# ============================================

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # 모든 HTTP 요청을 HTTPS로 리다이렉트
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # ==========================================
    # SSL 인증서 (Let's Encrypt)
    # ==========================================
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL 프로토콜 및 암호화 스위트
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL 세션 캐시
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;

    # ==========================================
    # 보안 헤더
    # ==========================================
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ==========================================
    # Rate Limiting
    # ==========================================
    # 일반 요청 제한
    limit_req zone=general burst=20 nodelay;

    # ==========================================
    # 프론트엔드 (Next.js Standalone)
    # ==========================================
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # 헤더 전달
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket 지원 (Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 타임아웃
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # 버퍼링
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # ==========================================
    # 백엔드 API (/api/v1)
    # ==========================================
    location /api/v1 {
        # API Rate Limiting (분당 120개)
        limit_req zone=api burst=30 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # 헤더 전달
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 타임아웃 (API는 짧게)
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ==========================================
    # 로그인 엔드포인트 (강화된 Rate Limiting)
    # ==========================================
    location ~ ^/api/v1/auth/(login|register) {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ==========================================
    # Socket.IO (WebSocket)
    # ==========================================
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket 필수 헤더
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WebSocket 타임아웃 (긴 연결 유지)
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # ==========================================
    # 정적 파일 캐싱 (Next.js _next/static)
    # ==========================================
    location /_next/static/ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # ==========================================
    # 모니터링 (내부 접근만 허용)
    # ==========================================
    # Grafana (내부 네트워크만 접근 가능)
    location /grafana/ {
        # 외부 접근 차단 (필요 시 특정 IP만 허용)
        # allow 123.456.789.0/24;  # 회사 IP 대역
        # deny all;

        proxy_pass http://localhost:3003/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ==========================================
    # 보안: 민감 경로 차단
    # ==========================================
    # .git, .env 등 노출 방지
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # ==========================================
    # 로그 설정
    # ==========================================
    access_log /var/log/nginx/codebase_access.log main;
    error_log /var/log/nginx/codebase_error.log warn;
}
EOF
```

### 4.6 도메인 설정 및 Nginx 활성화
```bash
# 실제 도메인으로 변경 (yourdomain.com을 실제 도메인으로)
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/codebase.conf

# 심볼릭 링크 생성 (사이트 활성화)
sudo ln -s /etc/nginx/sites-available/codebase.conf /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t
# 출력: nginx: configuration file /etc/nginx/nginx.conf test is successful

# Nginx 재시작
sudo systemctl restart nginx

# 상태 확인
sudo systemctl status nginx
```

### 4.7 SSL 자동 갱신 설정
```bash
# Certbot 자동 갱신 타이머 확인
sudo systemctl status certbot.timer

# 자동 갱신 테스트 (실제 갱신 안함)
sudo certbot renew --dry-run

# 성공 메시지 확인:
# Congratulations, all simulated renewals succeeded
```

---

## 5. 애플리케이션 배포

### 5.1 Git 저장소 클론
```bash
# 홈 디렉토리로 이동
cd ~

# Git 저장소 클론 (HTTPS 방식)
git clone https://github.com/yourusername/my-blog-app.git

# 또는 SSH 방식 (SSH 키 등록 필요)
# git clone git@github.com:yourusername/my-blog-app.git

# 프로젝트 디렉토리 이동
cd my-blog-app
```

### 5.2 환경 변수 설정
```bash
# .env.production.example 복사
cp .env.production.example .env.production

# 권한 설정 (보안)
chmod 600 .env.production

# 환경 변수 편집
vim .env.production
```

**편집 내용** (실제 값으로 변경):
```env
# 데이터베이스 비밀번호
DB_PASSWORD=<사전 준비에서 생성한 32자 비밀번호>

# JWT Secret
JWT_SECRET=<사전 준비에서 생성한 32자 Secret>

# 백엔드 URL (실제 도메인)
NEXT_PUBLIC_API_URL=https://yourdomain.com/api/v1
NEXT_PUBLIC_BACKEND_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# CORS Origin (실제 도메인)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# AWS S3 (Oracle Object Storage)
AWS_S3_BUCKET=<Oracle Object Storage 버킷 이름>
AWS_S3_REGION=ap-chuncheon-1
AWS_ACCESS_KEY_ID=<Oracle Customer Secret Key ID>
AWS_SECRET_ACCESS_KEY=<Oracle Customer Secret Key>
AWS_S3_ENDPOINT=https://<namespace>.compat.objectstorage.ap-chuncheon-1.oraclecloud.com

# Google OAuth (선택)
GOOGLE_CLIENT_ID=<Google OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth Client Secret>
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback

# GitHub OAuth (선택)
GITHUB_CLIENT_ID=<GitHub OAuth Client ID>
GITHUB_CLIENT_SECRET=<GitHub OAuth Client Secret>
GITHUB_CALLBACK_URL=https://yourdomain.com/api/v1/auth/github/callback

# Grafana 관리자 비밀번호 변경 (필수!)
GF_SECURITY_ADMIN_PASSWORD=<강력한 비밀번호>
```

저장 후 종료 (`:wq`)

### 5.3 프론트엔드 빌드
```bash
# 프론트엔드 디렉토리로 이동
cd ~/my-blog-app/frontend

# Node.js 버전 확인 (22 이상 필요)
node --version

# pnpm 설치 (없는 경우)
npm install -g pnpm

# 의존성 설치
pnpm install --frozen-lockfile

# 프로덕션 빌드 (output: 'standalone' 모드)
pnpm build

# 빌드 결과 확인
ls -lh .next/standalone
# .next/standalone 디렉토리가 생성되어야 함
```

### 5.4 Docker Compose로 서비스 시작
```bash
# 프로젝트 루트로 이동
cd ~/my-blog-app

# Docker Compose 빌드
docker compose -f docker-compose.prod.oracle.yml build --no-cache

# 백그라운드로 서비스 시작
docker compose -f docker-compose.prod.oracle.yml up -d

# 컨테이너 상태 확인
docker compose -f docker-compose.prod.oracle.yml ps
# 모든 서비스가 "Up" 상태여야 함

# 로그 확인 (실시간)
docker compose -f docker-compose.prod.oracle.yml logs -f
# Ctrl+C로 종료
```

**주요 서비스 포트 매핑**:
- Frontend: `localhost:3001`
- Backend: `localhost:3000`
- MCP Proxy: `localhost:3002`
- Grafana: `localhost:3003`
- VictoriaMetrics: `localhost:8428`
- PostgreSQL (PgBouncer): `localhost:5432`
- Redis: `localhost:6379`

---

## 6. 데이터베이스 마이그레이션

### 6.1 초기 마이그레이션 실행
```bash
# 백엔드 컨테이너에 접속
docker compose -f docker-compose.prod.oracle.yml exec backend bash

# 마이그레이션 실행
pnpm migration:run

# 출력 예시:
# query: SELECT * FROM "migrations"
# query: CREATE TABLE "users" ...
# Migration completed successfully

# 컨테이너 종료
exit
```

### 6.2 데이터베이스 연결 확인
```bash
# PostgreSQL 컨테이너에 직접 접속
docker compose -f docker-compose.prod.oracle.yml exec postgres psql -U postgres -d blog_prod

# 테이블 목록 확인
\dt

# 출력 예시:
#  Schema |       Name        | Type  |  Owner
# --------+-------------------+-------+----------
#  public | users             | table | postgres
#  public | blogs             | table | postgres
#  public | posts             | table | postgres
#  ...

# 종료
\q
```

### 6.3 초기 데이터 시딩 (선택사항)
```bash
# 백엔드 컨테이너에서 시딩 스크립트 실행 (있는 경우)
docker compose -f docker-compose.prod.oracle.yml exec backend pnpm seed

# 또는 수동으로 관리자 계정 생성
docker compose -f docker-compose.prod.oracle.yml exec postgres psql -U postgres -d blog_prod
```

---

## 7. 모니터링 설정

### 7.1 Grafana 초기 설정
```bash
# 브라우저에서 Grafana 접속
# https://yourdomain.com/grafana/

# 로그인 정보:
# Username: admin
# Password: .env.production의 GF_SECURITY_ADMIN_PASSWORD
```

**초기 설정 단계**:
1. 로그인 후 비밀번호 변경 (프롬프트 표시됨)
2. **Configuration → Data Sources** 확인
   - VictoriaMetrics가 기본 데이터소스로 설정되어 있어야 함
3. **Dashboards** 확인
   - `grafana/provisioning/dashboards/` 경로의 대시보드가 자동 로드됨

### 7.2 VictoriaMetrics 메트릭 확인
```bash
# VictoriaMetrics UI 접속 (VM 내부에서만 접근 가능)
curl -s "http://localhost:8428/api/v1/query?query=up" | jq

# 출력 예시:
# {
#   "status": "success",
#   "data": {
#     "resultType": "vector",
#     "result": [
#       {
#         "metric": {
#           "__name__": "up",
#           "job": "nestjs-backend"
#         },
#         "value": [1234567890, "1"]
#       }
#     ]
#   }
# }
```

### 7.3 메트릭 수집 확인
```bash
# 백엔드 메트릭 엔드포인트 확인
curl -s http://localhost:3000/api/v1/metrics

# MCP Proxy 메트릭 확인
curl -s http://localhost:3002/metrics

# Redis 메트릭 확인 (Redis Exporter)
docker compose -f docker-compose.prod.oracle.yml logs redis-exporter
```

---

## 8. 헬스체크 및 검증

### 8.1 서비스 헬스체크
```bash
# 전체 서비스 상태 확인 스크립트
cat > ~/healthcheck.sh <<'EOF'
#!/bin/bash

echo "========================================="
echo "Codebase 블로그 플랫폼 - 헬스체크"
echo "========================================="

# 1. 시스템 리소스
echo -e "\n[1] 시스템 리소스"
free -h | grep Mem
df -h /mnt/data | tail -1

# 2. Docker 컨테이너
echo -e "\n[2] Docker 컨테이너 상태"
docker compose -f ~/my-blog-app/docker-compose.prod.oracle.yml ps

# 3. 백엔드 API
echo -e "\n[3] 백엔드 API"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/api/v1/health || echo "FAIL"

# 4. 프론트엔드
echo -e "\n[4] 프론트엔드"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001 || echo "FAIL"

# 5. MCP Proxy
echo -e "\n[5] MCP Proxy"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3002/health || echo "FAIL"

# 6. PostgreSQL
echo -e "\n[6] PostgreSQL"
docker exec my-blog-app-postgres pg_isready -U postgres && echo "OK" || echo "FAIL"

# 7. Redis
echo -e "\n[7] Redis"
docker exec my-blog-app-shared-redis redis-cli ping || echo "FAIL"

# 8. Nginx
echo -e "\n[8] Nginx"
sudo systemctl is-active nginx && echo "OK" || echo "FAIL"

# 9. HTTPS 인증서
echo -e "\n[9] SSL 인증서 만료일"
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

echo -e "\n========================================="
echo "헬스체크 완료"
echo "========================================="
EOF

chmod +x ~/healthcheck.sh
```

### 8.2 헬스체크 실행
```bash
# 헬스체크 실행
~/healthcheck.sh

# 모든 항목이 정상이어야 함
```

### 8.3 외부 접근 테스트
로컬 머신에서 테스트:

```bash
# 프론트엔드 접속 테스트
curl -I https://yourdomain.com

# 백엔드 API 테스트
curl -I https://yourdomain.com/api/v1/health

# HTTPS 리다이렉트 확인
curl -I http://yourdomain.com
# 출력: HTTP/1.1 301 Moved Permanently
# Location: https://yourdomain.com
```

---

## 9. 백업 설정

### 9.1 자동 백업 스크립트
```bash
# 백업 디렉토리 생성
sudo mkdir -p /mnt/data/backups

# 백업 스크립트 생성
cat > ~/backup.sh <<'EOF'
#!/bin/bash

# ============================================
# Codebase 블로그 플랫폼 - 자동 백업 스크립트
# ============================================

BACKUP_DIR="/mnt/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="$HOME/my-blog-app/docker-compose.prod.oracle.yml"

echo "[$(date)] 백업 시작..."

# 1. PostgreSQL 백업
echo "PostgreSQL 백업 중..."
docker compose -f $COMPOSE_FILE exec -T postgres pg_dumpall -U postgres | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# 2. Redis RDB 백업
echo "Redis 백업 중..."
docker compose -f $COMPOSE_FILE exec -T redis redis-cli SAVE
docker cp $(docker compose -f $COMPOSE_FILE ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# 3. VictoriaMetrics 데이터 백업
echo "VictoriaMetrics 백업 중..."
tar -czf "$BACKUP_DIR/victoriametrics_$DATE.tar.gz" /mnt/data/victoriametrics

# 4. 환경 변수 백업
echo "환경 변수 백업 중..."
cp $HOME/my-blog-app/.env.production "$BACKUP_DIR/env_$DATE.backup"

# 5. 오래된 백업 삭제 (30일 이전)
echo "오래된 백업 삭제 중..."
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.backup" -mtime +30 -delete

# 백업 크기 확인
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date)] 백업 완료 - 총 크기: $BACKUP_SIZE"
EOF

chmod +x ~/backup.sh
```

### 9.2 Cron 설정 (매일 새벽 3시 백업)
```bash
# Crontab 편집
crontab -e

# 다음 줄 추가:
0 3 * * * /home/ubuntu/backup.sh >> /var/log/backup.log 2>&1

# 저장 후 종료
```

### 9.3 수동 백업 테스트
```bash
# 백업 스크립트 실행
~/backup.sh

# 백업 파일 확인
ls -lh /mnt/data/backups/
```

---

## 10. 트러블슈팅

### 10.1 Docker 컨테이너 재시작
```bash
# 전체 재시작
docker compose -f docker-compose.prod.oracle.yml restart

# 특정 서비스만 재시작
docker compose -f docker-compose.prod.oracle.yml restart backend
docker compose -f docker-compose.prod.oracle.yml restart frontend
```

### 10.2 로그 확인
```bash
# 전체 로그
docker compose -f docker-compose.prod.oracle.yml logs -f

# 특정 서비스 로그
docker compose -f docker-compose.prod.oracle.yml logs -f backend
docker compose -f docker-compose.prod.oracle.yml logs -f postgres

# Nginx 로그
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/codebase_error.log
```

### 10.3 데이터베이스 연결 문제
```bash
# PgBouncer 상태 확인
docker exec my-blog-app-pgbouncer psql -U postgres -p 5432 -h localhost pgbouncer -c "SHOW POOLS;"

# PostgreSQL 직접 연결 테스트
docker exec my-blog-app-postgres psql -U postgres -d blog_prod -c "SELECT version();"
```

### 10.4 메모리 부족 (OOM)
```bash
# 메모리 사용량 확인
docker stats --no-stream

# 특정 서비스 메모리 제한 늘리기 (docker-compose.prod.oracle.yml 수정)
# mem_limit: 2.5g → 3g

# 재시작
docker compose -f docker-compose.prod.oracle.yml up -d
```

### 10.5 디스크 공간 부족
```bash
# 디스크 사용량 확인
df -h /mnt/data

# Docker 캐시 정리
docker system prune -a --volumes -f

# 오래된 로그 삭제
sudo journalctl --vacuum-time=7d
sudo find /var/log -name "*.log" -mtime +30 -delete
```

### 10.6 Nginx 502 Bad Gateway
```bash
# 백엔드/프론트엔드 컨테이너 상태 확인
docker compose -f docker-compose.prod.oracle.yml ps

# 포트 바인딩 확인
sudo netstat -tlnp | grep -E '3000|3001|3002|3003'

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### 10.7 SSL 인증서 갱신 실패
```bash
# 인증서 수동 갱신
sudo certbot renew --nginx

# 80번 포트 확인 (Let's Encrypt는 80번 포트 필요)
sudo ufw status | grep 80

# Nginx 재시작
sudo systemctl restart nginx
```

### 10.8 Rate Limiting 테스트
```bash
# 반복 요청으로 Rate Limit 테스트 (로컬 머신에서)
for i in {1..100}; do
  curl -s -o /dev/null -w "Req $i: %{http_code}\n" https://yourdomain.com/api/v1/health
  sleep 0.5
done

# 429 Too Many Requests가 표시되면 정상
```

---

## 배포 완료 체크리스트

- [ ] Oracle Cloud 인스턴스 생성 및 Block Volume 마운트
- [ ] Docker 및 Docker Compose 설치
- [ ] Nginx 설치 및 SSL 인증서 발급
- [ ] 환경 변수 (.env.production) 설정
- [ ] Docker Compose로 서비스 시작
- [ ] 데이터베이스 마이그레이션 실행
- [ ] Grafana 대시보드 확인
- [ ] 헬스체크 통과
- [ ] 백업 스크립트 및 Cron 설정
- [ ] 외부 접근 테스트 (HTTPS)
- [ ] 모니터링 알람 설정 (선택)

---

## 유용한 명령어 모음

```bash
# 전체 서비스 상태 확인
docker compose -f ~/my-blog-app/docker-compose.prod.oracle.yml ps

# 서비스 재시작
docker compose -f ~/my-blog-app/docker-compose.prod.oracle.yml restart

# 로그 확인
docker compose -f ~/my-blog-app/docker-compose.prod.oracle.yml logs -f [service_name]

# 시스템 리소스 모니터링
htop

# 네트워크 연결 확인
sudo netstat -tlnp

# 디스크 사용량
df -h

# 메모리 사용량
free -h

# Docker 캐시 정리
docker system prune -a --volumes -f

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# SSL 인증서 갱신
sudo certbot renew --nginx

# 백업 실행
~/backup.sh

# 헬스체크
~/healthcheck.sh
```

---

## 참고 문서

- [Oracle Cloud 초기 설정 가이드](./ORACLE_CLOUD_SETUP.md)
- [VictoriaMetrics 설정 가이드](../victoriametrics/scrape_config.yml)
- [PostgreSQL 18 최적화 설정](../postgres/postgresql.conf)
- [Nginx Rate Limiting 가이드](https://www.nginx.com/blog/rate-limiting-nginx/)

---

**배포 가이드 작성일**: 2025-01-23
**작성자**: Claude Code
**프로젝트**: Codebase 블로그 플랫폼 - Oracle Cloud Free Tier 배포
