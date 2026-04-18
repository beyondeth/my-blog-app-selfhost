# Codebase Monitoring

이 문서는 **현재 프로덕션에서 실제로 동작하는 모니터링 흐름**만 설명합니다.
예전 Prometheus/Node Exporter 중심 설명이나 로컬 실험용 자산은 별도 legacy로 취급합니다.

## 프로덕션 데이터 흐름

1. `backend`
   - hidden metrics path `/internal/health-check-2f4a8b9c`
2. `mcp-proxy`
   - `/metrics`
3. `redis` exporters
   - `redis-core-exporter:9121`
   - `redis-cache-exporter:9121`
4. `victoriametrics`
   - 위 메트릭을 수집
   - `victoriametrics/alerts.yml`의 **core service rules**만 평가
5. `grafana`
   - VictoriaMetrics를 데이터소스로 읽음
   - `grafana/provisioning/alerting/`의 rule / contact point / notification policy를 사용
   - 즉시 Telegram 알림 발송
6. `GitHub Actions`
   - `daily-production-monitoring.yml`가 매일 09:00 KST에 점검 요약을 Telegram으로 발송

## 지금 수집되는 것

- Backend scrape 상태
- MCP Proxy scrape 상태
- Redis exporter / `redis_up`
- VictoriaMetrics 자체 scrape 상태
- 공개 사이트 응답 코드
- MCP health 응답 코드
- Docker unhealthy/exited/dead 컨테이너 상태
- 디스크 사용률
- Docker reclaimable 용량

## 지금 수집되지 않는 것

다음은 **현재 프로덕션에서 신뢰 가능한 메트릭이 없습니다.**

- host CPU / memory / disk inode 메트릭
- `container_cpu_usage_seconds_total`
- `container_memory_usage_bytes`
- Node Exporter / cAdvisor 기반 리소스 메트릭

즉시 알림에서 이 메트릭을 쓰면 오탐이 생기므로, v1에서는 알림 대상에서 제외합니다.

## 즉시 알림 원칙

즉시 알림은 **정확도 우선**입니다.

현재 Grafana 즉시 알림은 아래 3개만 신뢰 대상으로 둡니다.

- Backend 응답 중단
- MCP Proxy 응답 중단
- Redis 연결 이상

`victoriametrics` 자체 장애는 같은 datasource에서 자기 자신을 평가하면 신뢰도가 떨어지므로,
즉시 알림보다 daily summary와 별도 운영 점검에서 우선 확인합니다.

추가 원칙:

- core availability rule의 `execErrState`는 `OK`로 유지합니다.
- 이유: datasource 단절 시 Grafana가 `DatasourceError`를 backend / mcp-proxy / redis 각각의 장애처럼 fan-out해서 Telegram으로 보내면 운영자가 실제 다운으로 오인할 수 있습니다.
- datasource 오류는 component page 신호가 아니라 VictoriaMetrics/Grafana 운영 이슈로 분리해서 확인합니다.
- 이 경우 우선 확인 항목은 `codebase-prod-victoriametrics` 재시작 여부, 메모리 headroom, 그리고 Grafana 컨테이너 내부에서의 datasource query 성공 여부입니다.

## Telegram 메시지 원칙

Telegram 알림은 raw metric dump가 아니라 아래 구조를 기준으로 읽히게 유지합니다.

- `summary`: 무엇이 문제인지
- `impact`: 사용자/운영 영향
- `action`: 바로 확인할 조치

예시:

- `Backend 응답 중단`
- `영향: 웹 API와 자동포스팅이 실패할 수 있습니다.`
- `조치: backend 컨테이너 상태와 /health 응답을 확인하세요.`

## Daily Summary 원칙

Daily summary는 **매일 상태를 한 번에 이해하는 운영 요약**입니다.

포함 항목:

- 공개 사이트 상태
- MCP health 상태
- 비정상 컨테이너 수
- 신뢰 가능한 core alert 수
- 루트/데이터 디스크 사용률
- 정리 가능 Docker 용량
- 최근 24시간 backend / mcp-proxy 오류 수
- 즉시 확인이 필요한 항목의 `문제 / 영향 / 조치`

주의:

- 로그 grep 수치는 참고용입니다.
- overall 판정은 공개 health, 컨테이너 상태, 신뢰 alert, 디스크 위주로 결정합니다.

## 운영용 Secret / Env

### GitHub `production` Environment Secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `MONITOR_SSH_HOST`
- `MONITOR_SSH_USER`
- `MONITOR_SSH_KEY`

### 프로덕션 런타임 Env

현재 Grafana contact point는 production chat id를 provisioning 파일에 고정해두고, bot token만 런타임에서 읽습니다.

- `TELEGRAM_BOT_TOKEN`

`TELEGRAM_CHAT_ID`는 GitHub Actions daily summary에서 사용합니다.

## Source of Truth 파일

### 즉시 알림

- `grafana/provisioning/alerting/alert-rules.yml`
- `grafana/provisioning/alerting/contact-points.yml`
- `grafana/provisioning/alerting/notification-policies.yml`
- `scripts/grafana-entrypoint.sh`

### VictoriaMetrics 수집 / core service rules

- `victoriametrics/scrape_config.yml`
- `victoriametrics/alerts.yml`

### 일일 요약

- `.github/workflows/daily-production-monitoring.yml`
- `scripts/monitoring-daily-summary.sh`

## 운영 체크리스트

### 새 배포 후

1. `codebase-prod-grafana`가 `healthy`인지 확인
2. Grafana 로그에 `finished to provision alerting`이 있는지 확인
3. core alert rule이 stale DB가 아니라 최신 provisioning 상태인지 확인
4. `Daily Production Monitoring Summary`를 수동 실행해 Telegram 메시지를 확인

### 문제 발생 시 우선 확인 순서

1. 공개 사이트 / MCP health 응답 코드
2. `docker ps -a`의 unhealthy / exited / dead 컨테이너
3. Grafana provisioning 로그
4. VictoriaMetrics scrape 상태
5. backend / mcp-proxy 최근 로그

## Legacy / Local 자산

아래 자산은 현재 프로덕션 truth가 아닐 수 있습니다.

- `monitoring/prometheus/**`
- 예전 로컬 unified monitoring compose
- Node Exporter / container resource 가정을 전제로 한 문서

이 자산들은 로컬 실험이나 과거 운영 기록으로만 취급합니다.
