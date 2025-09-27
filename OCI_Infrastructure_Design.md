# Oracle Cloud Infrastructure (OCI) - Multi-User Blog SaaS Platform
## 🚀 종합 인프라 설계 및 자원 할당 계획

### 📋 프로젝트 개요
- **플랫폼**: 멀티유저 블로그 SaaS 플랫폼
- **Frontend**: Next.js 14 + React Query + Tailwind CSS
- **Backend**: NestJS + PostgreSQL + TypeORM
- **핵심 기능**: 멀티유저 블로그, 포스트 관리, 댓글, API 키 관리, 실시간 알림
- **목표**: OCI 무료 티어를 최대한 활용한 고가용성 인프라 구축

---

## 🏗️ 1. VM 인스턴스 분산 전략

### 1.1 ARM Ampere A1 리소스 (4 OCPUs, 24GB RAM)

#### **Instance 1: Application Server (3 OCPUs, 18GB RAM)**
```yaml
# 애플리케이션 서버 - 핵심 워크로드
CPU: 3 OCPUs (75% 할당)
Memory: 18GB (75% 할당)
Storage: 100GB (Block Volume 1)
Role:
  - Frontend (Next.js)
  - Backend (NestJS)
  - Redis (캐싱/세션)
  - File Upload Service
  - WebSocket Server

# 컨테이너 구성
Containers:
  - app-frontend: 512MB RAM, 0.5 CPU
  - app-backend: 2GB RAM, 1 CPU
  - redis: 512MB RAM, 0.25 CPU
  - nginx: 256MB RAM, 0.25 CPU
  - file-service: 1GB RAM, 0.5 CPU
  - websocket: 512MB RAM, 0.25 CPU
  - log-agent: 256MB RAM, 0.25 CPU

# OS 및 시스템 예약
OS (Ubuntu 22.04): 2GB RAM, 0.5 CPU
Docker: 1GB RAM, 0.25 CPU
System Buffer: 10GB RAM, 0.25 CPU
Total Used: 18GB RAM, 3 CPU
```

#### **Instance 2: Database & Monitoring Server (1 OCPU, 6GB RAM)**
```yaml
# 데이터베이스 및 모니터링 서버
CPU: 1 OCPU (25% 할당)
Memory: 6GB (25% 할당)
Storage: 100GB (Block Volume 2)
Role:
  - PostgreSQL Database
  - Prometheus
  - Grafana
  - Backup Services
  - Log Aggregation

# 컨테이너 구성
Containers:
  - postgresql: 3GB RAM, 0.5 CPU
  - prometheus: 1GB RAM, 0.2 CPU
  - grafana: 512MB RAM, 0.15 CPU
  - backup-service: 256MB RAM, 0.1 CPU
  - log-collector: 256MB RAM, 0.05 CPU

# OS 및 시스템 예약
OS (Ubuntu 22.04): 768MB RAM, 0.1 CPU
System Buffer: 256MB RAM, 0.05 CPU
Total Used: 6GB RAM, 1 CPU
```

---

## 📊 2. 종합 자원 할당 매트릭스

### 2.1 Core Infrastructure Resources

| 리소스 카테고리 | 총 용량 | 할당량 | 용도 | 백업/예약 |
|----------------|---------|--------|------|-----------|
| **Compute (ARM Ampere A1)** | 4 OCPUs | 4 OCPUs | App(3) + DB(1) | 3000 시간/월 |
| **Memory** | 24GB | 24GB | App(18GB) + DB(6GB) | - |
| **Block Storage** | 200GB | 200GB | App(100GB) + DB(100GB) | 자동 백업 |
| **Load Balancer** | 1 Flexible | 1 | 트래픽 분산 | 10Mbps |
| **Network Egress** | 10TB | 예상 1TB/월 | 사용자 트래픽 | 90% 여유 |
| **VCN** | 2개 | 2개 | Production + Dev | 완전 격리 |

### 2.2 Database & Storage Strategy

#### **Primary Database (OCI Autonomous DB 대신 Self-Managed)**
```yaml
# PostgreSQL 14 on Docker
Primary DB Container:
  CPU: 0.5 OCPU
  Memory: 3GB
  Storage: 50GB (데이터)

Backup Strategy:
  Local Backup: 20GB (Block Storage)
  Object Storage: 10GB (일별 백업)
  Point-in-Time Recovery: 7일

Performance Tuning:
  shared_buffers: 768MB
  work_mem: 16MB
  maintenance_work_mem: 256MB
  max_connections: 100
```

#### **Object Storage 활용**
```yaml
Standard Storage (10GB):
  - 사용자 업로드 이미지
  - 애플리케이션 로고/파비콘
  - 정적 자산 CDN

Infrequent Access (10GB):
  - 데이터베이스 주간 백업
  - 로그 아카이브 (30일 이후)
  - 사용자 데이터 백업

Archive Storage (10GB):
  - 데이터베이스 월간 백업
  - 컴플라이언스 로그 (1년 이상)
  - 삭제된 콘텐츠 아카이브
```

---

## 🔍 3. 모니터링 및 관찰 가능성 스택

### 3.1 모니터링 아키텍처

