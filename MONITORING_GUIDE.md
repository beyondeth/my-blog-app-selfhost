# 통합 모니터링 시스템 가이드

my-blog-app 프로젝트의 전체 모니터링 시스템 구조와 운영 가이드입니다.

## 📊 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        my-blog-app 프로젝트                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐    │
│  │   백엔드 모니터링 (3000)   │    │  MCP 프록시 모니터링 (3002)   │    │
│  ├───────────────────────────┤    ├───────────────────────────────┤    │
│  │                           │    │                               │    │
│  │  NestJS Backend           │    │  MCP Proxy Server             │    │
│  │  ├─ 채팅 큐 시스템         │    │  ├─ OAuth 인증                │    │
│  │  ├─ Redis                 │    │  ├─ 세션 관리                 │    │
│  │  └─ Socket.IO             │    │  ├─ Transport 관리            │    │
│  │                           │    │  └─ 블로그 포스팅 API         │    │
│  │  메트릭 엔드포인트:        │    │                               │    │
│  │  /internal/health-check-  │    │  메트릭 엔드포인트:           │    │
│  │  2f4a8b9c                 │    │  /metrics                     │    │
│  │                           │    │                               │    │
│  └───────────┬───────────────┘    └───────────┬───────────────────┘    │
│              │                                 │                        │
│              ▼                                 ▼                        │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐    │
│  │  Prometheus (Port 9090)   │    │  Prometheus (Port 9091)       │    │
│  │  - localhost 바인딩        │    │  - 외부 접근 가능              │    │
│  │  - 채팅 큐 메트릭          │    │  - MCP 메트릭                 │    │
│  │  - Redis 메트릭            │    │  - HTTP 메트릭                │    │
│  │  - 시스템 메트릭           │    │  - 세션 메트릭                │    │
│  └───────────┬───────────────┘    └───────────┬───────────────────┘    │
│              │                                 │                        │
│              ▼                                 ▼                        │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐    │
│  │  Grafana (Port 3030)      │    │  Grafana (Port 3333)          │    │
│  │  - localhost 바인딩        │    │  - 외부 접근 가능              │    │
│  │  - 채팅 큐 대시보드        │    │  - MCP 대시보드               │    │
│  │  - Redis 대시보드          │    │  - HTTP 성능                  │    │
│  └───────────────────────────┘    └───────────────────────────────┘    │
│                                                                           │
│  공유 리소스:                                                             │
│  └─ Redis (Port 6379) - 단일 인스턴스                                    │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🎯 두 모니터링 시스템의 역할

### 1. 백엔드 모니터링 (my-blog-app)

**위치**: `monitoring/` 디렉토리
**목적**: NestJS 백엔드 애플리케이션의 채팅 큐, Redis, 시스템 리소스 모니터링

#### 모니터링 대상
- ✅ 채팅 큐 시스템 (메시지 처리, DLQ)
- ✅ Redis 성능 (명령어, 메모리, 히트율)
- ✅ Node.js 프로세스 (CPU, 메모리, GC)
- ✅ 시스템 리소스 (CPU, 메모리, 디스크, 네트워크)

#### 포트 구성
| 서비스 | 포트 | 접근 |
|--------|------|------|
| Prometheus | 9090 | localhost만 |
| Grafana | 3030 | localhost만 |
| Redis Exporter | 9121 | localhost만 |
| Node Exporter | 9100 | localhost만 |

#### 주요 대시보드
- **Chat Queue Overview**: 큐 크기, 처리 속도, 실패율
- **Redis Overview**: 메모리, 명령어 처리, 연결 상태
- **Like Queue**: 좋아요 큐 전용 모니터링

### 2. MCP 프록시 모니터링 (mcp-proxy-server)

**위치**: `mcp-proxy-server/` 디렉토리
**목적**: MCP Proxy Server의 HTTP 성능, 세션 관리, OAuth 인증 모니터링

#### 모니터링 대상
- ✅ HTTP 요청/응답 (처리 시간, 상태 코드)
- ✅ 세션 관리 (활성 세션, 생성/삭제)
- ✅ Transport 생성/실패
- ✅ Redis 작업 (세션 저장/조회)
- ✅ OAuth 인증 시도
- ✅ 에러 추적

