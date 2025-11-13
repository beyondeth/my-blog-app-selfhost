# 모니터링 스택 완전 가이드

이 문서는 블로그 플랫폼의 모니터링 인프라(Grafana, VictoriaMetrics, Prometheus)에 대한 포괄적인 가이드를 제공합니다.

## 📊 목차

1. [개요](#개요)
2. [환경별 포트 구성](#환경별-포트-구성)
3. [서비스 상세 정보](#서비스-상세-정보)
4. [빠른 시작](#빠른-시작)
5. [대시보드 구성](#대시보드-구성)
6. [모니터링 메트릭](#모니터링-메트릭)
7. [운영 가이드](#운영-가이드)
8. [문제 해결](#문제-해결)
9. [보안 설정](#보안-설정)

---

## 개요

### 모니터링 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │ →  │  Collectors     │ →  │   Storage       │
│                 │    │                 │    │                 │
│ • NestJS Backend│    │ • Prometheus    │    │ • VictoriaMetrics│
│ • MCP Proxy     │    │ • Redis Exporter│    │ (30일 보관)     │
│ • Redis         │    │ • Custom Metrics│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Grafana       │
                                                │                 │
                                                │ • 시각화        │
                                                │ • 알림          │
                                                │ • 대시보드      │
                                                └─────────────────┘
```

### 현재 상태

- **Docker Daemon**: ❌ 실행 중지
- **모니터링 스택**: ❌ 현재 중단됨
- **설정 상태**: ✅ 완전히 구성됨

---

## 환경별 포트 구성

### 포트 할당 테이블

| 환경 | 서비스 | 포트 | 컨테이너 이름 | 접속 URL | 상태 |
|------|--------|------|---------------|----------|------|
| **개발** | Grafana | `3033` | `codebase-dev-monitoring-grafana` | http://localhost:3033 | 중단 |
| **개발** | VictoriaMetrics | `8428` | `codebase-dev-monitoring-victoriametrics` | http://localhost:8428 | 중단 |
| **개발** | Redis Exporter | `9121` | `codebase-dev-monitoring-redis-exporter` | - | 중단 |
| **프로덕션(VM)** | Grafana | `3030` | (VM 내부) | http://localhost:3030 (SSH 터널) | 실행 중 |
| **프로덕션(VM)** | VictoriaMetrics | 내부 | (VM 내부) | - | 실행 중 |
| **로컬 프로덕션** | Grafana | `4030` | `codebase-prod-grafana` | http://localhost:4030 | 중단 |
| **로컬 프로덕션** | Frontend | `4001` | `codebase-prod-frontend` | http://localhost:4001 | 중단 |
| **로컬 프로덕션** | Backend | `4000` | `codebase-prod-backend` | http://localhost:4000 | 중단 |
| **로컬 프로덕션** | MCP Proxy | `4002` | `codebase-prod-mcp-proxy` | http://localhost:4002 | 중단 |

---

## 서비스 상세 정보

### 1. Grafana

#### 역할
- 메트릭 시각화 및 대시보드
- 알림 및 경고 관리
- 사용자 인증 및 권한 관리

#### 환경별 설정

**개발 환경 (3033)**
```yaml
# monitoring/docker-compose.unified-monitoring.yml
grafana:
  image: grafana/grafana:10.2.0
  ports:
    - "127.0.0.1:3033:3000"
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
```

**프로덕션 환경 (3030)**
```yaml
# docker-compose.prod.oracle.yml
grafana:
  image: grafana/grafana:10.2.0
  ports:
    - "127.0.0.1:3030:3000"
  environment:
    - GF_SECURITY_ADMIN_USER=${GRAFANA_USER}
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
```

### 2. VictoriaMetrics

#### 역할
- 고성능 시계열 데이터베이스
- Prometheus 호환 API
- 효율적인 데이터 압축 및 보관

#### 설정
```yaml
victoriametrics:
  image: victoriametrics/victoria-metrics:latest
  ports:
    - "127.0.0.1:8428:8428"
  command:
    - --storageDataPath=/data
    - --retentionPeriod=30d
    - --memory.limit=100MB
  volumes:
    - ./data/vm:/data
```

#### 주요 특징
- **데이터 보관 기간**: 30일
- **메모리 제한**: 100MB
- **스크레이핑 간격**: 30초
- **Prometheus 호환**: 완전 호환

### 3. Prometheus (레거시)

#### 참고
- 현재는 VictoriaMetrics로 마이그레이션 완료
- 개발 환경에서만 사용 가능
- 포트 9090 (현재 미사용)

### 4. Redis Exporter

#### 역할
- Redis 성능 메트릭 수집
- 메모리 사용량 추적
- 캐시 히트율 모니터링

#### 설정
```yaml
redis-exporter:
  image: oliver006/redis_exporter:latest
  ports:
    - "127.0.0.1:9121:9121"
  environment:
    - REDIS_ADDR=redis://redis:6379
  command:
    - --include-system-metrics=false
    - --memory-limit=50MB
```

---

## 빠른 시작

### 1. 개발 환경 모니터링 시작

```bash
# 모니터링 디렉토리로 이동
cd monitoring

# 서비스 시작
docker compose -f docker-compose.unified-monitoring.yml up -d

# 확인
docker ps --filter "name=codebase-dev-monitoring"
```

#### 접속 정보
- **Grafana**: http://localhost:3033
  - ID/PW: admin/admin
- **VictoriaMetrics**: http://localhost:8428
- **메트릭 엔드포인트**: http://localhost:8428/metrics

### 2. 프로덕션 환경 접속 (VM)

```bash
# SSH 터널 생성
ssh -L 3030:localhost:3030 -i ~/.ssh/oracle_key ubuntu@<VM_IP>

# 다른 터미널에서 접속
open http://localhost:3030
```

### 3. 로컬 프로덕션 테스트

```bash
# 프로덕션 환경 로컬 실행
docker compose -f docker-compose.prod.oracle.yml \
               -f docker-compose.prod.local.yml \
               up -d

# 확인
docker ps --filter "name=codebase-prod"
```

---

## 대시보드 구성

### 사전 구성된 대시보드 (6개)

| 대시보드 | 파일명 | 주요 메트릭 | 목적 |
|----------|--------|-------------|------|
| **시스템 현황** | `01-전체-시스템-현황.json` | CPU, 메모리, 디스크 | 전체 시스템 상태 모니터링 |
| **채팅 큐** | `02-채팅-큐-모니터링.json` | 큐 사이즈, 처리량 | 실시간 채팅 시스템 성능 |
| **좋아요 큐** | `03-좋아요-큐-모니터링.json` | 처리량, 지연시간 | 좋아요 처리 성능 |
| **Redis 통계** | `04-Redis-서버-통계.json` | 메모리, 히트율 | 캐시 성능 분석 |
| **캐시 성능** | `05-애플리케이션-캐시-성능.json` | API 캐시 효율 | 애플리케이션 캐시 분석 |
| **MCP API** | `06-MCP-자동포스팅-API.json` | API 키 캐시, 요청수 | MCP 서비스 성능 |

### 대시보드 자동 임포트

```bash
# 대시보드 디렉토리
monitoring/grafana/dashboards/

# 프로비저닝 설정
monitoring/grafana/provisioning/dashboards/
monitoring/grafana/provisioning/datasources/
```

---

## 모니터링 메트릭

### Backend 메트릭 (NestJS)

#### 엔드포인트
- **경로**: `/api/v1/metrics`
- **포맷**: Prometheus 텍스트 포맷

#### 주요 메트릭
```promql
# HTTP 요청 수
http_requests_total{method="GET",status="200"}

# 응답 시간
http_request_duration_seconds{quantile="0.95"}

# 활성 연결 수
active_connections_total

# 데이터베이스 연결 풀
db_connections_active
```

### MCP Proxy 메트릭

#### 엔드포인트
- **경로**: `/metrics`
- **인증**: Bearer 토큰 필요

#### 주요 메트릭
```promql
# API 키 캐시 성능
mcp_api_key_cache_hits_total
mcp_api_key_cache_misses_total

# 요청 처리량
mcp_requests_total{method="POST",status="200"}

# API 키 검사 지연시간
mcp_api_key_check_duration_seconds
```

### Redis 메트릭

#### 수집 항목
- **메모리 사용량**: `used_memory`, `used_memory_rss`
- **캐시 히트율**: `keyspace_hits_total`, `keyspace_misses_total`
- **연결 수**: `connected_clients`
- **명령어 처리**: `commands_processed_total`

#### 성능 목표
- **캐시 히트율**: 90% 이상
- **메모리 사용**: 80% 이하
- **응답 시간**: 10ms 이하

---

## 운영 가이드

### 모니터링 시작/중지

#### 개발 환경
```bash
# 시작
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml up -d

# 중지
docker compose -f docker-compose.unified-monitoring.yml down

# 재시작
docker compose -f docker-compose.unified-monitoring.yml restart
```

#### 로그 확인
```bash
# Grafana 로그
docker logs -f codebase-dev-monitoring-grafana

# VictoriaMetrics 로그
docker logs -f codebase-dev-monitoring-victoriametrics

# Redis Exporter 로그
docker logs -f codebase-dev-monitoring-redis-exporter
```

### 데이터 관리

#### 데이터 백업
```bash
# VictoriaMetrics 데이터 백업
tar -czf vm-backup-$(date +%Y%m%d).tar.gz monitoring/data/vm/

# Grafana 대시보드 백업
docker exec codebase-dev-monitoring-grafana \
  grafana-cli admin export-dashboard > dashboard-backup.json
```

#### 데이터 정리
```bash
# 30일 이상된 데이터 자동 정리 (설정됨)
# retentionPeriod=30d

# 수동 정리
curl -X POST http://localhost:8428/api/v1/admin/delete_series?match[]={__name__=~".+"}
```

### 성능 최적화

#### 스크레이핑 간격 조정
```yaml
# 30초 간격 (현재 설정)
scrape_interval: 30s

# 15초로 변경 시 리소스 사용량 증가 주의
scrape_interval: 15s
```

#### 메트릭 필터링
```yaml
# 불필요한 메트릭 제외
metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'go_gc_.*|nodejs_.*'
    action: drop
```

---

## 문제 해결

### 일반적인 문제

#### 1. 포트 충돌
```bash
# 에러: "port is already allocated"

# 해결: 사용 중인 포트 확인
lsof -i :3033
lsof -i :8428

# 해결: 충돌하는 서비스 중지
docker ps | grep grafana
docker stop <container_name>
```

#### 2. Grafana 접속 불가
```bash
# 확인: 컨테이너 상태
docker ps | filter grafana

# 확인: 로그
docker logs codebase-dev-monitoring-grafana

# 해결: 재시작
docker restart codebase-dev-monitoring-grafana
```

#### 3. 메트릭 수집 안됨
```bash
# 확인: 엔드포인트 접속
curl http://localhost:3000/api/v1/metrics

# 확인: VictoriaMetrics 수집
curl http://localhost:8428/api/v1/query?query=up

# 해결: 스크랩 설정 확인
# monitoring/prometheus/prometheus.yml
```

### 디버깅 명령어

```bash
# 전체 컨테이너 상태
docker compose -f docker-compose.unified-monitoring.yml ps

# 실시간 리소스 사용량
docker stats

# 네트워크 연결 확인
docker network ls
docker network inspect monitoring_default
```

---

## 보안 설정

### 네트워크 보안

#### 로컬 바인딩만
- 모든 서비스 `127.0.0.1`에만 바인딩
- 외부 접속 차단
- SSH 터널 통해서만 프로덕션 접속

#### 방화벽 설정 (프로덕션)
```bash
# VM 방화벽 규칙
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3030   # Grafana 외부 접속 차단
```

### 인증 설정

#### 개발 환경
```yaml
GF_SECURITY_ADMIN_USER: admin
GF_SECURITY_ADMIN_PASSWORD: admin
GF_SECURITY_DISABLE_GRAVATAR: true
```

#### 프로덕션 환경
```yaml
GF_SECURITY_ADMIN_USER: ${GRAFANA_USER}
GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
GF_SECURITY_SECRET_KEY: ${GRAFANA_SECRET_KEY}
```

### API 접근 제어

#### MCP Proxy 인증
```bash
# Bearer 토큰 필요
curl -H "Authorization: Bearer ${MCP_TOKEN}" \
     http://localhost:4002/metrics
```

#### Backend 메트릭
```bash
# JWT 쿠키 필요
curl -b cookies.txt \
     http://localhost:3000/api/v1/metrics
```

---

## 부록

### 유용한 링크

- [Grafana 공식 문서](https://grafana.com/docs/)
- [VictoriaMetrics 문서](https://docs.victoriametrics.com/)
- [Redis Exporter GitHub](https://github.com/oliver006/redis_exporter)

### 모니터링 모범 사례

1. **메트릭 설계**
   - 의미 있는 메트릭만 수집
   - 레이블 과사용 금지
   - 카디널리티 낮게 유지

2. **알림 설정**
   - 중요한 메트릭만 알림
   - 알림 피로 방지
   - 에스컬레이션 정책 수립

3. **대시보드 설계**
   - 한 화면에 핵심 정보만
   - 시각적 명확성
   - 실용성 중심

---

**문서 작성일**: 2025-01-28
**마지막 업데이트**: 2025-01-28
**버전**: 1.0.0