#### **Prometheus + Grafana Stack**
```yaml
# Instance 2에서 실행
Prometheus Server:
  CPU: 0.2 OCPU
  Memory: 1GB
  Storage: 20GB (메트릭 데이터)
  Retention: 15일

Grafana Dashboard:
  CPU: 0.15 OCPU
  Memory: 512MB
  Storage: 2GB (대시보드 설정)

Node Exporter (각 인스턴스):
  CPU: 0.05 OCPU
  Memory: 128MB

Custom Metrics:
  - 애플리케이션 성능 (응답시간, 처리량)
  - 데이터베이스 성능 (쿼리 시간, 연결수)
  - 사용자 활동 (가입, 포스팅, 방문)
  - 비즈니스 메트릭 (DAU, MAU, 수익)
```

#### **OCI Native Monitoring 활용**
```yaml
OCI Monitoring (무료 500M data points):
  - Instance CPU/Memory 사용률
  - Block Storage IOPS/Throughput
  - Load Balancer 헬스체크
  - Network 트래픽 모니터링

OCI Application Performance Monitoring:
  - Next.js 클라이언트 성능
  - NestJS 백엔드 API 성능
  - 데이터베이스 쿼리 추적
  - 사용자 경험 메트릭

OCI Logging (10GB 무료):
  - 애플리케이션 로그 중앙화
  - 보안 이벤트 로깅
  - 오류 추적 및 알림
  - 감사 로그 (API 호출, 인증)
```

### 3.2 로깅 전략

#### **구조화된 로깅 파이프라인**
```yaml
Log Collection:
  Frontend (Next.js):
    - Client-side 오류 (Sentry 통합)
    - 사용자 행동 추적
    - 성능 메트릭

  Backend (NestJS):
    - API 요청/응답 로그
    - 데이터베이스 쿼리 로그
    - 인증/권한 이벤트
    - 비즈니스 로직 오류

  Infrastructure:
    - Container 로그 (Docker)
    - System 로그 (systemd)
    - Network 로그 (nginx)
    - Security 로그 (fail2ban)

Log Aggregation:
  Fluentd/Vector Agent:
    CPU: 0.05 OCPU per instance
    Memory: 256MB per instance

  OCI Logging Service:
    - 실시간 로그 수집
    - 로그 파싱 및 enrichment
    - 알림 규칙 설정
    - 장기 보존 (Object Storage)
```

---

## 🐳 4. 컨테이너 오케스트레이션 및 Docker 스토리지

### 4.1 Docker Swarm 클러스터 구성

#### **클러스터 토폴로지**
```yaml
Manager Node (Instance 1):
  Role: Swarm Manager + Application Workload
  Services:
    - app-frontend (replicas: 2)
    - app-backend (replicas: 2)
    - nginx-lb (replicas: 1)
    - redis (replicas: 1)
    - websocket (replicas: 1)

Worker Node (Instance 2):
  Role: Swarm Worker + Data Services
  Services:
    - postgresql (replicas: 1)
    - prometheus (replicas: 1)
    - grafana (replicas: 1)
    - backup-service (replicas: 1)

Network Configuration:
  Overlay Network: app-network (encrypted)
  Ingress Network: 80, 443, 3000, 3001
  Internal Services: 5432, 6379, 9090, 3000
```

#### **Docker Storage Strategy**
```yaml
# Instance 1 (Application Server)
Docker Root: /var/lib/docker (20GB)
Application Data: /opt/app-data (30GB)
  - Next.js build cache
  - NestJS uploads
  - Redis persistence
  - Logs and temp files

Container Volumes:
  app-uploads: 15GB (사용자 파일)
  app-cache: 10GB (애플리케이션 캐시)
  logs: 5GB (애플리케이션 로그)

# Instance 2 (Database Server)
Docker Root: /var/lib/docker (10GB)
Database Data: /opt/db-data (60GB)
  - PostgreSQL data directory
  - Prometheus TSDB
  - Grafana dashboards

Container Volumes:
  postgres-data: 50GB (데이터베이스)
  prometheus-data: 20GB (메트릭)
  backup-data: 20GB (백업 스토리지)
  grafana-data: 10GB (설정 및 대시보드)
```

### 4.2 컨테이너 리소스 제한 및 관리

#### **리소스 제한 정책**
```yaml
# docker-compose.yml 예시
services:
  app-backend:
    image: my-blog-backend:latest
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
    volumes:
      - app-uploads:/app/uploads
      - logs:/app/logs
    networks:
      - app-network

  postgresql:
    image: postgres:14-alpine
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.5'
          memory: 3G
        reservations:
          cpus: '0.25'
          memory: 2G
      placement:
        constraints:
          - node.labels.role == database
    environment:
      - POSTGRES_DB=myblog
      - POSTGRES_USER=myblog
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - backup-data:/backup
    networks:
      - app-network
```

---

## 🗄️ 5. 데이터베이스 아키텍처 및 백업 전략

### 5.1 PostgreSQL 클러스터 설계