#### 포트 구성
| 서비스 | 포트 | 접근 |
|--------|------|------|
| Prometheus | 9091 | 외부 접근 가능 |
| Grafana | 3333 | 외부 접근 가능 |

#### 주요 대시보드
- **MCP Proxy Server 모니터링**: HTTP 성능, 세션 상태, Redis 작업, 에러율

## 🚀 빠른 시작 가이드

### 시나리오 1: 전체 시스템 모니터링 (권장)

두 모니터링 스택을 동시에 실행하여 전체 시스템을 모니터링합니다.

```bash
# 1. 프로젝트 루트로 이동
cd /path/to/my-blog-app

# 2. 백엔드 모니터링 시작
docker-compose -f docker-compose.monitoring.yml up -d

# 3. MCP 프록시 모니터링 시작
cd mcp-proxy-server
docker-compose -f docker-compose.monitoring.yml up -d

# 4. 모든 컨테이너 확인
docker ps | grep -E "prometheus|grafana"

# 예상 출력:
# mcp-grafana         포트 3333
# mcp-prometheus      포트 9091
# chat-grafana        포트 3030
# chat-prometheus     포트 9090
```

#### 접속 URL
- **백엔드 Grafana**: http://localhost:3030 (admin/admin)
- **백엔드 Prometheus**: http://localhost:9090
- **MCP Grafana**: http://localhost:3333 (admin/admin123)
- **MCP Prometheus**: http://localhost:9091

### 시나리오 2: 백엔드만 모니터링

채팅 큐와 Redis만 모니터링이 필요한 경우:

```bash
# 프로젝트 루트에서
docker-compose -f docker-compose.monitoring.yml up -d

# 접속
open http://localhost:3030  # Grafana
```

### 시나리오 3: MCP 프록시만 모니터링

MCP 서버의 성능과 세션만 모니터링이 필요한 경우:

```bash
# mcp-proxy-server 디렉토리에서
cd mcp-proxy-server
docker-compose -f docker-compose.monitoring.yml up -d

# 접속
open http://localhost:3333  # Grafana
```

## 🔧 Docker 운영 명령어

### 시작 및 중지

```bash
# ============================================
# 백엔드 모니터링
# ============================================

# 시작
docker-compose -f docker-compose.monitoring.yml up -d

# 중지 (데이터 보존)
docker-compose -f docker-compose.monitoring.yml down

# 중지 + 데이터 삭제
docker-compose -f docker-compose.monitoring.yml down -v

# 재시작
docker-compose -f docker-compose.monitoring.yml restart

# ============================================
# MCP 프록시 모니터링
# ============================================

cd mcp-proxy-server

# 시작
docker-compose -f docker-compose.monitoring.yml up -d

# 중지
docker-compose -f docker-compose.monitoring.yml down

# 중지 + 데이터 삭제
docker-compose -f docker-compose.monitoring.yml down -v
```

### 로그 확인

```bash
# ============================================
# 백엔드 모니터링 로그
# ============================================

# 전체 로그 (실시간)
docker-compose -f docker-compose.monitoring.yml logs -f

# 특정 서비스만
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana

# 최근 100줄만
docker-compose -f docker-compose.monitoring.yml logs --tail=100 prometheus

# ============================================
# MCP 프록시 모니터링 로그
# ============================================

cd mcp-proxy-server

# 전체 로그
docker-compose -f docker-compose.monitoring.yml logs -f

# 특정 서비스만
docker-compose -f docker-compose.monitoring.yml logs -f mcp-prometheus
docker-compose -f docker-compose.monitoring.yml logs -f mcp-grafana
```

### 상태 확인

```bash
# ============================================
# 모든 모니터링 컨테이너 확인
# ============================================

docker ps | grep -E "prometheus|grafana|exporter"

# 상세 정보
docker-compose -f docker-compose.monitoring.yml ps -a

# 리소스 사용량 실시간 모니터링
docker stats

# ============================================
# 개별 컨테이너 확인
# ============================================

# 백엔드 모니터링
docker ps | grep chat-

# MCP 프록시 모니터링
docker ps | grep mcp-

# Redis (공유)
docker ps | grep redis
```

