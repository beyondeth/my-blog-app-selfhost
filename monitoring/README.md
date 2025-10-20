# 통합 모니터링 시스템 (Unified Monitoring)

블로그 플랫폼의 통합 모니터링 시스템입니다. Backend, MCP Proxy Server, Redis, System 메트릭을 한곳에서 관리합니다.

## 📊 시스템 구성

### 모니터링 대상
- **Backend (NestJS)** - Port 3000
  - Chat Queue (4 shards)
  - Like Queue (4 shards)
  - Post Processing Queue
  - HTTP 요청/응답
  - Node.js 런타임 메트릭

- **MCP Proxy Server** - Port 3002
  - HTTP 요청 메트릭
  - Redis 작업 메트릭
  - OAuth 세션 메트릭
  - Tool 호출 메트릭

- **Redis** - Port 6379
  - 메모리 사용량
  - 명령어 처리율
  - 키 개수
  - 연결 상태

- **System**
  - CPU 사용률
  - 메모리 사용률
  - 디스크 I/O
  - 네트워크 I/O

### 모니터링 스택
- **Prometheus** (Port 9090) - 메트릭 수집 및 저장
- **Grafana** (Port 3030) - 대시보드 시각화
- **Redis Exporter** (Port 9121) - Redis 메트릭 수집
- **Node Exporter** (Port 9100) - 시스템 메트릭 수집

## 🚀 빠른 시작

### 1. 모니터링 스택 시작

```bash
# monitoring 디렉토리로 이동
cd monitoring

# Docker Compose로 모니터링 스택 시작
docker-compose -f docker-compose.unified-monitoring.yml up -d

# 로그 확인
docker-compose -f docker-compose.unified-monitoring.yml logs -f
```

### 2. 접속 정보

- **Grafana**: http://localhost:3030
  - Username: `admin`
  - Password: `admin`

- **Prometheus**: http://localhost:9090

### 3. 모니터링 스택 중지

```bash
docker-compose -f docker-compose.unified-monitoring.yml down
```

## 📈 대시보드 목록

### 1. System Overview
**경로**: Grafana > Blog Platform > 1. System Overview

전체 시스템의 상태를 한눈에 확인할 수 있는 대시보드

**주요 패널**:
- Backend 서버 상태 (UP/DOWN)
- MCP Proxy 상태 (UP/DOWN)
- Redis 상태 (UP/DOWN)
- Redis 메모리 사용량
- Redis Commands/sec
- HTTP 요청률
- 활성 MCP 세션 수
- 전체 Redis 키 개수

### 2. Chat Queue Monitoring
**경로**: Grafana > Blog Platform > 2. Chat Queue

채팅 큐 시스템의 상세 모니터링

**주요 패널**:
- 큐 크기 (현재 대기 중인 메시지 수)
- DLQ 크기 (실패한 메시지 수)
- 처리된 메시지 수 (성공/실패)
- 배치 처리 시간
- 메시지 지연 시간
- 연속 실패 횟수
- WebSocket 연결 수
- Redis 연결 상태

### 3. Like Queue Monitoring
**경로**: Grafana > Blog Platform > 3. Like Queue

좋아요 큐 시스템의 상세 모니터링

**주요 패널**:
- 샤드별 큐 크기 (4개 샤드)
- DLQ 크기
- 처리된 좋아요 수 (성공/실패)
- 배치 처리 시간
- 좋아요 지연 시간
- 연속 실패 횟수
- Redis 연결 상태

### 4. Redis Overview
**경로**: Grafana > Blog Platform > 4. Redis Overview

Redis 전체 메트릭 모니터링

**주요 패널**:
- 메모리 사용량 (Used/Peak/Limit)
- 명령어 처리율 (Commands/sec)
- 키 개수 (전체/만료)
- 연결된 클라이언트 수
- 히트율 (Cache Hit Ratio)
- 네트워크 입출력
- 데이터베이스별 키 개수
- Evicted/Expired 키 수

### 5. MCP Proxy Server
**경로**: Grafana > Blog Platform > 5. MCP Proxy Server

MCP Proxy 서버의 상세 모니터링