#### **단일 인스턴스 최적화 구성**
```yaml
PostgreSQL Configuration:
  Version: 14.x (Alpine Linux)
  CPU: 0.5 OCPU (dedicated)
  Memory: 3GB (dedicated)
  Storage: 50GB SSD (Block Volume)

Performance Tuning:
  max_connections: 100
  shared_buffers: 768MB (25% of RAM)
  effective_cache_size: 2.25GB (75% of RAM)
  work_mem: 16MB
  maintenance_work_mem: 256MB
  checkpoint_completion_target: 0.9
  wal_buffers: 16MB
  random_page_cost: 1.1 (SSD optimized)

Connection Pool:
  PgBouncer:
    pool_mode: transaction
    default_pool_size: 25
    max_client_conn: 200
    reserve_pool_size: 5
```

#### **데이터베이스 스키마 최적화**
```sql
-- 인덱스 전략
CREATE INDEX CONCURRENTLY idx_posts_blog_created
  ON posts (blog_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_posts_status_published
  ON posts (status) WHERE status = 'published';

CREATE INDEX CONCURRENTLY idx_comments_post_created
  ON comments (post_id, created_at);

-- 파티셔닝 (로그/분석 테이블)
CREATE TABLE audit_logs (
  id SERIAL,
  action VARCHAR(50),
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2024 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### 5.2 백업 및 복구 전략

#### **3-2-1 백업 정책**
```yaml
# 1차 백업: 로컬 인스턴스
Local Backup (Instance 2):
  Frequency: 매 6시간
  Method: pg_dump + WAL archiving
  Storage: 20GB (Block Volume)
  Retention: 7일 전체 백업, 24시간 증분

  Scripts:
    - /opt/backup/scripts/pg_backup.sh
    - /opt/backup/scripts/wal_archive.sh
    - /opt/backup/scripts/cleanup.sh

# 2차 백업: OCI Object Storage
Remote Backup (Object Storage):
  Frequency: 일일 (오전 2시)
  Method: 압축된 pg_dump
  Storage: Infrequent Access (10GB)
  Retention: 30일 일별, 12개월 월별

  Automation:
    - OCI CLI를 통한 자동 업로드
    - 백업 무결성 검증
    - 실패 시 알림 발송

# 3차 백업: 장기 아카이브
Archive Backup (Archive Storage):
  Frequency: 월별 (매월 1일)
  Method: 전체 데이터 스냅샷
  Storage: Archive Storage (10GB)
  Retention: 7년 (컴플라이언스)

  Contents:
    - 데이터베이스 전체 덤프
    - 애플리케이션 설정
    - 사용자 업로드 파일
    - 시스템 구성 파일
```

#### **재해 복구 계획**
```yaml
Recovery Time Objectives (RTO):
  - 서비스 복구: 30분 이내
  - 데이터 복구: 4시간 이내
  - 전체 시스템 복구: 24시간 이내

Recovery Point Objectives (RPO):
  - 데이터 손실: 최대 15분
  - 트랜잭션 손실: 최대 1분
  - 파일 손실: 최대 6시간

Recovery Procedures:
  1. Point-in-Time Recovery (PITR)
     - WAL 파일을 이용한 특정 시점 복구
     - 복구 시간: 15-30분

  2. Full Database Restore
     - 최신 백업에서 전체 복원
     - 복구 시간: 2-4시간

  3. Cross-Region Migration
     - 다른 리전으로 완전 이전
     - 복구 시간: 12-24시간

Automated Health Checks:
  - 백업 파일 무결성 검증 (일일)
  - 복구 테스트 (월별)
  - 재해 복구 시뮬레이션 (분기별)
```

---

## 🌐 6. 네트워크 보안 및 VCN 설계

### 6.1 Virtual Cloud Network (VCN) 아키텍처

#### **Production VCN (VCN-1)**
```yaml
VCN Name: myblog-prod-vcn
CIDR Block: 10.0.0.0/16
DNS Label: myblogprod
Region: ap-seoul-1

Subnets:
  Public Subnet (DMZ):
    Name: public-subnet
    CIDR: 10.0.1.0/24
    Components:
      - Load Balancer
      - NAT Gateway
      - Internet Gateway

  Private Subnet (App Tier):
    Name: app-subnet
    CIDR: 10.0.2.0/24
    Components:
      - Application Instances
      - Internal Load Balancer

  Private Subnet (Data Tier):
    Name: data-subnet
    CIDR: 10.0.3.0/24
    Components:
      - Database Instance
      - Backup Services

Route Tables:
  Public Route Table:
    - 0.0.0.0/0 → Internet Gateway
    - 10.0.0.0/16 → Local

  Private Route Table:
    - 0.0.0.0/0 → NAT Gateway
    - 10.0.0.0/16 → Local
```

#### **Development VCN (VCN-2)**
```yaml
VCN Name: myblog-dev-vcn
CIDR Block: 172.16.0.0/16
DNS Label: myblogdev
Region: ap-seoul-1

Subnets:
  Development Subnet:
    Name: dev-subnet
    CIDR: 172.16.1.0/24
    Components:
      - Development/Testing Instances
      - CI/CD Pipeline

  Staging Subnet:
    Name: staging-subnet
    CIDR: 172.16.2.0/24
    Components:
      - Staging Environment
      - Performance Testing
```

### 6.2 보안 그룹 및 네트워크 ACL

#### **세분화된 보안 규칙**
```yaml
# Load Balancer Security Group
LB-Security-Group:
  Ingress Rules:
    - HTTP (80): 0.0.0.0/0
    - HTTPS (443): 0.0.0.0/0
    - Health Check (8080): 10.0.0.0/16
  Egress Rules:
    - All traffic: 10.0.0.0/16

