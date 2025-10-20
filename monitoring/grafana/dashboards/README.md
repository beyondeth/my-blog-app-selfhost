# Grafana 대시보드 가이드

## 📊 대시보드 목록

### 01. 전체 시스템 현황
**파일**: `01-전체-시스템-현황.json`

**역할**: 전체 시스템 상태를 한눈에 파악
**주요 메트릭**:
- Backend 서버 상태
- MCP Proxy 서버 상태
- Redis 서버 상태
- Redis 메모리 사용량
- Redis 명령어 처리량 (ops/sec)
- MCP HTTP 요청률 (초당)
- **MCP API Key 검증 (초당)** - API Key 인증 시스템
- Total Redis Keys

**용도**: 시스템 전반적인 Health Check, 장애 발생 시 첫 확인 지점

---

### 02. 채팅 큐 모니터링
**파일**: `02-채팅-큐-모니터링.json`

**역할**: 실시간 채팅 메시지 처리 큐 모니터링
**주요 메트릭**:
- 현재 큐 크기
- Dead Letter Queue 크기
- 메시지 처리율 (초당)
- 배치 처리 시간
- 메시지 대기 시간
- 연속 실패 횟수
- 처리 상태 (성공/실패)
- Redis 연결 상태
- 활성 WebSocket 연결 수

**용도**: 채팅 시스템 지연 감지, 큐 병목 현상 파악

---

### 03. 좋아요 큐 모니터링
**파일**: `03-좋아요-큐-모니터링.json`

**역할**: 좋아요 배치 처리 큐 모니터링
**주요 메트릭**:
- 현재 큐 크기
- Dead Letter Queue 크기
- 좋아요 처리율 (초당)
- 배치 처리 시간
- 좋아요 대기 시간
- 연속 실패 횟수
- 처리 상태 (성공/실패)
- Redis 연결 상태
- 샤드별 큐 크기

**용도**: 좋아요 처리 지연 감지, 배치 처리 최적화

---

### 04. Redis 서버 통계
**파일**: `04-Redis-서버-통계.json`

**역할**: Redis 서버 레벨 통계 및 성능 모니터링
**주요 메트릭**:
- 메모리 사용량 (6GB 제한)
- 전체 키 개수
- 연결된 클라이언트 수
- 명령어 처리량 (ops/sec)
- 네트워크 I/O (bytes/sec)
- 캐시 히트/미스 (ops/sec)
- CPU 사용률
- Slow 쿼리 개수
- Redis 업타임
- Evicted 키 (메모리 부족)
- 만료된 키

**용도**: Redis 서버 Health Check, 메모리 부족 예측, 성능 병목 진단

**참고**: 애플리케이션 레벨 캐시 성능은 `05. 애플리케이션 캐시 성능` 참고

---

### 05. 애플리케이션 캐시 성능
**파일**: `05-애플리케이션-캐시-성능.json`

**역할**: NestJS 애플리케이션 캐시 레이어 성능 모니터링
**주요 메트릭**:
- 포스트 캐시 히트율 (%)
- 댓글 캐시 히트율 (%)
- 캐시 히트/미스 추이
- Cache Stampede 방지 효과
- 캐시 무효화 빈도
- 캐시 재구축 시간 (P95)
- 락 대기 시간 (P99)
- 캐시 누적 통계

**용도**: 캐시 전략 최적화, Cache Stampede 모니터링, 성능 개선

**참고**: Redis 서버 통계는 `04. Redis 서버 통계` 참고

---

### 06. MCP 자동포스팅 API
**파일**: `06-MCP-자동포스팅-API.json`

**역할**: MCP (Model Context Protocol) 자동포스팅 API 모니터링
**인증 방식**: API Key (Stripe 스타일 `blog_sk_{hint}_{secret}`)

**주요 메트릭**:
- **API Key 캐시 히트율 (%)** - 캐시 성능 핵심 지표 (목표: 90% 이상)
- **API Key 검증 시간** - 캐시 히트 (1-3ms) vs 미스 (85-165ms)
- **MCP 도구별 요청 성공/실패율**
  - `check_auth` - 인증 확인
  - `get_writing_style_guide` - 스타일 가이드 조회
  - `create_post` - 포스트 생성
- HTTP 요청률 (초당)
- HTTP 응답 시간 (P50, P95)
- Redis 작업 시간 (P95)
- Redis 연결 상태
- Redis 작업률 (초당)
- 에러 발생률 (에러 타입별)

**용도**: API Key 인증 성능 모니터링, MCP 도구 성공률 추적, 캐시 최적화

**변경 이력**:
- v8.0.0 (2025-01): OAuth 2.1 → API Key 인증으로 전환
- 제거된 메트릭: Transport 세션, OAuth 인증 관련 패널 (6개)

---

## 🚀 사용 가이드

### Grafana 접속
```
http://localhost:3000 (Grafana UI)
ID: admin
PW: (docker-compose.yml 참고)
```

### Prometheus 메트릭 확인
```bash
# MCP Proxy 메트릭
curl http://localhost:3002/metrics

# Backend 메트릭 (NestJS + Prometheus 모듈)
curl http://localhost:3000/metrics
```

### 대시보드 새로고침 주기
- **01-06**: 10초 자동 새로고침
- 실시간 모니터링이 필요한 경우 5초로 변경 가능

---

## 📌 모니터링 체크리스트

### 일일 체크
- [ ] 01. 전체 시스템 현황 - 전체 서버 상태 확인
- [ ] 04. Redis 서버 통계 - 메모리 사용량 (80% 미만 유지)
- [ ] 06. MCP 자동포스팅 API - API Key 캐시 히트율 (90% 이상)

### 성능 이슈 발생 시
1. **01. 전체 시스템 현황** - 어느 서버에서 문제가 발생했는지 확인
2. **해당 서비스 대시보드** - 상세 메트릭 확인
3. **04. Redis 서버 통계** - Redis가 병목인지 확인
4. **05. 애플리케이션 캐시 성능** - 캐시 히트율 확인

### 장애 발생 시
1. **Redis 연결 끊김**: 모든 대시보드의 "Redis 연결 상태" 확인
2. **큐 쌓임**: 02/03 대시보드의 큐 크기, DLQ 크기 확인
3. **MCP API 실패**: 06 대시보드의 에러 타입별 분포 확인

---

## 🔧 유지보수

### 대시보드 업데이트
```bash
# Grafana 재시작 (변경사항 적용)
docker-compose -f monitoring/docker-compose.unified-monitoring.yml restart grafana
```

### 메트릭 추가 시
1. Backend/MCP Proxy에 Prometheus 메트릭 추가
2. 해당 대시보드 JSON 파일 수정
3. Grafana UI에서 Import하거나 재시작

---

## 📚 참고 문서
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard JSON 구조](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/)
- [MCP Protocol Spec](https://github.com/anthropics/mcp)

---

**마지막 업데이트**: 2025-10-19
**버전**: v2.0 (OAuth → API Key 전환)