### 데이터 관리

```bash
# ============================================
# 볼륨 확인
# ============================================

docker volume ls

# ============================================
# 백엔드 모니터링 볼륨
# ============================================

# 볼륨 목록
docker volume ls | grep -E "prometheus_data|grafana_data"

# 볼륨 삭제 (주의: 모든 대시보드와 메트릭 데이터 삭제됨)
docker volume rm my-blog-app_prometheus_data
docker volume rm my-blog-app_grafana_data

# ============================================
# MCP 프록시 모니터링 볼륨
# ============================================

# 볼륨 삭제
docker volume rm mcp-proxy-server_prometheus-data
docker volume rm mcp-proxy-server_grafana-data
```

### 설정 변경 후 재시작

```bash
# ============================================
# Prometheus 설정 다시 로드 (재시작 불필요)
# ============================================

# 백엔드 Prometheus
curl -X POST http://localhost:9090/-/reload

# MCP 프록시 Prometheus
curl -X POST http://localhost:9091/-/reload

# ============================================
# 컨테이너 재시작
# ============================================

# 백엔드 모니터링
docker-compose -f docker-compose.monitoring.yml restart prometheus
docker-compose -f docker-compose.monitoring.yml restart grafana

# MCP 프록시 모니터링
cd mcp-proxy-server
docker-compose -f docker-compose.monitoring.yml restart prometheus
docker-compose -f docker-compose.monitoring.yml restart grafana
```

## 📋 포트 전체 정리

### 애플리케이션 포트
| 서비스 | 포트 | 설명 |
|--------|------|------|
| Frontend (Next.js) | 3001 | 프론트엔드 웹 서버 |
| Backend (NestJS) | 3000 | 백엔드 API 서버 |
| MCP Proxy Server | 3002 | MCP 프록시 서버 |
| Redis | 6379 | 캐시/세션 저장소 |

### 백엔드 모니터링 포트
| 서비스 | 포트 | 접근 | 설명 |
|--------|------|------|------|
| Prometheus | 9090 | localhost | 메트릭 수집 서버 |
| Grafana | 3030 | localhost | 대시보드 |
| Redis Exporter | 9121 | localhost | Redis 메트릭 |
| Node Exporter | 9100 | localhost | 시스템 메트릭 |

### MCP 프록시 모니터링 포트
| 서비스 | 포트 | 접근 | 설명 |
|--------|------|------|------|
| Prometheus | 9091 | 외부 | 메트릭 수집 서버 |
| Grafana | 3333 | 외부 | 대시보드 |

### ✅ 포트 충돌 없음

두 모니터링 시스템은 완전히 독립적인 포트를 사용하므로 **동시 실행 가능**합니다:
- Prometheus: 9090 (백엔드) vs 9091 (MCP)
- Grafana: 3030 (백엔드) vs 3333 (MCP)

## 🔍 문제 해결

### 1. 메트릭 수집이 안 되는 경우

#### 백엔드 메트릭 확인
```bash
# 1. 백엔드가 실행 중인지 확인
curl http://localhost:3000/internal/health-check-2f4a8b9c

# 2. Prometheus Targets 상태 확인
open http://localhost:9090/targets

# 3. 컨테이너 로그 확인
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

#### MCP 프록시 메트릭 확인
```bash
# 1. MCP 프록시가 실행 중인지 확인
curl http://localhost:3002/metrics

# 2. Prometheus Targets 상태 확인
open http://localhost:9091/targets

# 3. 컨테이너 로그 확인
cd mcp-proxy-server
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

### 2. Grafana 대시보드가 보이지 않는 경우

```bash
# 1. Prometheus 데이터 소스 확인
# Grafana UI → Configuration → Data Sources
# Prometheus가 "Working" 상태인지 확인

# 2. 대시보드 수동 Import
# Grafana UI → Dashboards → Import → Upload JSON file

# 백엔드 대시보드 위치:
# - monitoring/grafana/dashboards/chat-queue.json
# - monitoring/grafana/dashboards/redis-overview.json

# MCP 프록시 대시보드 위치:
# - mcp-proxy-server/grafana/provisioning/dashboards/mcp-proxy-dashboard.json
```