# Application Server Security Group
App-Security-Group:
  Ingress Rules:
    - HTTP (3001): LB-Security-Group
    - HTTP (3000): LB-Security-Group
    - SSH (22): Admin-IP-Range
    - Docker Swarm (2377, 7946): 10.0.0.0/16
  Egress Rules:
    - HTTPS (443): 0.0.0.0/0 (패키지 업데이트)
    - DNS (53): 0.0.0.0/0
    - Database (5432): DB-Security-Group
    - Redis (6379): 10.0.2.0/24

# Database Security Group
DB-Security-Group:
  Ingress Rules:
    - PostgreSQL (5432): App-Security-Group
    - Monitoring (9187): Monitoring-Security-Group
    - Backup (22): Backup-Security-Group
  Egress Rules:
    - Object Storage (443): 0.0.0.0/0 (백업용)

# Monitoring Security Group
Monitoring-Security-Group:
  Ingress Rules:
    - Prometheus (9090): Admin-IP-Range
    - Grafana (3000): Admin-IP-Range
    - Node Exporter (9100): 10.0.0.0/16
  Egress Rules:
    - All monitoring targets: 10.0.0.0/16
```

### 6.3 SSL/TLS 및 인증서 관리

#### **OCI Certificates Service 활용**
```yaml
SSL Certificate Strategy:
  Domain: myblog.example.com
  Certificate Type: DV (Domain Validated)
  Provider: OCI Certificates (무료)

  Subdomains:
    - api.myblog.example.com (API 서버)
    - admin.myblog.example.com (관리자)
    - static.myblog.example.com (정적 파일)

Auto-Renewal:
  Method: ACME Challenge (DNS-01)
  Frequency: 60일마다 갱신
  Backup: Let's Encrypt (Fallback)

Load Balancer Configuration:
  SSL Termination: Load Balancer에서 종료
  Backend: HTTP (내부 통신)
  HSTS: max-age=31536000; includeSubDomains

Security Headers:
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'
```

---

## 💾 7. OS 리소스 계산 및 Ubuntu 오버헤드

### 7.1 운영체제 리소스 요구사항

#### **Ubuntu 22.04 LTS 기본 오버헤드**
```yaml
# Instance 1: Application Server (18GB RAM, 3 CPU)
Ubuntu 22.04 Base System:
  Kernel: 200MB RAM, 0.05 CPU
  SystemD: 50MB RAM, 0.02 CPU
  NetworkManager: 30MB RAM, 0.01 CPU
  SSH Daemon: 20MB RAM, 0.01 CPU
  Cron/Logrotate: 30MB RAM, 0.01 CPU
  Base Services Total: 330MB RAM, 0.1 CPU

Docker Engine:
  Docker Daemon: 150MB RAM, 0.05 CPU
  Container Runtime: 200MB RAM, 0.05 CPU
  Network Bridge: 50MB RAM, 0.02 CPU
  Docker Total: 400MB RAM, 0.12 CPU

System Monitoring:
  Node Exporter: 50MB RAM, 0.02 CPU
  Log Agent: 100MB RAM, 0.03 CPU
  Security Agent: 80MB RAM, 0.02 CPU
  Monitoring Total: 230MB RAM, 0.07 CPU

File System & I/O:
  Buffer Cache: 2GB RAM (동적)
  I/O Buffers: 1GB RAM (동적)
  Reserved Total: 3GB RAM, 0

Total OS Overhead: 3.96GB RAM, 0.29 CPU
Available for Apps: 14.04GB RAM, 2.71 CPU
```

#### **Instance 2: Database Server (6GB RAM, 1 CPU)**
```yaml
Ubuntu 22.04 Base System:
  Similar Base Services: 330MB RAM, 0.1 CPU

Docker Engine:
  Lighter Configuration: 300MB RAM, 0.08 CPU

System Monitoring:
  Database-specific Monitoring: 200MB RAM, 0.05 CPU

File System & I/O:
  Buffer Cache: 1GB RAM (동적)
  I/O Buffers: 512MB RAM (동적)

Total OS Overhead: 2.34GB RAM, 0.23 CPU
Available for Services: 3.66GB RAM, 0.77 CPU
```

### 7.2 리소스 모니터링 및 알람

#### **시스템 리소스 임계치**
```yaml
CPU 사용률 임계치:
  Warning: 70%
  Critical: 85%
  Action: 자동 스케일링 트리거

Memory 사용률 임계치:
  Warning: 80%
  Critical: 90%
  Action: 메모리 캐시 정리

Disk 사용률 임계치:
  Warning: 75%
  Critical: 85%
  Action: 로그 정리 및 백업

Network 트래픽 임계치:
  Warning: 80% of 10TB
  Critical: 90% of 10TB
  Action: CDN 활성화

Alert Channels:
  - Email: admin@myblog.example.com
  - Slack: #infra-alerts
  - OCI Notifications: SMS
  - PagerDuty: 심각한 장애
```

---

## 🚀 8. 고가용성 및 확장 전략

### 8.1 고가용성 아키텍처

#### **Application Layer HA**
```yaml
Load Balancer Configuration:
  Type: OCI Flexible Load Balancer
  Bandwidth: 10Mbps (무료 티어)
  Health Check:
    Path: /health
    Interval: 30초
    Timeout: 10초
    Healthy Threshold: 2
    Unhealthy Threshold: 3

