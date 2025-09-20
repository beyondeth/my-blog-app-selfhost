# 📊 채팅 큐 모니터링 시스템 상태

## ✅ 문제 해결 완료

### 해결된 이슈들:
1. **BullMQ Worker Redis 연결 오류**
   - 원인: BullModule.forRoot() 설정 누락
   - 해결: app.module.ts에 Redis 연결 설정 추가

2. **Prometheus "NestJSDown" 알람**
   - 원인: /metrics 엔드포인트가 404 반환
   - 근본 원인:
     - 전역 JwtAuthGuard가 /metrics 차단
     - 전역 API prefix가 /metrics를 /api/v1/metrics로 변경
   - 해결:
     - JwtAuthGuard에 /metrics 예외 처리 추가
     - main.ts의 setGlobalPrefix exclude에 '/metrics' 추가

## 🚀 모니터링 시스템 접속 정보

### 주요 URL
- **Prometheus**: http://localhost:9090
  - Targets 상태: http://localhost:9090/targets
  - Alerts: http://localhost:9090/alerts

- **Grafana**: http://localhost:3030
  - 계정: admin / admin
  - Dashboard: Chat Queue Monitoring

- **NestJS Metrics**: http://localhost:3000/metrics

## 📈 수집 중인 메트릭

### 채팅 큐 메트릭
- `chat_queue_size`: 메인 큐 크기
- `chat_dlq_size`: Dead Letter Queue 크기
- `chat_messages_processed_total`: 처리된 메시지 총 개수
- `chat_messages_failed_total`: 실패한 메시지 총 개수
- `chat_message_latency_seconds`: 메시지 처리 지연 시간
- `chat_batch_duration_seconds`: 배치 처리 시간
- `chat_consecutive_failures`: 연속 실패 횟수
- `chat_processing_status`: 현재 처리 상태 (0: idle, 1: processing)
- `chat_redis_connection_status`: Redis 연결 상태
- `chat_websocket_connections_active`: 활성 WebSocket 연결 수

### 시스템 메트릭
- Node.js 프로세스 메트릭 (CPU, 메모리, 이벤트 루프)
- HTTP 요청/응답 메트릭
- Redis 메트릭 (redis-exporter 통해)
- 시스템 메트릭 (node-exporter 통해)

## 🛠️ 모니터링 시작/종료

### 시작
```bash
# 자동 스크립트 사용
./start-monitoring.sh

# 또는 수동으로
docker-compose -f docker-compose.monitoring.yml up -d
```

### 종료
```bash
docker-compose -f docker-compose.monitoring.yml down
```

### 로그 확인
```bash
docker-compose -f docker-compose.monitoring.yml logs -f
```

## 📊 대시보드 주요 패널

1. **Queue Overview**
   - 실시간 큐 크기
   - DLQ 크기
   - 처리 속도

2. **Performance Metrics**
   - 메시지 처리 지연 시간
   - 배치 처리 시간
   - 처리량 (messages/sec)

3. **Error Tracking**
   - 실패율
   - 연속 실패 카운터
   - 에러 타입별 분포

4. **System Health**
   - Redis 연결 상태
   - WebSocket 연결 수
   - Node.js 메모리/CPU 사용률

## 🔔 설정된 알람

- **HighQueueSize**: 큐 크기 > 500 (5분 지속)
- **HighDLQSize**: DLQ 크기 > 100 (5분 지속)
- **HighFailureRate**: 실패율 > 10% (10분 지속)
- **ConsecutiveFailures**: 연속 실패 > 5회
- **NestJSDown**: NestJS 앱 다운
- **RedisDown**: Redis 연결 끊김

## ✨ 테스트 방법

### 메트릭 생성 테스트
```bash
# 채팅 메시지 보내기 (프론트엔드에서)
# 또는 curl로 직접 API 호출

# 메트릭 확인
curl http://localhost:3000/metrics | grep chat_

# Prometheus에서 쿼리
# http://localhost:9090 접속 후 쿼리:
# chat_messages_processed_total
# rate(chat_messages_processed_total[5m])
```

## 🎯 다음 단계 (선택사항)

1. **알람 알림 설정**
   - Slack, Email, PagerDuty 등과 연동
   - Alertmanager 설정

2. **장기 데이터 보관**
   - Prometheus 데이터 보관 기간 설정
   - 외부 스토리지 연동 (예: Thanos)

3. **추가 메트릭**
   - 사용자별 메시지 통계
   - 채널별 활동 메트릭
   - 응답 시간 분포

4. **자동 스케일링**
   - 메트릭 기반 자동 스케일링 정책
   - Kubernetes HPA 연동