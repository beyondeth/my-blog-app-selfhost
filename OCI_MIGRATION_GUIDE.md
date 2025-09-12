# Oracle Cloud Infrastructure (OCI) 마이그레이션 가이드

## 📋 목차
1. [현재 아키텍처 분석](#현재-아키텍처-분석)
2. [하이브리드 클라우드 전략](#하이브리드-클라우드-전략)
3. [OCI 초기 설정](#oci-초기-설정)
4. [Ubuntu 서버 구성](#ubuntu-서버-구성)
5. [Redis 설치 및 구성](#redis-설치-및-구성)
6. [OpenSearch 설치 및 구성](#opensearch-설치-및-구성)
7. [애플리케이션 배포](#애플리케이션-배포)
8. [모니터링 스택](#모니터링-스택)
9. [보안 강화](#보안-강화)
10. [성능 최적화](#성능-최적화)

---

## 현재 아키텍처 분석

### AWS 의존성 현황
```yaml
RDS PostgreSQL:
  Endpoint: myblog.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com
  Database: blog-db
  유지여부: ✅ 유지 (데이터 마이그레이션 리스크 회피)

S3 Bucket:
  Name: myblogdata84
  용도: 파일 업로드, 이미지 저장
  유지여부: ✅ 유지 (대량 데이터 이전 비용/시간 절감)

CloudFront CDN:
  Distribution: d1y66zmnw3oigo.cloudfront.net
  유지여부: ⚠️ 선택적 (OCI CDN으로 대체 가능)
```

### 코드 수정 필요 사항
- ❌ S3 서비스 코드 변경 불필요 (AWS S3 계속 사용)
- ❌ RDS 연결 코드 변경 불필요 (AWS RDS 계속 사용)
- ✅ Redis 캐싱 레이어 추가 필요
- ✅ OpenSearch 검색 기능 추가 필요

---

## 하이브리드 클라우드 전략

### 아키텍처 다이어그램
```
┌─────────────────────────────────────────────────┐
│                    사용자                       │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│            OCI Load Balancer (무료)              │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│         OCI Compute Instance (ARM A1)           │
│  ┌──────────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy & SSL)             │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  NestJS Backend (PM2 Cluster)            │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Redis Cache (6GB)                       │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  OpenSearch (10GB)                       │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓                              ↓
┌──────────────────┐          ┌──────────────────┐
│   AWS RDS        │          │    AWS S3        │
│  PostgreSQL      │          │  Object Storage  │
└──────────────────┘          └──────────────────┘
```

### 리소스 할당 계획
```yaml
Total RAM: 24GB
CPU: 4 OCPU (ARM Ampere A1)

Memory Allocation:
  System/OS: 2GB
  Nginx: 512MB
  NestJS (PM2): 4GB
  Redis: 6GB
  OpenSearch: 10GB
  Buffer/Cache: 1.5GB
```

---

## OCI 초기 설정

### 1. OCI 계정 생성 및 Free Tier 활성화
```bash
# Oracle Cloud 가입
# https://www.oracle.com/cloud/free/
# 신용카드 필요 (검증용, 과금 없음)
```

### 2. Compartment 생성
```bash
# OCI Console > Identity & Security > Compartments
# Name: myblog-production
# Description: My Blog Application Production Environment
```

### 3. VCN (Virtual Cloud Network) 생성
```bash
# OCI Console > Networking > Virtual Cloud Networks
VCN Name: myblog-vcn
CIDR Block: 10.0.0.0/16

# Subnets
Public Subnet: 10.0.1.0/24 (인터넷 게이트웨이 연결)
Private Subnet: 10.0.2.0/24 (NAT 게이트웨이 연결)

# Internet Gateway
Name: myblog-igw
연결: Public Subnet

# NAT Gateway
Name: myblog-nat
연결: Private Subnet

# Route Tables
Public Route Table:
  0.0.0.0/0 → Internet Gateway

Private Route Table:
  0.0.0.0/0 → NAT Gateway
```

### 4. Security List 구성
```bash
# Ingress Rules (들어오는 트래픽)
SSH: 22/tcp from 0.0.0.0/0 (임시, 나중에 제한)
HTTP: 80/tcp from 0.0.0.0/0
HTTPS: 443/tcp from 0.0.0.0/0
Redis: 6379/tcp from 10.0.0.0/16 (VCN 내부만)
OpenSearch: 9200/tcp from 10.0.0.0/16 (VCN 내부만)
OpenSearch Dashboard: 5601/tcp from YOUR_IP/32

# Egress Rules (나가는 트래픽)
All Traffic: 0.0.0.0/0 (기본값)
```

### 5. Compute Instance 생성
```bash
# OCI Console > Compute > Instances
Name: myblog-app-server
Availability Domain: 가용한 AD 선택
Shape: VM.Standard.A1.Flex
  - OCPU: 4
  - Memory: 24GB
  
Image: Canonical Ubuntu 22.04 Minimal aarch64
  
Boot Volume: 100GB (Free Tier 포함)

SSH Keys: 
  # 로컬에서 생성
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/oci_myblog
  # 공개키 업로드
  
Network:
  VCN: myblog-vcn
  Subnet: Public Subnet
  Public IP: Yes
```

### 6. Block Storage 추가 (선택사항)
```bash
# 추가 스토리지가 필요한 경우
# OCI Console > Storage > Block Volumes
Name: myblog-data
Size: 50GB (Free Tier 200GB까지)
Availability Domain: Instance와 동일

# Attach to Instance
# Instance > Attached Block Volumes > Attach Block Volume
Device Path: /dev/oracleoci/oraclevdb
```

---

## Ubuntu 서버 구성

### 1. 초기 서버 접속 및 업데이트
```bash
# SSH 접속
ssh -i ~/.ssh/oci_myblog ubuntu@<PUBLIC_IP>

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  build-essential \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  net-tools \
  ufw
```

### 2. 시스템 최적화
```bash
# Swap 설정 (RAM이 충분하지만 안전장치)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# sysctl 최적화
sudo tee /etc/sysctl.d/99-optimize.conf << EOF
# Network optimization
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_tw_reuse = 1

# Memory optimization
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File descriptors
fs.file-max = 2097152
EOF

sudo sysctl -p /etc/sysctl.d/99-optimize.conf

# ulimit 설정
sudo tee -a /etc/security/limits.conf << EOF
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
EOF
```

### 3. 방화벽 설정
```bash
# UFW 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw allow 3000/tcp  # NestJS
sudo ufw allow 3001/tcp  # Frontend (if needed)
sudo ufw --force enable
```

### 4. Node.js 및 PM2 설치
```bash
# Node.js 20.x 설치 (ARM64)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm 설치
npm install -g pnpm

# PM2 설치
sudo npm install -g pm2

# PM2 시작 스크립트 설정
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 5. PostgreSQL 클라이언트 설치 (AWS RDS 연결용)
```bash
# PostgreSQL 클라이언트
sudo apt install -y postgresql-client-14

# 연결 테스트
psql -h myblog.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d blog-db \
     -c "SELECT version();"
```

### 6. Nginx 설치 및 구성
```bash
# Nginx 설치
sudo apt install -y nginx

# SSL 인증서 (Let's Encrypt)
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Nginx 설정
sudo tee /etc/nginx/sites-available/myblog << 'EOF'
upstream backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req zone=general burst=20 nodelay;
    limit_conn addr 10;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/javascript application/vnd.ms-fontobject application/x-font-ttf font/opentype;

    # Client body size for file uploads
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # API endpoints
    location /api {
        limit_req zone=api burst=50 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers if needed
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }

    # Static files
    location /static {
        alias /home/ubuntu/myblog/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Root
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 설정 활성화
sudo ln -s /etc/nginx/sites-available/myblog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Redis 설치 및 구성

### 1. Redis 7.x 설치
```bash
# Redis 저장소 추가
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

# Redis 설치
sudo apt update
sudo apt install -y redis-server redis-tools

# 버전 확인
redis-server --version
```

### 2. Redis 최적화 설정
```bash
# Redis 설정 백업
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup

# Redis 최적화 설정
sudo tee /etc/redis/redis.conf << 'EOF'
# Network
bind 127.0.0.1 ::1
protected-mode yes
port 6379
tcp-backlog 511
tcp-keepalive 300

# General
daemonize yes
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16

# Memory Management (6GB 할당)
maxmemory 6gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence (RDB + AOF)
# RDB Snapshots
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# AOF (Append Only File)
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Client Management
timeout 300
tcp-keepalive 300
maxclients 10000

# Thread I/O
io-threads 4
io-threads-do-reads yes

# Performance Tuning
hz 10
dynamic-hz yes
rdb-save-incremental-fsync yes
aof-rewrite-incremental-fsync yes

# Security
requirepass YOUR_STRONG_REDIS_PASSWORD_HERE
# ACL 사용자 설정 (선택사항)
# aclfile /etc/redis/users.acl

# Clustering (단일 인스턴스면 비활성화)
# cluster-enabled no

# Modules (필요시 활성화)
# loadmodule /usr/lib/redis/modules/redisearch.so
# loadmodule /usr/lib/redis/modules/redisjson.so
EOF

# 시스템 커널 파라미터 최적화
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
echo 'net.core.somaxconn = 65535' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Transparent Huge Pages 비활성화
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag

# 부팅 시 자동 설정
sudo tee /etc/rc.local << 'EOF'
#!/bin/bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
exit 0
EOF
sudo chmod +x /etc/rc.local

# Redis 재시작
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 상태 확인
sudo systemctl status redis-server
redis-cli ping
```

### 3. Redis 캐싱 전략 구현
```typescript
// backend/src/config/redis.config.ts
export default () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    ttl: 3600, // 1 hour default TTL
    
    // 캐싱 전략
    caching: {
      // 세션 캐싱
      session: {
        ttl: 86400, // 24 hours
        prefix: 'sess:',
      },
      
      // API 응답 캐싱
      api: {
        ttl: 300, // 5 minutes
        prefix: 'api:',
        patterns: {
          list: 60,      // 목록 API: 1분
          detail: 300,   // 상세 API: 5분
          static: 3600,  // 정적 데이터: 1시간
        }
      },
      
      // 쿼리 결과 캐싱
      query: {
        ttl: 600, // 10 minutes
        prefix: 'query:',
      },
      
      // 파일 메타데이터 캐싱
      file: {
        ttl: 86400, // 24 hours
        prefix: 'file:',
      },
      
      // Rate Limiting
      rateLimit: {
        ttl: 60, // 1 minute window
        prefix: 'rate:',
        max: 100, // requests per minute
      }
    }
  }
});
```

### 4. Redis 모니터링 설정
```bash
# Redis 모니터링 스크립트
sudo tee /home/ubuntu/monitor-redis.sh << 'EOF'
#!/bin/bash

# Redis 상태 체크
REDIS_STATUS=$(redis-cli ping 2>/dev/null)

if [ "$REDIS_STATUS" != "PONG" ]; then
    echo "Redis is down! Attempting restart..."
    sudo systemctl restart redis-server
    
    # 알림 전송 (선택사항)
    # curl -X POST "webhook_url" -d "Redis restarted at $(date)"
fi

# 메모리 사용량 체크
MEMORY_USAGE=$(redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "Redis Memory Usage: $MEMORY_USAGE"

# Slow queries 체크
SLOW_QUERIES=$(redis-cli slowlog len | tr -d '\r')
if [ "$SLOW_QUERIES" -gt "10" ]; then
    echo "Warning: $SLOW_QUERIES slow queries detected"
fi
EOF

chmod +x /home/ubuntu/monitor-redis.sh

# Crontab 등록
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/monitor-redis.sh >> /var/log/redis-monitor.log 2>&1") | crontab -
```

---

## OpenSearch 설치 및 구성

### 1. OpenSearch 2.x 설치
```bash
# Java 설치 (OpenSearch 필수)
sudo apt install -y openjdk-11-jre-headless

# OpenSearch 다운로드 (ARM64 버전)
cd /tmp
wget https://artifacts.opensearch.org/releases/bundle/opensearch/2.11.0/opensearch-2.11.0-linux-arm64.tar.gz
wget https://artifacts.opensearch.org/releases/bundle/opensearch-dashboards/2.11.0/opensearch-dashboards-2.11.0-linux-arm64.tar.gz

# 압축 해제
sudo tar -xzf opensearch-2.11.0-linux-arm64.tar.gz -C /opt
sudo tar -xzf opensearch-dashboards-2.11.0-linux-arm64.tar.gz -C /opt

# 디렉토리 이름 변경
sudo mv /opt/opensearch-2.11.0 /opt/opensearch
sudo mv /opt/opensearch-dashboards-2.11.0 /opt/opensearch-dashboards

# 사용자 생성
sudo useradd -r -s /bin/false opensearch
sudo chown -R opensearch:opensearch /opt/opensearch
sudo chown -R opensearch:opensearch /opt/opensearch-dashboards
```

### 2. OpenSearch 설정
```bash
# OpenSearch 설정
sudo tee /opt/opensearch/config/opensearch.yml << 'EOF'
cluster.name: myblog-search
node.name: node-1
path.data: /var/lib/opensearch
path.logs: /var/log/opensearch
network.host: 127.0.0.1
http.port: 9200
discovery.type: single-node

# Memory (10GB 할당)
# JVM 옵션은 jvm.options 파일에서 설정

# Security (초기 설정, 프로덕션에서는 활성화 권장)
plugins.security.disabled: true

# 성능 최적화
indices.memory.index_buffer_size: 30%
indices.fielddata.cache.size: 25%
indices.queries.cache.size: 15%
thread_pool.write.queue_size: 1000
thread_pool.search.queue_size: 1000

# 한국어 분석기 설정
analysis:
  tokenizer:
    nori_tokenizer:
      type: nori_tokenizer
      decompound_mode: mixed
  analyzer:
    korean:
      type: custom
      tokenizer: nori_tokenizer
      filter:
        - nori_part_of_speech
        - lowercase
        - synonym_filter
  filter:
    synonym_filter:
      type: synonym
      synonyms:
        - "블로그,blog"
        - "포스트,게시글,글"
EOF

# JVM 힙 메모리 설정 (10GB의 50% = 5GB)
sudo tee /opt/opensearch/config/jvm.options << 'EOF'
-Xms5g
-Xmx5g
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:+ParallelRefProcEnabled
-XX:+AlwaysPreTouch
-Xss1m
-Djava.awt.headless=true
-Dfile.encoding=UTF-8
-Djna.nosys=true
-XX:-OmitStackTraceInFastThrow
-XX:+ShowCodeDetailsInExceptionMessages
-Dio.netty.noUnsafe=true
-Dio.netty.noKeySetOptimization=true
-Dio.netty.recycler.maxCapacityPerThread=0
-Dio.netty.allocator.numDirectArenas=0
-Dlog4j.shutdownHookEnabled=false
-Dlog4j2.disable.jmx=true
-Djava.locale.providers=SPI,COMPAT
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/lib/opensearch
-XX:ErrorFile=/var/log/opensearch/hs_err_pid%p.log
EOF

# 디렉토리 생성
sudo mkdir -p /var/lib/opensearch
sudo mkdir -p /var/log/opensearch
sudo chown -R opensearch:opensearch /var/lib/opensearch
sudo chown -R opensearch:opensearch /var/log/opensearch
```

### 3. OpenSearch 한국어 분석기 플러그인 설치
```bash
# Nori 분석기 플러그인 설치
sudo -u opensearch /opt/opensearch/bin/opensearch-plugin install analysis-nori

# 사용자 정의 사전 추가 (선택사항)
sudo mkdir -p /opt/opensearch/config/userdict
sudo tee /opt/opensearch/config/userdict/custom_dict.txt << 'EOF'
# 사용자 정의 단어
넥스트제이에스
리액트
타입스크립트
노드제이에스
EOF
```

### 4. OpenSearch Systemd 서비스 설정
```bash
# Systemd 서비스 파일 생성
sudo tee /etc/systemd/system/opensearch.service << 'EOF'
[Unit]
Description=OpenSearch
Documentation=https://opensearch.org/docs
Wants=network-online.target
After=network-online.target

[Service]
Type=notify
User=opensearch
Group=opensearch
ExecStart=/opt/opensearch/bin/opensearch
Restart=on-failure
RestartSec=5
StartLimitBurst=3
StartLimitInterval=60
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536
LimitNPROC=4096
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
EOF

# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable opensearch
sudo systemctl start opensearch

# 상태 확인
sudo systemctl status opensearch
curl -X GET http://localhost:9200
```

### 5. OpenSearch 인덱스 생성 및 매핑
```bash
# 블로그 포스트 인덱스 생성
curl -X PUT "localhost:9200/blog_posts" -H 'Content-Type: application/json' -d'
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "korean_analyzer": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["lowercase", "nori_part_of_speech"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "korean_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "content": {
        "type": "text",
        "analyzer": "korean_analyzer"
      },
      "excerpt": {
        "type": "text",
        "analyzer": "korean_analyzer"
      },
      "tags": {
        "type": "keyword"
      },
      "author": {
        "type": "keyword"
      },
      "blog_id": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date"
      },
      "updated_at": {
        "type": "date"
      },
      "is_published": {
        "type": "boolean"
      },
      "view_count": {
        "type": "integer"
      },
      "like_count": {
        "type": "integer"
      }
    }
  }
}'

# 사용자 인덱스 생성
curl -X PUT "localhost:9200/users" -H 'Content-Type: application/json' -d'
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "username": {
        "type": "keyword"
      },
      "email": {
        "type": "keyword"
      },
      "display_name": {
        "type": "text",
        "analyzer": "korean_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "bio": {
        "type": "text",
        "analyzer": "korean_analyzer"
      },
      "created_at": {
        "type": "date"
      }
    }
  }
}'
```

### 6. OpenSearch 대시보드 설정 (선택사항)
```bash
# OpenSearch Dashboards 설정
sudo tee /opt/opensearch-dashboards/config/opensearch_dashboards.yml << 'EOF'
server.port: 5601
server.host: "0.0.0.0"
opensearch.hosts: ["http://localhost:9200"]
opensearch.ssl.verificationMode: none
opensearch.requestHeadersWhitelist: ["securitytenant","Authorization"]
opensearch_security.multitenancy.enabled: false
opensearch_security.readonly_mode.roles: ["kibana_read_only"]
server.ssl.enabled: false
EOF

# Systemd 서비스 생성
sudo tee /etc/systemd/system/opensearch-dashboards.service << 'EOF'
[Unit]
Description=OpenSearch Dashboards
Documentation=https://opensearch.org/docs
Wants=network-online.target
After=network-online.target opensearch.service

[Service]
Type=simple
User=opensearch
Group=opensearch
ExecStart=/opt/opensearch-dashboards/bin/opensearch-dashboards
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable opensearch-dashboards
sudo systemctl start opensearch-dashboards
```

---

## 애플리케이션 배포

### 1. 애플리케이션 코드 클론 및 설정
```bash
# 애플리케이션 디렉토리 생성
mkdir -p /home/ubuntu/myblog
cd /home/ubuntu/myblog

# Git 클론
git clone https://github.com/your-repo/my-blog-app.git .

# Backend 환경 변수 설정
cd backend
cp .env.example .env

# .env 파일 수정
cat > .env << 'EOF'
# Database (AWS RDS 유지)
DB_URL=postgresql://postgres:password@myblog.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com:5432/blog-db

# Application
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1d

# AWS S3 (유지)
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=myblogdata84

# Redis (새로 추가)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD_HERE
REDIS_DB=0

# OpenSearch (새로 추가)
OPENSEARCH_NODE=http://localhost:9200
OPENSEARCH_INDEX_PREFIX=myblog_

# OAuth (도메인 변경 필요)
GOOGLE_CALLBACK_URL=https://your-domain.com/api/v1/auth/google/callback
KAKAO_CALLBACK_URL=https://your-domain.com/api/v1/auth/kakao/callback
GITHUB_CALLBACK_URL=https://your-domain.com/api/v1/auth/github/callback

# Frontend URL
FRONTEND_URL=https://your-domain.com

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EOF

# 의존성 설치
pnpm install

# TypeORM 마이그레이션 실행
pnpm run migration:run

# 빌드
pnpm run build
```

### 2. PM2 생태계 파일 생성
```bash
# PM2 ecosystem 파일
tee /home/ubuntu/myblog/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'myblog-backend',
      script: './dist/main.js',
      cwd: '/home/ubuntu/myblog/backend',
      instances: 4, // CPU 코어 수만큼
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/ubuntu/myblog/logs/err.log',
      out_file: '/home/ubuntu/myblog/logs/out.log',
      log_file: '/home/ubuntu/myblog/logs/combined.log',
      time: true,
      
      // 성능 최적화
      max_memory_restart: '1G',
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // 모니터링
      instance_var: 'INSTANCE_ID',
      merge_logs: true,
      
      // 자동 재시작
      watch: false,
      max_restarts: 10,
      autorestart: true,
      
      // 그레이스풀 재시작
      wait_ready: true,
      stop_exit_codes: [0]
    }
  ]
};
EOF

# 로그 디렉토리 생성
mkdir -p /home/ubuntu/myblog/logs

# PM2로 시작
cd /home/ubuntu/myblog
pm2 start ecosystem.config.js
pm2 save
```

### 3. Redis 통합 코드
```typescript
// backend/src/cache/cache.module.ts
import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 0),
        ttl: 300, // 5 minutes default
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
```

### 4. OpenSearch 통합 코드
```typescript
// backend/src/search/search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get('OPENSEARCH_NODE'),
    });
  }

  async indexPost(post: any) {
    try {
      const response = await this.client.index({
        index: 'blog_posts',
        body: {
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          tags: post.tags,
          author: post.author,
          blog_id: post.blogId,
          created_at: post.createdAt,
          updated_at: post.updatedAt,
          is_published: post.isPublished,
          view_count: post.viewCount || 0,
          like_count: post.likeCount || 0,
        },
        id: post.id,
      });

      this.logger.log(`Post indexed: ${post.id}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to index post: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchPosts(query: string, options: any = {}) {
    try {
      const response = await this.client.search({
        index: 'blog_posts',
        body: {
          query: {
            multi_match: {
              query: query,
              fields: ['title^3', 'content', 'excerpt^2', 'tags^2'],
              type: 'best_fields',
              analyzer: 'korean_analyzer',
            },
          },
          highlight: {
            fields: {
              title: {},
              content: { fragment_size: 150 },
              excerpt: {},
            },
          },
          size: options.size || 10,
          from: options.from || 0,
        },
      });

      return {
        hits: response.body.hits.hits,
        total: response.body.hits.total.value,
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePost(postId: string) {
    try {
      await this.client.delete({
        index: 'blog_posts',
        id: postId,
      });
      this.logger.log(`Post deleted from index: ${postId}`);
    } catch (error) {
      this.logger.error(`Failed to delete post: ${error.message}`, error.stack);
    }
  }
}
```

---

## 모니터링 스택

### 1. Prometheus 설치
```bash
# Prometheus 다운로드 (ARM64)
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/v2.48.0/prometheus-2.48.0.linux-arm64.tar.gz
tar -xzf prometheus-2.48.0.linux-arm64.tar.gz
sudo mv prometheus-2.48.0.linux-arm64 /opt/prometheus

# 설정 파일
sudo tee /opt/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'opensearch'
    static_configs:
      - targets: ['localhost:9200/_prometheus/metrics']

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']

  - job_name: 'nodejs'
    static_configs:
      - targets: ['localhost:3000/metrics']
EOF

# Systemd 서비스
sudo tee /etc/systemd/system/prometheus.service << 'EOF'
[Unit]
Description=Prometheus
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/opt/prometheus/prometheus \
  --config.file=/opt/prometheus/prometheus.yml \
  --storage.tsdb.path=/opt/prometheus/data \
  --web.console.templates=/opt/prometheus/consoles \
  --web.console.libraries=/opt/prometheus/console_libraries

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
```

### 2. Grafana 설치
```bash
# Grafana 저장소 추가
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee /etc/apt/sources.list.d/grafana.list

# Grafana 설치
sudo apt update
sudo apt install -y grafana

# 설정
sudo tee -a /etc/grafana/grafana.ini << 'EOF'
[server]
http_port = 3001
domain = your-domain.com

[security]
admin_user = admin
admin_password = YOUR_SECURE_PASSWORD

[auth.anonymous]
enabled = false
EOF

# 서비스 시작
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

### 3. Node Exporter 설치
```bash
# Node Exporter 다운로드
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-arm64.tar.gz
tar -xzf node_exporter-1.7.0.linux-arm64.tar.gz
sudo cp node_exporter-1.7.0.linux-arm64/node_exporter /usr/local/bin/

# Systemd 서비스
sudo tee /etc/systemd/system/node_exporter.service << 'EOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

### 4. 로그 수집 (Loki)
```bash
# Loki 설치
cd /tmp
wget https://github.com/grafana/loki/releases/download/v2.9.3/loki-linux-arm64.zip
unzip loki-linux-arm64.zip
sudo mv loki-linux-arm64 /usr/local/bin/loki

# Promtail 설치 (로그 수집 에이전트)
wget https://github.com/grafana/loki/releases/download/v2.9.3/promtail-linux-arm64.zip
unzip promtail-linux-arm64.zip
sudo mv promtail-linux-arm64 /usr/local/bin/promtail

# Loki 설정
sudo mkdir -p /etc/loki
sudo tee /etc/loki/loki-config.yml << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/boltdb-shipper-active
    cache_location: /tmp/loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
EOF

# Promtail 설정
sudo tee /etc/promtail/promtail-config.yml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://localhost:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*log

  - job_name: nginx
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          __path__: /var/log/nginx/*log

  - job_name: nodejs
    static_configs:
      - targets:
          - localhost
        labels:
          job: nodejs
          __path__: /home/ubuntu/myblog/logs/*.log
EOF
```

---

## 보안 강화

### 1. Fail2ban 설치 및 설정
```bash
# Fail2ban 설치
sudo apt install -y fail2ban

# SSH 보호 설정
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
filter = nginx-noproxy
logpath = /var/log/nginx/error.log
maxretry = 2
EOF

sudo systemctl restart fail2ban
```

### 2. 보안 감사 도구 설치
```bash
# Lynis 설치 (보안 감사)
sudo apt install -y lynis

# 보안 감사 실행
sudo lynis audit system

# ClamAV 설치 (바이러스 스캔)
sudo apt install -y clamav clamav-daemon
sudo freshclam
sudo systemctl start clamav-daemon
```

### 3. 자동 백업 스크립트
```bash
# 백업 스크립트
sudo tee /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
REDIS_BACKUP="redis_backup_${DATE}.rdb"
OPENSEARCH_BACKUP="opensearch_backup_${DATE}.tar.gz"

# 디렉토리 생성
mkdir -p $BACKUP_DIR

# Redis 백업
redis-cli --rdb $BACKUP_DIR/$REDIS_BACKUP

# OpenSearch 스냅샷 (API 사용)
curl -X PUT "localhost:9200/_snapshot/backup_repo" -H 'Content-Type: application/json' -d'{
  "type": "fs",
  "settings": {
    "location": "/var/lib/opensearch/snapshots"
  }
}'

curl -X PUT "localhost:9200/_snapshot/backup_repo/snapshot_${DATE}?wait_for_completion=true"

# 설정 파일 백업
tar -czf $BACKUP_DIR/configs_${DATE}.tar.gz \
  /etc/nginx/sites-available/myblog \
  /etc/redis/redis.conf \
  /opt/opensearch/config/opensearch.yml \
  /home/ubuntu/myblog/backend/.env

# 오래된 백업 삭제 (7일 이상)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: ${DATE}"
EOF

chmod +x /home/ubuntu/backup.sh

# Cron 작업 추가 (매일 새벽 3시)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/ubuntu/backup.sh >> /var/log/backup.log 2>&1") | crontab -
```

---

## 성능 최적화

### 1. 시스템 튜닝
```bash
# CPU 거버너 설정 (성능 모드)
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# I/O 스케줄러 최적화
echo noop | sudo tee /sys/block/sda/queue/scheduler

# Network 버퍼 크기 증가
sudo tee -a /etc/sysctl.conf << 'EOF'
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
EOF

sudo sysctl -p
```

### 2. 애플리케이션 레벨 캐싱 전략
```typescript
// 캐싱 데코레이터 구현
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('posts')
export class PostsController {
  // 목록 API - 1분 캐싱
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('posts_list')
  @CacheTTL(60)
  async findAll() {
    return this.postsService.findAll();
  }

  // 인기 포스트 - 5분 캐싱
  @Get('popular')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('posts_popular')
  @CacheTTL(300)
  async findPopular() {
    return this.postsService.findPopular();
  }
}
```

### 3. 데이터베이스 연결 풀 최적화
```typescript
// TypeORM 설정
{
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  
  // 연결 풀 설정
  extra: {
    max: 20, // 최대 연결 수
    min: 5,  // 최소 연결 수
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 30000,
    query_timeout: 30000,
  },
  
  // 쿼리 캐싱
  cache: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379,
    },
    duration: 30000, // 30초
  },
}
```

---

## 트러블슈팅 가이드

### 일반적인 문제 해결

#### 1. OOM (Out of Memory) 문제
```bash
# 메모리 사용량 확인
free -h
ps aux --sort=-%mem | head

# 스왑 확인
swapon -s

# OOM Killer 로그 확인
dmesg | grep -i "killed process"
journalctl -xe | grep -i oom
```

#### 2. 디스크 공간 부족
```bash
# 디스크 사용량 확인
df -h
du -sh /* | sort -hr | head -20

# 로그 정리
sudo journalctl --vacuum-time=7d
sudo find /var/log -type f -name "*.log" -mtime +30 -delete
```

#### 3. 높은 CPU 사용률
```bash
# CPU 사용량 확인
top -b -n 1 | head -20
mpstat -P ALL 1

# 프로세스별 CPU 사용량
ps aux --sort=-%cpu | head
```

#### 4. 네트워크 문제
```bash
# 연결 상태 확인
netstat -tuln
ss -tuln

# 대역폭 사용량
iftop
nload

# DNS 확인
nslookup your-domain.com
dig your-domain.com
```

### 서비스별 트러블슈팅

#### Redis 문제
```bash
# Redis 로그 확인
tail -f /var/log/redis/redis-server.log

# Redis 상태 확인
redis-cli ping
redis-cli info server
redis-cli info memory

# 메모리 정리
redis-cli FLUSHDB  # 현재 DB만
redis-cli FLUSHALL # 모든 DB (주의!)
```

#### OpenSearch 문제
```bash
# OpenSearch 로그 확인
tail -f /var/log/opensearch/*.log

# 클러스터 상태 확인
curl -X GET "localhost:9200/_cluster/health?pretty"
curl -X GET "localhost:9200/_nodes/stats?pretty"

# 인덱스 상태 확인
curl -X GET "localhost:9200/_cat/indices?v"
```

#### PM2 문제
```bash
# PM2 상태 확인
pm2 status
pm2 logs
pm2 monit

# 재시작
pm2 restart all
pm2 reload ecosystem.config.js

# 프로세스 정리
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 모니터링 대시보드 접속 정보

### 서비스 URL
- **애플리케이션**: https://your-domain.com
- **OpenSearch Dashboard**: http://your-domain.com:5601
- **Grafana**: http://your-domain.com:3001
- **Prometheus**: http://your-domain.com:9090

### 기본 계정 정보
```yaml
OpenSearch:
  URL: http://localhost:9200
  보안: 비활성화 (개발 환경)

Grafana:
  Username: admin
  Password: YOUR_SECURE_PASSWORD

Redis:
  Password: YOUR_STRONG_REDIS_PASSWORD_HERE
```

---

## 비용 분석

### OCI Free Tier 활용
```yaml
사용 리소스:
  Compute: 
    - ARM A1 인스턴스 (4 OCPU, 24GB RAM)
    - 비용: $0 (Free Tier)
  
  Storage:
    - Boot Volume: 100GB
    - Block Volume: 50GB  
    - 비용: $0 (Free Tier 200GB까지)
  
  Network:
    - Load Balancer: 1개
    - Bandwidth: 10TB/월
    - 비용: $0 (Free Tier)

AWS 유지 비용:
  RDS PostgreSQL: ~$15-30/월 (t3.micro)
  S3: ~$5-10/월 (사용량 기준)
  
월 예상 비용: $20-40 (AWS만)
연간 절감액: ~$500-1000 (전체 OCI 이전 대비)
```

---

## 마이그레이션 체크리스트

### Phase 1: 준비 (1일)
- [ ] OCI 계정 생성 및 Free Tier 확인
- [ ] VCN 및 네트워크 구성
- [ ] Compute Instance 생성
- [ ] 보안 그룹 설정

### Phase 2: 인프라 구축 (2일)
- [ ] Ubuntu 초기 설정
- [ ] Node.js 및 PM2 설치
- [ ] Nginx 설치 및 구성
- [ ] SSL 인증서 설정

### Phase 3: 서비스 설치 (2일)
- [ ] Redis 설치 및 최적화
- [ ] OpenSearch 설치 및 한국어 분석기 설정
- [ ] 모니터링 스택 구축

### Phase 4: 애플리케이션 배포 (1일)
- [ ] 코드 배포
- [ ] 환경 변수 설정
- [ ] 데이터베이스 연결 테스트
- [ ] PM2로 애플리케이션 시작

### Phase 5: 테스트 및 최적화 (1일)
- [ ] 기능 테스트
- [ ] 성능 테스트
- [ ] 보안 점검
- [ ] 백업 설정

### Phase 6: 운영 전환 (1일)
- [ ] DNS 변경
- [ ] 모니터링 확인
- [ ] 문서화 완료
- [ ] 팀 교육

---

## 결론

이 가이드는 AWS에서 OCI Free Tier로의 하이브리드 클라우드 마이그레이션을 위한 상세한 지침을 제공합니다. 

### 핵심 이점
1. **비용 절감**: 연간 $500-1000 절약
2. **성능 향상**: Redis 캐싱과 OpenSearch로 응답 속도 개선
3. **확장성**: 24GB RAM으로 충분한 리소스 확보
4. **안정성**: 모니터링과 자동 복구 메커니즘

### 주의사항
1. AWS RDS와 S3는 계속 사용하므로 네트워크 레이턴시 고려
2. ARM 아키텍처 호환성 확인 필요
3. 정기적인 백업 및 모니터링 필수
4. Free Tier 한도 모니터링 중요

이 구성으로 안정적이고 비용 효율적인 블로그 서비스 운영이 가능합니다.