Backend Pool:
  Instance 1:
    - app-frontend:3001 (Primary)
    - app-backend:3000 (Primary)

  Failover Strategy:
    - Health check 실패 시 트래픽 차단
    - 30초 내 복구 시도
    - Manual intervention 필요

Service Discovery:
  Method: Docker Swarm Service Mesh
  DNS: Internal DNS resolution
  Load Balancing: Round-robin
  Health Checks: Container-level health
```

#### **Database Layer HA**
```yaml
PostgreSQL High Availability:
  Primary Instance: Instance 2
  Backup Strategy: Point-in-time recovery
  Monitoring: Continuous health checks

  Failover Plan:
    1. Automatic backup validation
    2. Application connection retry logic
    3. Manual database restoration
    4. Service redirection

Connection Pool Management:
  PgBouncer Configuration:
    - Connection retry: 3회
    - Timeout: 30초
    - Pool overflow: 5 connections
    - Graceful degradation
```

### 8.2 확장 시나리오 및 전략

#### **단기 확장 (1-6개월)**
```yaml
Current Capacity Limits:
  Concurrent Users: ~500
  Requests/Second: ~50
  Database Connections: ~100
  Storage: 200GB

Optimization Strategies:
  1. Application Performance:
     - Next.js 빌드 최적화
     - Database query optimization
     - Redis 캐싱 확대
     - CDN 활용 (OCI Object Storage)

  2. Resource Optimization:
     - Container 리소스 튜닝
     - Database connection pooling
     - 불필요한 서비스 제거
     - 로그 정리 자동화

  3. Monitoring Enhancement:
     - 성능 병목 지점 식별
     - 사용자 패턴 분석
     - 리소스 사용량 예측
     - 비용 최적화
```

#### **중장기 확장 (6개월 이후)**
```yaml
Paid Tier Migration Strategy:

Phase 1: Enhanced Compute
  - 추가 Compute Instance 추가
  - Multi-region deployment
  - Managed database 이전

Phase 2: Advanced Services
  - Container Engine for Kubernetes
  - API Gateway 도입
  - Autonomous Database 활용
  - Functions 서비스 활용

Phase 3: Enterprise Features
  - Global Load Balancer
  - WAF (Web Application Firewall)
  - Advanced monitoring & analytics
  - Multi-cloud strategy

Estimated Migration Costs:
  Month 1-6: $0 (무료 티어)
  Month 7-12: $100-200/월
  Year 2+: $300-500/월
```

### 8.3 성능 최적화 로드맵

#### **즉시 적용 가능한 최적화**
```yaml
Frontend Optimization:
  - Next.js production build
  - Image optimization (WebP)
  - Code splitting
  - Bundle analysis
  - Service Worker (PWA)

Backend Optimization:
  - NestJS production config
  - Database connection pooling
  - API response caching
  - Gzip compression
  - Request rate limiting

Infrastructure Optimization:
  - Container resource limits
  - Docker image optimization
  - Network optimization
  - Log aggregation efficiency
  - Backup compression
```

#### **단계별 성능 개선**
```yaml
Week 1-2: Quick Wins
  - Static asset optimization
  - Database index optimization
  - Container resource tuning
  - Monitoring dashboard setup

Week 3-4: Application Tuning
  - API performance optimization
  - Frontend rendering optimization
  - Cache strategy implementation
  - Error handling improvement

Month 2-3: Infrastructure Enhancement
  - Advanced monitoring setup
  - Automated scaling rules
  - Security hardening
  - Backup optimization

Month 4-6: Advanced Features
  - CDN implementation
  - Search optimization
  - Real-time features enhancement
  - Mobile app preparation
```

---

## 📈 9. 비용 분석 및 최적화

### 9.1 OCI 무료 티어 활용도

#### **월별 리소스 사용량 예상**
```yaml
Compute (Always Free):
  ARM Ampere A1: 3000 OCPU hours/월
  Current Usage: 4 OCPU × 24 × 30 = 2880 시간
  Utilization: 96% (여유 120시간)
  Cost: $0

Storage (Always Free):
  Block Storage: 200GB 사용/200GB 제한
  Object Storage: 30GB 사용/30GB 제한
  Utilization: 100%
  Cost: $0

Network (Always Free):
  Egress: 예상 1TB/월 (10TB 제한)
  Load Balancer: 10Mbps 사용
  Utilization: 10%
  Cost: $0

Monitoring (Always Free):
  Metrics: 예상 100M points (500M 제한)
  Logs: 예상 5GB (10GB 제한)
  APM: 기본 사용량
  Utilization: 20-50%
  Cost: $0

Total Monthly Cost: $0
```

### 9.2 확장 시 비용 예상

#### **Paid Tier 이전 시나리오**
```yaml
6개월 후 예상 요구사항:
  사용자: 1,000+ MAU
  트래픽: 100+ RPS
  데이터: 500GB+

필요한 추가 리소스:
  Compute: +2 Standard VM ($50/월)
  Storage: +300GB Block Storage ($15/월)
  Database: Autonomous DB ($40/월)
  CDN: Object Storage CDN ($10/월)
  Advanced Monitoring: ($20/월)

