# 채팅 큐 시스템 모니터링 가이드

NestJS 백엔드 애플리케이션의 채팅 큐, Redis, 시스템 메트릭을 실시간으로 모니터링하기 위한 Prometheus + Grafana 스택입니다.

## 📊 시스템 구성

```
┌─────────────────────────────────────────────────────┐
│                   채팅 큐 모니터링                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  NestJS Backend (Port 3000)                          │
│  └─ 메트릭 노출: /internal/health-check-2f4a8b9c    │
│                                                       │
│  Redis (Port 6379)                                   │
│  └─ Redis Exporter (Port 9121)                       │
│                                                       │
│  Node Exporter (Port 9100)                           │
│  └─ 시스템 메트릭 수집                                │
│                                                       │
│  Prometheus (Port 9090) ← localhost only             │
│  └─ 메트릭 수집 및 저장                               │
│                                                       │
│  Grafana (Port 3030) ← localhost only                │
│  └─ 대시보드 시각화                                   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## 🚀 빠른 시작

### 1. Docker Compose로 모니터링 스택 시작

프로젝트 루트 디렉토리에서 실행:

```bash
# 모니터링 스택 시작 (백그라운드)
docker-compose -f docker-compose.monitoring.yml up -d

# 로그 확인
docker-compose -f docker-compose.monitoring.yml logs -f

# 특정 서비스 로그만 보기
docker-compose -f docker-compose.monitoring.yml logs -f grafana
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
```

### 2. 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker ps | grep -E "chat-|prometheus|grafana"

# 예상 출력:
# chat-grafana       grafana/grafana:latest    Up X minutes    127.0.0.1:3030->3000/tcp
# chat-prometheus    prom/prometheus:latest    Up X minutes    127.0.0.1:9090->9090/tcp
# chat-redis-exporter oliver006/redis_exporter Up X minutes   127.0.0.1:9121->9121/tcp
# chat-node-exporter  prom/node-exporter       Up X minutes    127.0.0.1:9100->9100/tcp
```

### 3. 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Prometheus** | http://localhost:9090 | 메트릭 조회 및 쿼리 |
| **Grafana** | http://localhost:3030 | 대시보드 시각화 |
| **Prometheus Targets** | http://localhost:9090/targets | 수집 대상 상태 확인 |
| **백엔드 메트릭** | http://localhost:3000/internal/health-check-2f4a8b9c | Raw 메트릭 데이터 |

### 4. Grafana 로그인

- **사용자명**: `admin`
- **비밀번호**: `admin`
- 초기 로그인 후 비밀번호 변경 권장

## 📈 수집되는 메트릭

### 채팅 큐 메트릭
- `chat_queue_size`: 현재 큐에 대기 중인 메시지 수
- `chat_dlq_size`: Dead Letter Queue 크기
- `chat_messages_processed_total`: 처리된 총 메시지 수
- `chat_messages_failed_total`: 실패한 메시지 수
- `chat_batch_duration_seconds`: 배치 처리 시간
- `chat_consecutive_failures`: 연속 실패 횟수

### Redis 메트릭 (Redis Exporter)
- `redis_connected_clients`: 연결된 클라이언트 수
- `redis_used_memory_bytes`: 사용 중인 메모리
- `redis_commands_processed_total`: 처리된 명령어 수
- `redis_keyspace_hits_total`: 키 조회 성공 수
- `redis_keyspace_misses_total`: 키 조회 실패 수

### 시스템 메트릭 (Node Exporter)
- `node_cpu_seconds_total`: CPU 사용 시간
- `node_memory_MemAvailable_bytes`: 사용 가능한 메모리
- `node_filesystem_avail_bytes`: 디스크 여유 공간
- `node_network_receive_bytes_total`: 네트워크 수신 바이트

### NestJS 애플리케이션 메트릭
- `nodejs_process_cpu_seconds_total`: Node.js CPU 사용 시간
- `nodejs_process_resident_memory_bytes`: 프로세스 메모리 사용량
- `nodejs_eventloop_lag_seconds`: 이벤트 루프 지연
- `nodejs_gc_duration_seconds`: Garbage Collection 시간

## 🎨 대시보드

자동으로 프로비저닝되는 대시보드:

1. **Chat Queue Overview** (`monitoring/grafana/dashboards/chat-queue.json`)
   - 큐 크기, DLQ 크기
   - 메시지 처리 속도
   - 실패율 및 연속 실패 횟수

2. **Redis Overview** (`monitoring/grafana/dashboards/redis-overview.json`)
   - 메모리 사용량
   - 명령어 처리 속도
   - 히트율 (Hit Rate)
   - 연결된 클라이언트 수

3. **Like Queue** (`monitoring/grafana/dashboards/like-queue.json`)
   - 좋아요 큐 전용 모니터링

## 🚨 알림 규칙

`monitoring/prometheus/alerts.yml`에 정의된 주요 알림:

| 알림 | 조건 | 심각도 |
|------|------|--------|
| **HighQueueSize** | 큐 크기 > 500 (5분간) | Warning |
| **CriticalQueueSize** | 큐 크기 > 1000 (2분간) | Critical |
| **HighDLQSize** | DLQ 크기 > 50 (5분간) | Warning |
| **CriticalDLQSize** | DLQ 크기 > 100 (2분간) | Critical |
| **BatchProcessingFailure** | 실패율 > 10% (5분간) | Warning |
| **ConsecutiveFailures** | 연속 실패 > 3회 (1분간) | Critical |
| **SlowProcessing** | 처리 시간 > 5초 (10분간) | Warning |
| **RedisDown** | Redis 서버 다운 (1분간) | Critical |
| **NestJSDown** | NestJS 앱 다운 (1분간) | Critical |
| **HighMemoryUsage** | 메모리 > 1GB (5분간) | Warning |