### 3. Docker 네트워크 문제

```bash
# 네트워크 확인
docker network ls

# 백엔드 모니터링 네트워크
docker network inspect my-blog-app_monitoring

# MCP 프록시 모니터링 네트워크
docker network inspect mcp-proxy-server_monitoring

# 호스트 접근 테스트 (Mac/Windows)
docker exec -it chat-prometheus ping host.docker.internal

# Linux의 경우 host.docker.internal 대신 호스트 IP 사용 필요
```

### 4. 포트가 이미 사용 중인 경우

```bash
# 포트 사용 중인 프로세스 확인
lsof -i :9090  # 백엔드 Prometheus
lsof -i :3030  # 백엔드 Grafana
lsof -i :9091  # MCP Prometheus
lsof -i :3333  # MCP Grafana

# 프로세스 종료
kill -9 <PID>
```

## 📚 상세 문서

더 자세한 내용은 각 시스템의 개별 문서를 참조하세요:

### 백엔드 모니터링
- **위치**: `monitoring/README.md`
- **내용**:
  - 채팅 큐 메트릭 상세
  - Redis 메트릭 상세
  - 알림 규칙 설정
  - PromQL 쿼리 예시

### MCP 프록시 모니터링
- **위치**: `mcp-proxy-server/MONITORING.md`
- **내용**:
  - MCP 프록시 메트릭 상세
  - HTTP 성능 측정
  - 세션 관리 모니터링
  - 알림 설정 예시

## 🎓 모니터링 베스트 프랙티스

### 1. 개발 환경
- **백엔드 모니터링만 실행** (리소스 절약)
- 채팅 큐와 Redis 성능 확인

### 2. 스테이징/프로덕션 환경
- **두 모니터링 시스템 모두 실행** (전체 시스템 가시성)
- 알림 규칙 활성화
- 정기적인 대시보드 리뷰

### 3. 성능 튜닝 시
- **두 모니터링 시스템 모두 실행**
- Prometheus 쿼리로 병목 지점 식별
- Grafana 대시보드로 트렌드 분석

### 4. 디버깅 시
- 해당 서비스의 모니터링만 실행
- 로그와 메트릭을 함께 분석
- 타임스탬프 기반 상관관계 파악

## 🛡️ 보안 고려사항

### localhost 바인딩 (백엔드 모니터링)
```yaml
ports:
  - "127.0.0.1:9090:9090"  # localhost만 접근 가능
```
- ✅ 외부 네트워크에서 접근 불가
- ✅ 로컬 개발 환경에 적합

### 외부 접근 (MCP 프록시 모니터링)
```yaml
ports:
  - "9091:9090"  # 외부 접근 가능
```
- ⚠️ 프로덕션에서는 방화벽 설정 필요
- ⚠️ Grafana 비밀번호 변경 필수

## 📊 모니터링 체크리스트

### 매일 확인할 항목
- [ ] 활성 세션 수 (MCP)
- [ ] 큐 크기 (백엔드)
- [ ] 에러율 (둘 다)
- [ ] 응답 시간 (둘 다)

### 매주 확인할 항목
- [ ] Redis 메모리 사용량
- [ ] 시스템 리소스 사용 추세
- [ ] 디스크 여유 공간
- [ ] 대시보드 설정 백업

### 매월 확인할 항목
- [ ] 알림 규칙 검토 및 조정
- [ ] 불필요한 메트릭 정리
- [ ] Prometheus 데이터 보관 기간 검토
- [ ] Grafana 플러그인 업데이트

## 🔗 참고 자료

- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [Grafana 공식 문서](https://grafana.com/docs/)
- [PromQL 치트시트](https://promlabs.com/promql-cheat-sheet/)
- [Docker Compose 공식 문서](https://docs.docker.com/compose/)

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-01-10
**작성자**: my-blog-app 팀