예상 월 비용: $135/월

1년 후 예상 요구사항:
  사용자: 5,000+ MAU
  트래픽: 500+ RPS
  데이터: 2TB+

필요한 추가 리소스:
  Compute: +4 Standard VM ($150/월)
  Storage: +1TB Block Storage ($50/월)
  Database: 확장된 Autonomous DB ($120/월)
  Load Balancer: Advanced LB ($30/월)
  Security: WAF + DDoS ($40/월)

예상 월 비용: $390/월
```

---

## 🔧 10. 배포 자동화 및 CI/CD

### 10.1 CI/CD 파이프라인 설계

#### **GitHub Actions 워크플로우**
```yaml
# .github/workflows/deploy.yml
name: Deploy to OCI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: |
          cd frontend && pnpm test
          cd backend && pnpm test

      - name: Build applications
        run: |
          cd frontend && pnpm build
          cd backend && pnpm build

  build-images:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t myblog-frontend:${{ github.sha }} ./frontend
          docker build -t myblog-backend:${{ github.sha }} ./backend

      - name: Push to OCI Registry
        run: |
          echo ${{ secrets.OCI_AUTH_TOKEN }} | docker login -u ${{ secrets.OCI_USERNAME }} --password-stdin iad.ocir.io
          docker tag myblog-frontend:${{ github.sha }} iad.ocir.io/tenancy/myblog-frontend:${{ github.sha }}
          docker tag myblog-backend:${{ github.sha }} iad.ocir.io/tenancy/myblog-backend:${{ github.sha }}
          docker push iad.ocir.io/tenancy/myblog-frontend:${{ github.sha }}
          docker push iad.ocir.io/tenancy/myblog-backend:${{ github.sha }}

  deploy:
    needs: build-images
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to OCI
        run: |
          # SSH를 통한 배포 스크립트 실행
          ssh -o StrictHostKeyChecking=no ${{ secrets.OCI_USER }}@${{ secrets.OCI_HOST }} "
            cd /opt/myblog &&
            ./scripts/deploy.sh ${{ github.sha }}
          "
```

#### **배포 스크립트**
```bash
#!/bin/bash
# /opt/myblog/scripts/deploy.sh

set -e

IMAGE_TAG=$1
DOCKER_REGISTRY="iad.ocir.io/tenancy"

echo "Deploying MyBlog version: $IMAGE_TAG"

# 1. 새 이미지 Pull
docker pull $DOCKER_REGISTRY/myblog-frontend:$IMAGE_TAG
docker pull $DOCKER_REGISTRY/myblog-backend:$IMAGE_TAG

# 2. Docker Swarm 서비스 업데이트 (Rolling Update)
docker service update \
  --image $DOCKER_REGISTRY/myblog-frontend:$IMAGE_TAG \
  --update-parallelism 1 \
  --update-delay 30s \
  myblog_frontend

docker service update \
  --image $DOCKER_REGISTRY/myblog-backend:$IMAGE_TAG \
  --update-parallelism 1 \
  --update-delay 30s \
  myblog_backend

# 3. 헬스체크 및 롤백 준비
sleep 60
if ! curl -f http://localhost/health; then
  echo "Health check failed, rolling back..."
  docker service rollback myblog_frontend
  docker service rollback myblog_backend
  exit 1
fi

# 4. 이전 이미지 정리
docker image prune -f

echo "Deployment completed successfully!"
```

### 10.2 인프라 코드화 (Infrastructure as Code)

#### **Terraform 구성**
```hcl
# main.tf
terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 4.0.0"
    }
  }
}

provider "oci" {
  region = var.region
}

# VCN 생성
resource "oci_core_vcn" "myblog_vcn" {
  compartment_id = var.compartment_id
  cidr_block     = "10.0.0.0/16"
  display_name   = "myblog-prod-vcn"
  dns_label      = "myblogprod"
}

# Public Subnet
resource "oci_core_subnet" "public_subnet" {
  cidr_block        = "10.0.1.0/24"
  compartment_id    = var.compartment_id
  vcn_id            = oci_core_vcn.myblog_vcn.id
  display_name      = "public-subnet"
  dns_label         = "public"
  route_table_id    = oci_core_route_table.public_route_table.id
  security_list_ids = [oci_core_security_list.public_security_list.id]
}

# Private Subnet for Applications
resource "oci_core_subnet" "app_subnet" {
  cidr_block                 = "10.0.2.0/24"
  compartment_id            = var.compartment_id
  vcn_id                    = oci_core_vcn.myblog_vcn.id
  display_name              = "app-subnet"
  dns_label                 = "app"
  prohibit_public_ip_on_vnic = true
  route_table_id            = oci_core_route_table.private_route_table.id
  security_list_ids         = [oci_core_security_list.app_security_list.id]
}

# Compute Instances
resource "oci_core_instance" "app_server" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_id
  shape               = "VM.Standard.A1.Flex"
  display_name        = "myblog-app-server"

  shape_config {
    ocpus         = 3
    memory_in_gbs = 18
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.app_subnet.id
    display_name     = "app-server-vnic"
    assign_public_ip = false
  }

  source_details {
    source_type = "image"
    source_id   = var.ubuntu_image_id
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      docker_compose = file("${path.module}/docker-compose.yml")
    }))
  }
}

