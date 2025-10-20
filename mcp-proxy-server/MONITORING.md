# MCP Proxy Server 모니터링 가이드

Prometheus + Grafana를 사용한 실시간 모니터링 시스템 설정 가이드입니다.

## 📊 시스템 구성

- **Prometheus**: 메트릭 수집 및 저장
- **Grafana**: 메트릭 시각화 대시보드
- **MCP Proxy Server**: 메트릭 노출 (`GET /metrics`)

## 🚀 빠른 시작

### 1. Docker Compose로 모니터링 스택 시작

```bash
# Prometheus + Grafana 시작
docker-compose -f docker-compose.monitoring.yml up -d

# 로그 확인
docker-compose -f docker-compose.monitoring.yml logs -f
```

### 2. MCP Proxy Server 시작

```bash
# 서버 시작 (메트릭이 /metrics에 노출됨)
pnpm start
```

### 3. 접속 URL

- **Prometheus**: http://localhost:9091
  - Targets 확인: http://localhost:9091/targets
  - 메트릭 쿼리: http://localhost:9091/graph

- **Grafana**: http://localhost:3333
  - 초기 로그인: `admin` / `admin123`
  - 대시보드: "MCP Proxy Server 모니터링" 자동 생성됨

- **MCP Metrics**: http://localhost:3002/metrics
  - Prometheus 형식의 raw 메트릭

## 📈 수집되는 메트릭

### HTTP 메트릭
- `mcp_http_requests_total`: 총 HTTP 요청 수 (method, path, status_code별)
- `mcp_http_request_duration_seconds`: HTTP 요청 처리 시간 (히스토그램)
- `mcp_http_request_size_bytes`: HTTP 요청 크기
- `mcp_http_response_size_bytes`: HTTP 응답 크기

### 세션 메트릭
- `mcp_sessions_active`: 현재 활성 세션 수
- `mcp_sessions_created_total`: 생성된 총 세션 수
- `mcp_sessions_deleted_total`: 삭제된 총 세션 수 (reason: manual/timeout)
- `mcp_session_lifetime_seconds`: 세션 수명 (히스토그램)
- `mcp_sessions_peak`: 최대 동시 세션 수
- `mcp_sessions_average_lifetime_seconds`: 평균 세션 수명

### Transport 메트릭
- `mcp_transports_created_total`: 생성된 총 Transport 수
- `mcp_transports_creation_failed_total`: Transport 생성 실패 수 (reason별)

### Redis 메트릭
- `mcp_redis_operations_total`: Redis 작업 총 개수 (operation, status별)
- `mcp_redis_operation_duration_seconds`: Redis 작업 처리 시간
- `mcp_redis_connected`: Redis 연결 상태 (1=연결됨, 0=끊김)

### 에러 메트릭
- `mcp_errors_total`: 총 에러 수 (error_code, status_code별)
- `mcp_rate_limit_exceeded_total`: Rate Limit 초과 횟수

### 시스템 메트릭 (자동 수집)
- `mcp_process_cpu_seconds_total`: CPU 사용 시간
- `mcp_process_resident_memory_bytes`: 메모리 사용량
- `mcp_nodejs_eventloop_lag_seconds`: Node.js 이벤트 루프 지연
- `mcp_nodejs_gc_duration_seconds`: GC 지속 시간

## 🎨 Grafana 대시보드

자동으로 생성되는 대시보드에는 다음 패널들이 포함됩니다:

1. **활성 세션 수** (Gauge)
2. **HTTP 요청률** (초당 요청 수)
3. **HTTP 응답 시간** (P50, P95 백분위수)
4. **Redis 작업 시간** (P95)
5. **Redis 연결 상태** (Connected/Disconnected)
6. **Redis 작업률** (성공/실패별)
7. **에러 발생률** (에러 코드별)

## 🔍 유용한 Prometheus 쿼리

### HTTP 성능
```promql
# 초당 요청 수
rate(mcp_http_requests_total[5m])

# P95 응답 시간
histogram_quantile(0.95, rate(mcp_http_request_duration_seconds_bucket[5m]))

# 에러율 (4xx, 5xx)
sum(rate(mcp_http_requests_total{status_code=~"[45].."}[5m])) / sum(rate(mcp_http_requests_total[5m]))
```

### 세션 관리
```promql
# 현재 활성 세션
mcp_sessions_active

# 세션 생성률 (초당)
rate(mcp_sessions_created_total[5m])

# 평균 세션 수명
mcp_sessions_average_lifetime_seconds
```

### Redis 성능
```promql
# Redis 작업 성공률
rate(mcp_redis_operations_total{status="success"}[5m]) / rate(mcp_redis_operations_total[5m])

# Redis 작업별 처리 시간 (P95)
histogram_quantile(0.95, rate(mcp_redis_operation_duration_seconds_bucket[5m]))
```

### 에러 분석
```promql
# 에러 발생률 (초당)
rate(mcp_errors_total[5m])

# 에러 코드별 집계
sum by (error_code) (rate(mcp_errors_total[5m]))
```

## 🚨 알림 설정 (선택사항)

Prometheus Alert Rules 예시 (`alert.rules.yml`):

```yaml
groups:
  - name: mcp_proxy_alerts
    interval: 30s
    rules:
      # 높은 에러율
      - alert: HighErrorRate
        expr: rate(mcp_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 에러 발생률"
          description: "초당 {{ $value }}개의 에러 발생 중"

      # Redis 연결 끊김
      - alert: RedisDisconnected
        expr: mcp_redis_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis 연결 끊김"
          description: "Redis 서버와의 연결이 끊어졌습니다"

      # 높은 응답 시간
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(mcp_http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 응답 시간"
          description: "P95 응답 시간이 {{ $value }}초입니다"

      # 세션 수 임계치
      - alert: HighSessionCount
        expr: mcp_sessions_active > 900
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 세션 수"
          description: "활성 세션 수가 {{ $value }}개입니다 (최대: 1000)"
```

## 🛠️ 문제 해결

### Prometheus가 메트릭을 수집하지 못하는 경우

1. MCP Proxy Server가 실행 중인지 확인
   ```bash
   curl http://localhost:3002/metrics
   ```

2. Prometheus Targets 상태 확인
   ```bash
   # http://localhost:9090/targets
   # mcp-proxy-server의 State가 "UP"이어야 함
   ```

3. Docker에서 호스트 접근 확인
   ```bash
   # Mac/Windows: host.docker.internal
   # Linux: 호스트 IP 또는 --network host 사용
   ```

### Grafana 대시보드가 보이지 않는 경우

1. Prometheus 데이터 소스 확인
   - Grafana > Configuration > Data Sources
   - Prometheus가 "Working" 상태인지 확인

2. 대시보드 수동 import
   - Dashboards > Import
   - `grafana/provisioning/dashboards/mcp-proxy-dashboard.json` 파일 업로드

## 🗑️ 정리

```bash
# 모니터링 스택 중지 및 삭제
docker-compose -f docker-compose.monitoring.yml down

# 데이터까지 완전 삭제
docker-compose -f docker-compose.monitoring.yml down -v
```

## 📚 참고 자료

- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [Grafana 공식 문서](https://grafana.com/docs/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [PromQL 치트시트](https://promlabs.com/promql-cheat-sheet/)
