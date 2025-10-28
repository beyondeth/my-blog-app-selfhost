# Grafana 환경별 포트 가이드

이 문서는 다양한 환경에서 실행되는 Grafana 인스턴스의 포트 구성을 명확하게 정리합니다.

## 📍 포트 체계 요약

| 환경 | 포트 | 컨테이너 이름 | 용도 | 접속 URL |
|------|------|--------------|------|----------|
| **개발 모니터링** | 3033 | `codebase-dev-monitoring-grafana` | 로컬 개발 환경 모니터링 | http://localhost:3033 |
| **VM SSH 터널** | 3030 | (원격 VM) | 실제 프로덕션 서버 모니터링 | http://localhost:3030 |
| **프로덕션 로컬** | 4030 | `codebase-prod-grafana` | 로컬에서 프로덕션 환경 테스트 | http://localhost:4030 |

---

## 🎯 환경별 상세 설명

### 1️⃣ 개발 모니터링 (포트 3033)

**목적**: 로컬 개발 환경의 Backend, MCP Proxy, Redis 메트릭 모니터링

**실행 방법**:
```bash
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml up -d
```

**포함된 서비스**:
- Grafana (3033)
- Prometheus (9090)
- Redis Exporter (9121)

**접속 정보**:
- URL: http://localhost:3033
- 계정: admin / admin
- 데이터소스: Prometheus (http://prometheus:9090)

**컨테이너 목록**:
```bash
codebase-dev-monitoring-grafana
codebase-dev-monitoring-prometheus
codebase-dev-monitoring-redis-exporter
```

**확인 명령어**:
```bash
docker ps --filter "name=dev-monitoring"
```

---

### 2️⃣ VM SSH 터널 (포트 3030)

**목적**: Oracle Cloud VM에서 실행 중인 실제 프로덕션 환경 모니터링

**SSH 터널 설정**:
```bash
# 기본 SSH 터널
ssh -L 3030:localhost:3030 ubuntu@your-vm-ip

# 또는 백그라운드 실행
ssh -f -N -L 3030:localhost:3030 ubuntu@your-vm-ip

# 여러 포트 동시 터널링 (Grafana + Prometheus)
ssh -L 3030:localhost:3030 -L 9090:localhost:9090 ubuntu@your-vm-ip
```

**접속 정보**:
- URL: http://localhost:3030
- 계정: (실제 VM 환경의 계정 정보)
- 데이터소스: VictoriaMetrics (VM 내부)

**주의사항**:
- VM에서 Grafana는 `127.0.0.1:3030`으로만 바인딩되어 있음 (보안)
- 외부 직접 접속 불가, SSH 터널 필수
- 개발 모니터링(3033)과 포트 충돌 없음 ✅

**SSH 터널 종료**:
```bash
# 프로세스 ID 확인
ps aux | grep "ssh.*3030"

# 종료
kill <PID>
```

---

### 3️⃣ 프로덕션 로컬 테스트 (포트 4030)

**목적**: 프로덕션 설정을 로컬 Mac에서 테스트 (VM 배포 전 검증)

**실행 방법**:
```bash
# 프로덕션 설정 + 로컬 오버라이드
docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml up -d
```

**포함된 서비스**:
- Frontend (4001)
- Backend (4000)
- MCP Proxy (4002)
- Grafana (4030) ← 프로덕션 모니터링
- PostgreSQL, Redis, VictoriaMetrics 등

**접속 정보**:
- URL: http://localhost:4030
- 계정: (.env.production 파일에 정의)
- 데이터소스: VictoriaMetrics (http://victoriametrics:8428)

**주의사항**:
- 모든 데이터는 `./data/` 디렉토리에 저장 (VM과 별개)
- VM 데이터베이스와 연동되지 않음 (완전 독립 환경)

---

## 🔄 시나리오별 사용 가이드

### 시나리오 1: 개발 모니터링만 사용
```bash
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml up -d

# 접속
open http://localhost:3033
```

### 시나리오 2: VM 프로덕션 모니터링만 사용
```bash
# SSH 터널 생성
ssh -L 3030:localhost:3030 ubuntu@your-vm-ip

# 접속 (다른 터미널)
open http://localhost:3030
```

### 시나리오 3: 로컬 프로덕션 테스트
```bash
docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml up -d

# 접속
open http://localhost:4030
```

### 시나리오 4: 개발 + VM 동시 모니터링 (권장 ⭐)
```bash
# 터미널 1: 개발 모니터링 실행
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml up -d

# 터미널 2: VM SSH 터널
ssh -L 3030:localhost:3030 ubuntu@your-vm-ip

# 접속
# 개발 환경: http://localhost:3033
# VM 환경: http://localhost:3030
```

**장점**: 포트 충돌 없이 동시 비교 가능! 🎉

---

## 🛠️ 포트 충돌 해결

### 문제: "port is already allocated" 에러 발생 시

**1. 현재 사용 중인 포트 확인**:
```bash
lsof -i :3030
lsof -i :3033
lsof -i :4030
```

**2. 실행 중인 Grafana 컨테이너 확인**:
```bash
docker ps --filter "name=grafana"
```

**3. 충돌 해결 방법**:
```bash
# 개발 모니터링 중지
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml down

# 또는 프로덕션 로컬 중지
docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml down
```

---

## 📊 모니터링 대시보드 구성

### 개발 환경 (3033)
- **Backend Metrics**: NestJS 애플리케이션 메트릭
- **MCP Proxy Metrics**: MCP 서버 성능
- **Redis Metrics**: 캐시 히트율, 메모리 사용량

### 프로덕션 환경 (3030 / 4030)
- **System Overview**: CPU, 메모리, 디스크 사용량
- **Database Metrics**: PostgreSQL 쿼리 성능
- **Application Performance**: PM2 클러스터 메트릭
- **Business Metrics**: 사용자 활동, API 호출량

---

## 🔒 보안 고려사항

### 포트 바인딩
- ✅ 모든 Grafana 인스턴스는 `127.0.0.1`에만 바인딩
- ✅ 외부 네트워크에서 직접 접근 불가
- ✅ VM 프로덕션은 SSH 터널 필수

### 계정 관리
```bash
# 개발 환경: 기본 계정 (admin/admin)
# 프로덕션: 반드시 .env.production에서 강력한 비밀번호 설정

# .env.production 예시
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=your-strong-password-here
```

---

## 🧹 정리 및 재시작

### 개발 모니터링 재시작
```bash
cd monitoring
docker compose -f docker-compose.unified-monitoring.yml down
docker compose -f docker-compose.unified-monitoring.yml up -d
```

### 프로덕션 로컬 재시작
```bash
docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml down
docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml up -d
```

### 모든 모니터링 중지
```bash
# 개발
cd monitoring && docker compose -f docker-compose.unified-monitoring.yml down

# 프로덕션 로컬
cd .. && docker compose -f docker-compose.prod.oracle.yml -f docker-compose.prod.local.yml down

# SSH 터널 종료
kill $(ps aux | grep 'ssh.*3030' | awk '{print $2}')
```

---

## 📝 브라우저 북마크 권장

```
개발 모니터링:    http://localhost:3033 (Grafana Dev)
VM 프로덕션:      http://localhost:3030 (Grafana Prod via SSH)
로컬 프로덕션:    http://localhost:4030 (Grafana Prod Local)
Prometheus:       http://localhost:9090 (Dev Only)
```

---

## ❓ FAQ

### Q1: 개발 환경과 VM 환경을 동시에 모니터링할 수 있나요?
**A**: 네! 포트가 분리되어 있어서 동시 사용 가능합니다.
- 개발: 3033
- VM: 3030

### Q2: 프로덕션 로컬(4030)의 데이터가 VM 데이터베이스와 연동되나요?
**A**: 아닙니다. 완전히 독립된 환경으로 `./data/` 디렉토리에 로컬 데이터를 저장합니다.

### Q3: SSH 터널이 끊어지면 어떻게 되나요?
**A**: 다시 SSH 터널을 생성하면 됩니다. VM의 Grafana는 계속 실행 중입니다.

### Q4: 왜 개발 환경은 3030이 아니라 3033인가요?
**A**: VM SSH 터널과의 포트 충돌을 방지하기 위함입니다. 이제 개발 모니터링과 VM 모니터링을 동시에 열 수 있습니다.

---

**문서 작성일**: 2025-01-28
**마지막 업데이트**: 2025-01-28