# Load Balancer
resource "oci_load_balancer_load_balancer" "myblog_lb" {
  compartment_id = var.compartment_id
  display_name   = "myblog-load-balancer"
  shape          = "flexible"

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 10
  }

  subnet_ids = [oci_core_subnet.public_subnet.id]
}
```

---

## 📋 11. 종합 배포 체크리스트

### 11.1 사전 준비 체크리스트

#### **OCI 계정 및 설정**
```yaml
□ OCI 계정 생성 및 무료 티어 활성화
□ Compartment 생성 (myblog-prod)
□ API 키 생성 및 CLI 설정
□ 도메인 구매 및 DNS 설정
□ GitHub Repository 준비
□ Docker Hub/OCI Registry 계정

보안 설정:
□ SSH 키 페어 생성
□ OCI Vault에 시크릿 저장
□ IAM 정책 설정
□ MFA 활성화
□ 백업 계정 설정
```

#### **개발 환경 준비**
```yaml
□ Terraform 설치 및 설정
□ OCI CLI 설치 및 인증
□ Docker & Docker Compose 설치
□ kubectl 설치 (향후 K8s 이전용)
□ Monitoring 도구 설정

코드 준비:
□ 환경별 설정 파일 분리
□ Docker 이미지 최적화
□ Health check 엔드포인트 구현
□ Graceful shutdown 구현
□ 로깅 표준화
```

### 11.2 배포 실행 체크리스트

#### **인프라 배포 (Terraform)**
```yaml
Phase 1: 네트워크 인프라
□ VCN 및 서브넷 생성
□ Internet/NAT Gateway 설정
□ 라우팅 테이블 구성
□ 보안 그룹 설정
□ Load Balancer 생성

Phase 2: 컴퓨트 인스턴스
□ VM 인스턴스 생성
□ Block Storage 연결
□ SSH 접속 확인
□ 기본 소프트웨어 설치
□ Docker Swarm 클러스터 구성

Phase 3: 데이터베이스 설정
□ PostgreSQL 컨테이너 배포
□ 데이터베이스 초기화
□ 백업 스크립트 설정
□ 모니터링 에이전트 설치
□ 연결 테스트
```

#### **애플리케이션 배포**
```yaml
Phase 1: 컨테이너 배포
□ Docker 이미지 빌드
□ Container Registry에 Push
□ Docker Compose 설정 적용
□ 서비스 시작 및 확인

Phase 2: 설정 및 초기화
□ 환경 변수 설정
□ 데이터베이스 마이그레이션
□ 초기 관리자 계정 생성
□ SSL 인증서 설정
□ DNS 레코드 설정

Phase 3: 모니터링 및 로깅
□ Prometheus 설정
□ Grafana 대시보드 임포트
□ 알림 규칙 설정
□ 로그 수집 설정
□ 백업 자동화 테스트
```

### 11.3 운영 체크리스트

#### **보안 강화**
```yaml
□ fail2ban 설정 (SSH 브루트포스 방지)
□ UFW 방화벽 설정
□ 자동 보안 업데이트 활성화
□ 정기 보안 스캔 설정
□ 액세스 로그 모니터링

□ HTTPS 강제 리다이렉트
□ HSTS 헤더 설정
□ CSP (Content Security Policy) 설정
□ Rate limiting 설정
□ CORS 정책 설정
```

#### **성능 최적화**
```yaml
□ 데이터베이스 인덱스 최적화
□ Redis 캐싱 설정
□ CDN 설정 (Object Storage)
□ 이미지 최적화 자동화
□ Gzip 압축 활성화

□ 로그 로테이션 설정
□ 임시 파일 정리 자동화
□ 메트릭 수집 최적화
□ 알림 임계값 조정
□ 백업 스케줄 최적화
```

#### **모니터링 및 알림**
```yaml
□ 시스템 리소스 모니터링
□ 애플리케이션 성능 모니터링
□ 사용자 활동 추적
□ 오류 로그 모니터링
□ 보안 이벤트 알림

□ 백업 성공/실패 알림
□ 디스크 용량 알림
□ 성능 저하 알림
□ 보안 위협 알림
□ 서비스 장애 알림
```

---

## 🚦 12. 성능 및 용량 예상

### 12.1 예상 성능 지표

#### **현재 구성 기준 성능**
```yaml
웹 서버 성능:
  동시 사용자: ~500명
  초당 요청: ~50 RPS
  평균 응답시간: <200ms
  처리량: ~4,320,000 요청/일

데이터베이스 성능:
  동시 연결: ~100개
  쿼리 처리: ~200 QPS
  평균 쿼리 시간: <50ms
  일 트랜잭션: ~17,280,000개

스토리지 성능:
  Block Storage IOPS: ~3,000
  Object Storage 처리량: ~100MB/s
  백업 속도: ~10GB/시간
  복구 시간: <30분
```

#### **확장성 한계점**
```yaml
CPU 병목점:
  Warning: 70% 사용률
  Critical: 85% 사용률
  최대 RPS: ~75 (CPU 100% 시)

메모리 병목점:
  Warning: 80% 사용률 (19.2GB)
  Critical: 90% 사용률 (21.6GB)
  최대 동시 사용자: ~800명

