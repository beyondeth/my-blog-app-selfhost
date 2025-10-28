# PostgreSQL 18 업그레이드 가이드

## 📋 목차
1. [개요](#개요)
2. [주요 변경사항](#주요-변경사항)
3. [개발 환경 업그레이드](#개발-환경-업그레이드)
4. [프로덕션 환경 업그레이드](#프로덕션-환경-업그레이드)
5. [설정 최적화](#설정-최적화)
6. [문제 해결](#문제-해결)
7. [롤백 절차](#롤백-절차)

---

## 개요

### 버전 정보
- **이전 버전**: PostgreSQL 16-alpine
- **업그레이드 버전**: PostgreSQL 18-alpine
- **배포 환경**: Docker Compose
- **대상 아키텍처**: ARM64 (OCI Ampere A1)

### 업그레이드 이유
- **성능 향상**: 비동기 I/O로 최대 3배 성능 개선
- **보안 강화**: 데이터 체크섬 기본 활성화, SCRAM-SHA-256 암호화
- **최신 기능**: Skip scan, GIN 병렬 인덱스 빌드, UUIDv7 지원

---

## 주요 변경사항

### 1. Docker 마운트 경로 변경 ⚠️

**PostgreSQL 17 이하:**
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**PostgreSQL 18:**
```yaml
environment:
  PGDATA: /var/lib/postgresql/pgdata
volumes:
  - postgres_data:/var/lib/postgresql
```

### 2. 비동기 I/O 시스템
- **io_method**: `worker` (기본값, io_uring은 alpine에서 미지원)
- **성능**: I/O 작업 3배 향상
- **호환성**: ARM64 NEON/SVE 최적화

### 3. 보안 개선
- **데이터 체크섬**: 기본 활성화 (손상 감지)
- **암호화**: MD5 deprecated, SCRAM-SHA-256 필수

### 4. 인증 시스템 구분
- **소셜 로그인 OAuth**: Google, GitHub, Kakao (users 테이블) - 유지
- **MCP OAuth2.1**: oauth_clients, oauth_tokens, oauth_codes - 제거됨
- **MCP API Key**: mcp_api_keys 테이블 - 새로운 인증 방식

---

## 개발 환경 업그레이드

### 1. 사전 준비

```bash
cd /path/to/my-blog-app

# 1. 백업 (선택사항 - 개발환경)
docker exec my-blog-app-postgres pg_dump -U postgres -d blog-dev > backup_dev.sql

# 2. 현재 컨테이너 확인
docker ps --filter "name=my-blog-app"
```

### 2. pg 드라이버 업데이트

`backend/package.json`:
```json
{
  "dependencies": {
    "pg": "^8.13.1"  // 8.11.0 → 8.13.1
  }
}
```

```bash
cd backend && pnpm install
```

### 3. Docker Compose 파일 수정

`docker-compose.dev.yml`:
```yaml
services:
  postgres:
    image: postgres:18-alpine  # 16-alpine → 18-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-blog-dev}
      PGDATA: /var/lib/postgresql/pgdata  # 경로 변경
    volumes:
      - postgres_data:/var/lib/postgresql  # 마운트 경로 변경
```

### 4. 컨테이너 재구성

```bash
# 1. 기존 컨테이너 및 볼륨 정리 (데이터 삭제됨)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

# 2. PostgreSQL 18 컨테이너 시작
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# 3. 버전 확인
docker exec my-blog-app-postgres psql -U postgres -c "SELECT version();"
# 출력: PostgreSQL 18.0 on aarch64-unknown-linux-musl
```

### 5. 마이그레이션 실행

```bash
# 1. Backend 컨테이너 시작
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend

# 2. 마이그레이션 실행 (37개 파일)
docker exec my-blog-app-backend pnpm migration:run

# 3. 결과 확인
docker exec my-blog-app-postgres psql -U postgres -d blog-dev -c "\dt"
# 32개 테이블 생성 확인
```

### 6. 전체 서비스 시작

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 서비스 상태 확인
docker ps --filter "name=my-blog-app"
```

### 7. 검증

```bash
# PostgreSQL 18 설정 확인
docker exec my-blog-app-postgres psql -U postgres -d blog-dev -c "
  SELECT
    version(),
    current_setting('io_method') as io_method,
    current_setting('data_checksums') as data_checksums,
    current_setting('password_encryption') as password_encryption
"

# 테이블 확인
docker exec my-blog-app-postgres psql -U postgres -d blog-dev -c "
  SELECT COUNT(*) as total_tables
  FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
"

# MCP API key 테이블 확인
docker exec my-blog-app-postgres psql -U postgres -d blog-dev -c "
  SELECT COUNT(*) FROM mcp_api_keys
"

# Backend health check
curl -s http://localhost:3000/api/v1/metrics | head -5
```

---

## 프로덕션 환경 업그레이드

### 1. 사전 준비

#### 1.1 환경 정보 확인
```bash
# OCI 인스턴스 정보
uname -m  # aarch64 확인
free -h   # 메모리: 24GB
nproc     # CPU: 4 cores
```

#### 1.2 백업 ⚠️ 필수
```bash
# 전체 데이터베이스 백업
docker exec codebase-prod-postgres pg_dump -U ${DB_USER} -d ${DB_NAME} -Fc > backup_prod_$(date +%Y%m%d_%H%M%S).dump

# 백업 확인
ls -lh backup_prod_*.dump

# 백업 파일을 안전한 위치로 복사
scp backup_prod_*.dump user@backup-server:/backups/
```

#### 1.3 다운타임 계획
- **예상 다운타임**: 5-10분
- **작업 시간**: 새벽 3-4시 (트래픽 최소 시간대)
- **롤백 시간**: 3-5분 (백업 복구)

### 2. 프로덕션 설정 파일 생성

`backend/config/postgresql.prod.conf`:
```conf
# ============================================
# PostgreSQL 18 Production Configuration
# OCI Ampere A1: 4 vCPU, 24GB RAM
# ============================================

# ----------------
# Async I/O (PostgreSQL 18 신규 기능)
# ----------------
io_method = worker
effective_io_concurrency = 200

# ----------------
# Memory Settings (24GB 기준)
# ----------------
shared_buffers = 6GB                    # 전체 메모리의 25%
effective_cache_size = 12GB             # 전체 메모리의 50%
work_mem = 16MB                         # 정렬/해시 작업
maintenance_work_mem = 1GB              # 인덱스 생성/VACUUM

# ----------------
# Parallel Processing (ARM 4 Core)
# ----------------
max_worker_processes = 4
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
max_parallel_maintenance_workers = 2

# ----------------
# Write Ahead Log (WAL)
# ----------------
wal_buffers = 16MB
max_wal_size = 2GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9

# ----------------
# Query Planner
# ----------------
random_page_cost = 1.0                  # SSD 최적화
effective_cache_size = 12GB

# ----------------
# Connections
# ----------------
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# ----------------
# Logging
# ----------------
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = off
log_lock_waits = on
log_statement = 'ddl'
log_temp_files = 0
log_min_duration_statement = 1000       # 1초 이상 쿼리 로깅

# ----------------
# Performance Monitoring
# ----------------
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all

# pg_stat_statements 설정
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# ----------------
# Security
# ----------------
password_encryption = scram-sha-256
ssl = off                               # 로컬 Docker 네트워크

# ----------------
# Autovacuum
# ----------------
autovacuum = on
autovacuum_max_workers = 2
autovacuum_naptime = 10s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02
```

### 3. Docker Compose 프로덕션 파일 수정

`docker-compose.prod.yml`:
```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: ${COMPOSE_PROJECT_NAME:-codebase-prod}-postgres
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      PGDATA: /var/lib/postgresql/pgdata
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql
      - ./backend/config/postgresql.prod.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - codebase_network
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
        reservations:
          cpus: '1.0'
          memory: 4G

  backend:
    depends_on:
      postgres:
        condition: service_healthy
```

### 4. 프로덕션 배포 실행

#### 4.1 사용자 공지
```
- 시스템 점검 공지: 작업 시작 1시간 전
- 예상 다운타임: 5-10분
```

#### 4.2 배포 절차

```bash
# 1. 프로덕션 서버 접속
ssh your-production-server

# 2. 프로젝트 디렉토리 이동
cd /path/to/my-blog-app

# 3. 최신 코드 pull
git pull origin main

# 4. 환경 변수 확인
cat .env.production | grep -E "DB_USER|DB_PASSWORD|DB_NAME|DB_PORT"

# 5. 현재 컨테이너 중지
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 6. 볼륨 백업 (선택사항 - 추가 안전장치)
docker volume ls | grep postgres
docker run --rm -v codebase-prod-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_volume_backup.tar.gz /data

# 7. 새 컨테이너 시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 8. PostgreSQL 18 시작 대기
sleep 15

# 9. 버전 확인
docker exec codebase-prod-postgres psql -U ${DB_USER} -c "SELECT version();"
```

#### 4.3 데이터 마이그레이션 (필요 시)

```bash
# 백업에서 복구 (새 DB 생성 시)
docker exec -i codebase-prod-postgres pg_restore -U ${DB_USER} -d ${DB_NAME} -v < backup_prod.dump

# 또는 마이그레이션 실행
docker exec codebase-prod-backend pnpm migration:run
```

#### 4.4 검증

```bash
# 1. 컨테이너 상태 확인
docker ps --filter "name=codebase-prod"

# 2. PostgreSQL 18 설정 확인
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT
    name,
    setting,
    unit
  FROM pg_settings
  WHERE name IN (
    'io_method',
    'data_checksums',
    'password_encryption',
    'shared_buffers',
    'effective_cache_size',
    'max_worker_processes'
  )
  ORDER BY name
"

# 3. 데이터베이스 연결 테스트
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT
    COUNT(*) as total_users,
    (SELECT COUNT(*) FROM posts) as total_posts,
    (SELECT COUNT(*) FROM mcp_api_keys) as total_api_keys
  FROM users
"

# 4. Backend health check
curl -s https://your-domain.com/api/v1/health

# 5. 로그 확인
docker logs codebase-prod-backend --tail 50
docker logs codebase-prod-postgres --tail 30
```

---

## 설정 최적화

### ARM64 (OCI Ampere A1) 최적화

#### 하드웨어 스펙
- **CPU**: 4 vCPU (ARM Neoverse-N1)
- **메모리**: 24GB
- **스토리지**: SSD (IOPS 최적화)

#### 최적화 포인트

1. **Shared Buffers**: 6GB (메모리의 25%)
2. **Effective Cache Size**: 12GB (메모리의 50%)
3. **Work Mem**: 16MB (100 connections 기준)
4. **Max Worker Processes**: 4 (CPU 코어 수)
5. **Random Page Cost**: 1.0 (SSD 최적화)
6. **Effective IO Concurrency**: 200 (SSD)

### 성능 모니터링

```bash
# pg_stat_statements 확장 활성화
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
"

# 느린 쿼리 확인
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT
    query,
    calls,
    total_exec_time / calls AS avg_time,
    total_exec_time
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC
  LIMIT 10
"

# 캐시 히트율 확인
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
  FROM pg_statio_user_tables
"
```

---

## 문제 해결

### 1. 마운트 경로 오류

**에러:**
```
initdb: error: directory "/var/lib/postgresql/data" exists but is not empty
```

**해결:**
```yaml
environment:
  PGDATA: /var/lib/postgresql/pgdata
volumes:
  - postgres_data:/var/lib/postgresql
```

### 2. 마이그레이션 순서 오류

**에러:**
```
relation "posts" does not exist
```

**원인:** InitialSchema 마이그레이션이 나중에 실행됨

**해결:**
```bash
# 마이그레이션 파일명 변경 (타임스탬프 앞당기기)
mv 1757158710842-InitialSchema.ts 1757000000000-InitialSchema.ts

# 클래스명도 변경
export class InitialSchema1757000000000 implements MigrationInterface {
  name = 'InitialSchema1757000000000'
}
```

### 3. hypopg 확장 없음

**에러:**
```
extension "hypopg" is not available
```

**해결:** PostgreSQL 18-alpine에서 아직 미지원, 마이그레이션에서 제거

```typescript
// DatabaseOptimization 마이그레이션
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
// hypopg는 PostgreSQL 18-alpine에서 아직 사용 불가능
```

### 4. OAuth 테이블 없음

**에러:**
```
relation "oauth_clients" does not exist
```

**원인:** MCP OAuth2.1 시스템 제거됨 (API key로 교체)

**해결:**
```typescript
// CreateSubscriptionSystem 마이그레이션
await queryRunner.query(`ALTER TABLE IF EXISTS "oauth_clients" DROP CONSTRAINT IF EXISTS "FK_oauth_clients_userId"`);

// oauth 테이블 인덱스/FK 생성 주석 처리
// await queryRunner.query(`CREATE INDEX "IDX_89481ceb60b67e5e052bf6e16f" ON "oauth_clients" ("userId") `);
```

### 5. 연결 실패

**증상:** Backend가 DB에 연결 못함

**확인:**
```bash
# PostgreSQL 로그 확인
docker logs codebase-prod-postgres --tail 50

# 연결 테스트
docker exec codebase-prod-backend psql -h postgres -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1"
```

**해결:**
- `depends_on` healthcheck 확인
- 네트워크 설정 확인
- 환경 변수 확인

---

## 롤백 절차

### 시나리오 1: 데이터 손실 없음 (설정 문제)

```bash
# 1. 컨테이너 중지
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 2. docker-compose 파일 롤백
git checkout HEAD~1 docker-compose.prod.yml backend/config/postgresql.prod.conf

# 3. PostgreSQL 16으로 재시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 시나리오 2: 데이터 복구 필요

```bash
# 1. 컨테이너 중지 및 볼륨 삭제
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

# 2. PostgreSQL 16으로 롤백
git checkout HEAD~1 docker-compose.prod.yml

# 3. 컨테이너 시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres

# 4. 백업에서 복구
docker exec -i codebase-prod-postgres pg_restore -U ${DB_USER} -d ${DB_NAME} --clean -v < backup_prod.dump

# 5. 검증
docker exec codebase-prod-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT COUNT(*) FROM users;"
```

### 시나리오 3: 긴급 롤백 (볼륨 백업 복구)

```bash
# 1. 컨테이너 중지
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 2. 볼륨 삭제
docker volume rm codebase-prod-postgres-data

# 3. 볼륨 백업 복구
docker run --rm -v codebase-prod-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_volume_backup.tar.gz -C /

# 4. PostgreSQL 16 재시작
git checkout HEAD~1 docker-compose.prod.yml
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 체크리스트

### 개발 환경
- [ ] pg 드라이버 8.13.1 업데이트
- [ ] docker-compose.dev.yml 마운트 경로 변경
- [ ] 컨테이너 재생성 (down -v)
- [ ] PostgreSQL 18 버전 확인
- [ ] 37개 마이그레이션 실행
- [ ] 32개 테이블 생성 확인
- [ ] MCP API key 테이블 확인
- [ ] 메트릭 엔드포인트 확인

### 프로덕션 환경
- [ ] 백업 생성 (pg_dump)
- [ ] 백업 파일 안전한 위치에 저장
- [ ] postgresql.prod.conf 생성
- [ ] docker-compose.prod.yml 수정
- [ ] 다운타임 공지 (1시간 전)
- [ ] 새벽 시간대 작업
- [ ] 컨테이너 재배포
- [ ] PostgreSQL 18 버전 확인
- [ ] 설정값 확인 (io_method, shared_buffers 등)
- [ ] 데이터 무결성 확인
- [ ] Backend 연결 확인
- [ ] Health check 확인
- [ ] 모니터링 시스템 확인
- [ ] 롤백 절차 준비

---

## 참고 자료

- [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html)
- [PostgreSQL 18 ARM64 Support](https://www.postgresql.org/docs/18/install-binaries.html)
- [Docker PostgreSQL 18 Official Image](https://hub.docker.com/_/postgres)
- [TypeORM Migrations](https://typeorm.io/migrations)

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-10-23
**작성자**: Claude Code
**검증 환경**: Development ✅ | Production ⏳