**주요 패널**:
- HTTP 요청 메트릭
- Redis 작업 메트릭
- OAuth 세션 메트릭
- Tool 호출 메트릭
- 에러율
- 응답 시간

## 📁 디렉토리 구조

```
monitoring/
├── docker-compose.unified-monitoring.yml  # 통합 Docker Compose 설정
├── README.md                              # 이 문서
├── prometheus/
│   ├── prometheus.yml                     # Prometheus 설정 (모든 타겟 포함)
│   └── alerts.yml                         # Alert 규칙 정의
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   │   └── prometheus.yml             # Prometheus 데이터소스 자동 설정
    │   └── dashboards/
    │       └── dashboard.yml              # 대시보드 자동 로딩 설정
    └── dashboards/
        ├── 1-system-overview.json         # System Overview 대시보드
        ├── 2-chat-queue.json              # Chat Queue 대시보드
        ├── 3-like-queue.json              # Like Queue 대시보드
        ├── 4-redis-overview.json          # Redis Overview 대시보드
        └── 5-mcp-proxy.json               # MCP Proxy 대시보드
```

## 🔧 설정

### Prometheus 스크래핑 타겟

**Backend (NestJS)**
- Target: `host.docker.internal:3000`
- Path: `/internal/health-check-2f4a8b9c`
- Interval: 10s

**MCP Proxy Server**
- Target: `host.docker.internal:3002`
- Path: `/metrics`
- Interval: 10s

**Redis Exporter**
- Target: `redis-exporter:9121`
- Interval: 10s

**Node Exporter**
- Target: `node-exporter:9100`
- Interval: 15s

### Grafana Provisioning

모든 대시보드는 자동으로 프로비저닝됩니다:
- 폴더: "Blog Platform"
- 자동 업데이트: 10초마다
- UI 수정 허용: Yes

## 🔍 트러블슈팅

### 대시보드가 보이지 않을 때

```bash
# Grafana 컨테이너 로그 확인
docker logs unified-grafana

# 대시보드 파일 권한 확인
ls -la grafana/dashboards/

# Grafana 재시작
docker-compose -f docker-compose.unified-monitoring.yml restart grafana
```

### 메트릭이 수집되지 않을 때

```bash
# Prometheus 타겟 상태 확인
# http://localhost:9090/targets

# Backend 메트릭 엔드포인트 직접 확인
curl http://localhost:3000/internal/health-check-2f4a8b9c

# MCP Proxy 메트릭 엔드포인트 직접 확인
curl http://localhost:3002/metrics

# Prometheus 로그 확인
docker logs unified-prometheus
```

### Redis Exporter 연결 문제

```bash
# Redis 연결 확인
redis-cli -h localhost -p 6379 ping

# Redis Exporter 로그 확인
docker logs unified-redis-exporter

# Redis Exporter 재시작
docker-compose -f docker-compose.unified-monitoring.yml restart redis-exporter
```

## 📝 추가 설정

### Prometheus 설정 변경 후 리로드

```bash
# 설정 파일 검증
docker exec unified-prometheus promtool check config /etc/prometheus/prometheus.yml

# 설정 리로드 (재시작 없이)
curl -X POST http://localhost:9090/-/reload
```

### Grafana 비밀번호 변경

```bash
# Grafana 컨테이너 접속
docker exec -it unified-grafana grafana-cli admin reset-admin-password <새비밀번호>
```

## 🔄 기존 모니터링 시스템 마이그레이션

기존에 분리되어 있던 2개의 모니터링 스택:
1. Chat/Backend 모니터링 (port 3030)
2. MCP 모니터링 (port 3333)

이 통합 시스템으로 모두 대체됩니다.

### 리소스 절감
- **Before**: Grafana 2개 + Prometheus 2개 = ~1.48GB
- **After**: Grafana 1개 + Prometheus 1개 = ~780MB
- **절감**: 47% (약 700MB)

### 백업 위치
기존 설정 파일은 `/monitoring-backup/` 폴더에 보관됩니다.

## 📞 문의

모니터링 시스템 관련 문의사항이나 개선 제안은 프로젝트 관리자에게 연락하세요.