스토리지 병목점:
  디스크 I/O: 3,000 IOPS 한계
  네트워크: 10TB/월 전송 한계
  백업: 200GB 저장 한계
```

### 12.2 용량 계획

#### **6개월 예상 증가**
```yaml
사용자 증가:
  현재: 100 MAU (Monthly Active Users)
  6개월: 1,000 MAU (10배 증가)
  일일 활성 사용자: 100 → 300 DAU

데이터 증가:
  게시물: 100개/월 → 1,000개/월
  이미지: 1GB/월 → 10GB/월
  데이터베이스: 5GB → 50GB

트래픽 증가:
  페이지뷰: 10,000/월 → 100,000/월
  API 호출: 100,000/월 → 1,000,000/월
  대역폭: 100GB/월 → 1TB/월
```

#### **1년 예상 증가**
```yaml
사용자 증가:
  12개월: 5,000 MAU (50배 증가)
  일일 활성 사용자: 100 → 1,500 DAU
  피크 동시 사용자: 50 → 500명

데이터 증가:
  게시물: 100개/월 → 5,000개/월
  이미지: 1GB/월 → 100GB/월
  데이터베이스: 5GB → 500GB

인프라 요구사항:
  CPU: 4 → 16 OCPUs
  Memory: 24GB → 128GB
  Storage: 200GB → 2TB
  네트워크: 1TB/월 → 5TB/월
```

---

## 📊 13. 결론 및 권장사항

### 13.1 핵심 요약

이 인프라 설계는 **OCI 무료 티어를 100% 활용**하여 강력한 멀티유저 블로그 SaaS 플랫폼을 구축하는 포괄적인 계획을 제시합니다.

#### **주요 성과**
```yaml
비용 효율성:
  - 월 $0 운영비용 (최소 6개월)
  - 유료 전환 시 점진적 비용 증가
  - ROI 최대화 전략

성능 및 확장성:
  - 500+ 동시 사용자 지원
  - 50+ RPS 처리 능력
  - 자동 확장 준비

보안 및 안정성:
  - 엔터프라이즈급 보안 구성
  - 99.9% 가용성 목표
  - 종합적인 재해 복구 계획

운영 효율성:
  - 완전 자동화된 CI/CD
  - 포괄적인 모니터링
  - 효율적인 리소스 관리
```

### 13.2 즉시 실행 권장사항

#### **1주차: 기본 인프라 구축**
```yaml
우선순위 1 (필수):
□ OCI 계정 설정 및 VCN 생성
□ VM 인스턴스 배포 (Terraform)
□ Docker Swarm 클러스터 구성
□ Load Balancer 설정
□ 기본 보안 설정

우선순위 2 (중요):
□ PostgreSQL 데이터베이스 설정
□ SSL 인증서 설정
□ 도메인 연결
□ 기본 모니터링 설정
□ 백업 자동화
```

#### **2-4주차: 애플리케이션 배포 및 최적화**
```yaml
우선순위 1 (필수):
□ 컨테이너 이미지 빌드 및 배포
□ CI/CD 파이프라인 구축
□ 환경 설정 및 데이터 마이그레이션
□ 성능 테스트 및 튜닝
□ 운영 문서화

우선순위 2 (중요):
□ 상세 모니터링 대시보드
□ 알림 시스템 구축
□ 보안 강화 (fail2ban, WAF)
□ 성능 최적화
□ 사용자 문서 작성
```

### 13.3 장기 로드맵

#### **6개월 후: 확장 및 최적화**
```yaml
성능 개선:
- 마이크로서비스 아키텍처 검토
- CDN 도입 및 캐싱 전략 고도화
- 데이터베이스 샤딩 준비
- API Gateway 도입

새 기능:
- 모바일 앱 지원
- 고급 분석 대시보드
- 사용자 맞춤 추천
- 실시간 협업 기능
```

#### **1년 후: 엔터프라이즈 전환**
```yaml
인프라 업그레이드:
- Kubernetes 이전
- Multi-region 배포
- Managed Database 활용
- Advanced Security Services

비즈니스 확장:
- 다국어 지원
- 엔터프라이즈 기능
- 써드파티 통합
- SaaS 파트너십
```

### 13.4 성공 요인

#### **기술적 성공 요인**
```yaml
✅ 철저한 모니터링 및 알림 시스템
✅ 자동화된 배포 및 롤백 프로세스
✅ 포괄적인 백업 및 복구 전략
✅ 확장 가능한 아키텍처 설계
✅ 보안 우선 접근 방식
```

#### **운영적 성공 요인**
```yaml
✅ 명확한 SLA 및 성능 목표
✅ 정기적인 성능 리뷰
✅ 사용자 피드백 수집 체계
✅ 비용 모니터링 및 최적화
✅ 팀 역량 개발 계획
```

이 종합적인 인프라 설계는 **OCI 무료 티어의 모든 리소스를 최대한 활용**하면서도 **엔터프라이즈급 안정성과 확장성**을 제공하는 균형잡힌 솔루션입니다. 단계적 구현을 통해 비용 효율적으로 시작하여 성장에 따라 유연하게 확장할 수 있는 견고한 기반을 마련할 수 있습니다.