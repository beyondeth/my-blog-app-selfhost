# 📊 메트릭 모니터링 보안 가이드

## 🔒 보안 구현 완료 사항

### 1. 다층 보안 아키텍처

우리 시스템은 **3단계 보안 레이어**를 구현했습니다:

```
사용자 요청
    ↓
[레이어 1: 경로 은닉]
    /metrics → 404 (숨김)
    ↓
[레이어 2: IP 제한]
    숨겨진 경로 → localhost만 허용
    ↓
[레이어 3: 권한 검증]
    Admin API → JWT + ADMIN 역할 필요
```

### 2. 구현된 보안 조치

#### 🚫 메트릭 엔드포인트 은닉
```
❌ /metrics → 404 Not Found (모든 사용자)
✅ /internal/health-check-2f4a8b9c → Prometheus 메트릭 (localhost만)
```

- **이유**: `/metrics`는 누구나 예상할 수 있는 표준 경로
- **해결**: 예측 불가능한 경로 사용 + 환경 변수로 관리

#### 🌐 IP 기반 접근 제어
```typescript
// backend/src/common/guards/jwt-auth.guard.ts
const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
if (!allowedIps.includes(clientIp)) {
    return 404; // 존재하지 않는 것처럼 보이기
}
```

#### 👤 Admin 전용 대시보드
```
GET /api/v1/admin/monitoring/dashboard - JSON 형식 메트릭
GET /api/v1/admin/monitoring/raw - Prometheus 원본 메트릭
```

- JWT 인증 필수
- ADMIN 역할 필수
- 브라우저에서 편하게 확인 가능

#### 🐳 Docker 로컬 바인딩
```yaml
# docker-compose.monitoring.yml
ports:
  - "127.0.0.1:9090:9090"  # Prometheus
  - "127.0.0.1:3030:3000"  # Grafana
  - "127.0.0.1:9121:9121"  # Redis Exporter
  - "127.0.0.1:9100:9100"  # Node Exporter
```

**효과**: 외부 네트워크에서 포트 자체에 접근 불가

### 3. 환경 변수 설정

```bash
# backend/.env
METRICS_PATH=/internal/health-check-2f4a8b9c  # 숨겨진 경로
METRICS_ALLOWED_IPS=127.0.0.1,::1,::ffff:127.0.0.1,localhost
```

### 4. 보안 테스트 방법

#### 자동 테스트
```bash
# 보안 테스트 스크립트 실행
./test-metrics-security.sh
```

#### 수동 테스트
```bash
# 1. 기존 /metrics 경로 (404 예상)
curl http://localhost:3000/metrics

# 2. 숨겨진 메트릭 경로 (200 OK)
curl http://localhost:3000/internal/health-check-2f4a8b9c

# 3. Admin 대시보드 (인증 필요)
curl http://localhost:3000/api/v1/admin/monitoring/dashboard
```

### 5. 접근 권한 매트릭스

| 엔드포인트 | 일반 사용자 | Admin | Prometheus | 비고 |
|-----------|------------|-------|------------|------|
| `/metrics` | ❌ 404 | ❌ 404 | ❌ 404 | 완전 숨김 |
| `/internal/health-check-*` | ❌ 404 | ✅ (localhost) | ✅ (localhost) | IP 제한 |
| `/api/v1/admin/monitoring/dashboard` | ❌ 401/403 | ✅ | ❌ | Admin 전용 |
| `localhost:9090` (Prometheus) | ❌ | ✅ (직접) | - | 로컬만 |
| `localhost:3030` (Grafana) | ❌ | ✅ (직접) | - | 로컬만 |

### 6. 모니터링 서비스 사용법

#### Grafana 접속
```
URL: http://localhost:3030
ID: admin
PW: admin
```

#### Prometheus 쿼리
```
URL: http://localhost:9090

유용한 쿼리:
- chat_queue_size: 현재 큐 크기
- chat_messages_processed_total: 처리된 메시지 총 개수
- chat_redis_connection_status: Redis 연결 상태
- up{job="nestjs-chat-app"}: NestJS 앱 상태
```

#### Admin 대시보드
```javascript
// Admin 로그인 후
fetch('/api/v1/admin/monitoring/dashboard', {
  credentials: 'include'
}).then(res => res.json());
```

### 7. 보안 체크리스트

- [x] `/metrics` 경로 404 반환
- [x] 실제 메트릭 경로 환경 변수화
- [x] IP 기반 접근 제한
- [x] Admin 전용 엔드포인트 구현
- [x] Docker 포트 localhost 바인딩
- [x] JWT + Role 기반 인증
- [x] 에러 메시지에서 정보 노출 방지

### 8. 주의사항

1. **환경 변수 관리**: `METRICS_PATH`는 절대 공개 저장소에 커밋하지 마세요
2. **프로덕션 배포**: 실제 서버 IP를 `METRICS_ALLOWED_IPS`에 추가 필요
3. **Grafana 비밀번호**: 프로덕션에서는 반드시 변경
4. **리버스 프록시**: 프로덕션에서는 nginx 등으로 추가 보안 레이어 추가 권장

### 9. 문제 해결

#### Prometheus가 메트릭을 수집 못함
```bash
# 1. 숨겨진 경로 확인
grep METRICS_PATH backend/.env

# 2. Prometheus 설정 확인
cat monitoring/prometheus/prometheus.yml | grep metrics_path

# 3. IP 허용 목록 확인
grep METRICS_ALLOWED_IPS backend/.env
```

#### Docker 포트 접근 안 됨
```bash
# 포트 바인딩 확인
docker ps --format "table {{.Names}}\t{{.Ports}}"

# 127.0.0.1:포트 형태로 바인딩되어 있는지 확인
```

### 10. 요약

✅ **달성한 보안 목표:**
- 예측 가능한 경로(`/metrics`) 완전 차단
- 시도조차 못하게 404로 숨김 처리
- 로컬에서만 모니터링 서비스 접근 가능
- Admin만 브라우저에서 메트릭 확인 가능
- 다층 보안으로 defense in depth 구현

이제 누군가 `/metrics`에 접근하려 해도 404를 받게 되어 엔드포인트가 존재한다는 사실조차 알 수 없습니다! 🔒