## 🔍 유용한 Prometheus 쿼리

### 큐 모니터링
```promql
# 현재 큐 크기
chat_queue_size

# 시간당 처리된 메시지 수
rate(chat_messages_processed_total[1h]) * 3600

# 실패율 (%)
(rate(chat_messages_failed_total[5m]) / rate(chat_messages_processed_total[5m])) * 100
```

### Redis 성능
```promql
# Redis 히트율 (%)
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100

# Redis 메모리 사용량 (MB)
redis_used_memory_bytes / 1024 / 1024
```

### 시스템 리소스
```promql
# CPU 사용률 (%)
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 메모리 사용률 (%)
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

## 🛠️ Docker 명령어 가이드

### 시작 및 중지

```bash
# 전체 모니터링 스택 시작
docker-compose -f docker-compose.monitoring.yml up -d

# 전체 모니터링 스택 중지
docker-compose -f docker-compose.monitoring.yml down

# 특정 서비스만 시작
docker-compose -f docker-compose.monitoring.yml up -d prometheus grafana

# 특정 서비스만 재시작
docker-compose -f docker-compose.monitoring.yml restart grafana
```

### 로그 및 디버깅

```bash
# 전체 로그 보기 (실시간)
docker-compose -f docker-compose.monitoring.yml logs -f

# 특정 서비스 로그 보기
docker-compose -f docker-compose.monitoring.yml logs -f prometheus

# 최근 100줄 로그만 보기
docker-compose -f docker-compose.monitoring.yml logs --tail=100 grafana

# 로그 타임스탬프 포함
docker-compose -f docker-compose.monitoring.yml logs -f --timestamps
```

### 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker-compose -f docker-compose.monitoring.yml ps

# 컨테이너 상세 정보
docker-compose -f docker-compose.monitoring.yml ps -a

# 리소스 사용량 실시간 모니터링
docker stats chat-prometheus chat-grafana chat-redis-exporter chat-node-exporter
```

### 데이터 관리

```bash
# 컨테이너 중지 (데이터 보존)
docker-compose -f docker-compose.monitoring.yml down

# 컨테이너 및 볼륨 완전 삭제 (데이터 삭제)
docker-compose -f docker-compose.monitoring.yml down -v

# 볼륨 목록 확인
docker volume ls | grep monitoring

# 특정 볼륨 삭제
docker volume rm my-blog-app_prometheus_data
docker volume rm my-blog-app_grafana_data
```

### 컨테이너 내부 접속

```bash
# Prometheus 컨테이너 접속
docker exec -it chat-prometheus sh

# Grafana 컨테이너 접속
docker exec -it chat-grafana sh

# Redis Exporter 로그 확인
docker logs -f chat-redis-exporter
```

### 설정 변경 후 재시작

```bash
# 1. prometheus.yml 또는 alerts.yml 수정
# 2. Prometheus 설정 다시 로드 (재시작 없이)
curl -X POST http://localhost:9090/-/reload

# 또는 컨테이너 재시작
docker-compose -f docker-compose.monitoring.yml restart prometheus

# Grafana 대시보드 변경 후 재시작
docker-compose -f docker-compose.monitoring.yml restart grafana
```

## 🔧 문제 해결

### Prometheus가 타겟을 수집하지 못하는 경우

1. **타겟 상태 확인**
   ```bash
   # Prometheus Targets 페이지 확인
   open http://localhost:9090/targets
   ```

2. **백엔드가 실행 중인지 확인**
   ```bash
   curl http://localhost:3000/internal/health-check-2f4a8b9c
   ```

3. **Docker 네트워크 확인**
   ```bash
   # Docker 컨테이너가 호스트에 접근할 수 있는지 확인
   docker exec -it chat-prometheus ping host.docker.internal
   ```

### Grafana 대시보드가 보이지 않는 경우

1. **Prometheus 데이터 소스 확인**
   - Grafana → Configuration → Data Sources
   - Prometheus가 "Working" 상태인지 확인

2. **대시보드 수동 Import**
   ```bash
   # Grafana UI에서:
   # Dashboards → Import → Upload JSON file
   # monitoring/grafana/dashboards/*.json 파일 선택
   ```

### Redis Exporter 연결 실패

1. **Redis 실행 확인**
   ```bash
   docker ps | grep redis
   redis-cli ping  # PONG 응답 확인
   ```

2. **Redis Exporter 로그 확인**
   ```bash
   docker logs chat-redis-exporter
   ```

### 포트 충돌 발생 시

현재 포트는 **localhost에만 바인딩**되어 있습니다:
- Prometheus: `127.0.0.1:9090`
- Grafana: `127.0.0.1:3030`

다른 서비스와 충돌하면 `docker-compose.monitoring.yml`에서 포트 변경:
```yaml
ports:
  - "127.0.0.1:새포트:9090"  # Prometheus
  - "127.0.0.1:새포트:3000"  # Grafana
```

## 📚 관련 문서

- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [Grafana 공식 문서](https://grafana.com/docs/)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [PromQL 치트시트](https://promlabs.com/promql-cheat-sheet/)

## 🔗 연관 시스템

이 모니터링 스택은 **my-blog-app 백엔드**를 모니터링합니다.

**MCP Proxy Server 모니터링**은 별도로 구성되어 있습니다:
- 위치: `mcp-proxy-server/docker-compose.monitoring.yml`
- Grafana 포트: 3333
- Prometheus 포트: 9091

두 모니터링 시스템은 독립적으로 실행 가능하며 포트 충돌이 없습니다.

자세한 내용은 프로젝트 루트의 `MONITORING_GUIDE.md`를 참조하세요.
