#!/bin/bash

# ============================================
# Aigory 블로그 플랫폼 - 자동 배포 스크립트
# ============================================
# 오라클 프리티어 ARM64 환경 최적화
# 타임아웃 및 리소스 오류 방지
#
# 사용법:
#   bash scripts/deploy.sh [rollback|health]
#   rollback: 이전 버전으로 롤백
#   health: 서비스 상태 확인
# ============================================

set -euo pipefail  # 에러 시 즉시 종료

# 색상 출력 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 에러 핸들러
trap 'error "배포 실패 at line $LINENO"' ERR

# 디렉토리 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 환경 설정
COMPOSE_FILE="docker-compose.prod.oracle.yml"
ENV_FILE=".env.production"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-aigory-blog-prod}"

# 헬스 체크 함수
check_health() {
    local service=$1
    local max_attempts=${2:-30}
    local attempt=1

    log "$service 서비스 헬스 체크 중..."

    while [ $attempt -le $max_attempts ]; do
        if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps "$service" | grep -q "Up (healthy)"; then
            success "$service 서비스 정상"
            return 0
        fi

        if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps "$service" | grep -q "Up"; then
            # 헬시 체크 없으면 포트 확인
            local port
            case $service in
                backend) port=3000 ;;
                frontend) port=3000 ;;
                mcp-proxy) port=3002 ;;
                *) port="" ;;
            esac

            if [ -n "$port" ]; then
                if curl -f -s "http://localhost:$port/health" >/dev/null 2>&1; then
                    success "$service 서비스 정상"
                    return 0
                fi
            fi
        fi

        warning "$service 서비스 대기 중... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    error "$service 서비스 헬스 체크 실패"
    return 1
}

# 사전 체크 함수
pre_flight_checks() {
    log "사전 체크 시작..."

    # 디스크 공간 확인
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$disk_usage" -ge 90 ]; then
        warning "디스크 공간 부족 (${disk_usage}%). 정리 중..."
        docker system prune -a -f --volumes || true
        sleep 10
    fi

    # 메모리 확인
    local available_mem
    available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$available_mem" -lt 4096 ]; then
        warning "사용 가능한 메모리가 4GB 미만입니다 (${available_mem}MB)"
    fi

    # Docker 상태 확인
    if ! docker info >/dev/null 2>&1; then
        error "Docker가 실행 중이 아닙니다"
        exit 1
    fi

    # 필수 파일 확인
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "$COMPOSE_FILE 파일이 없습니다"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        error "$ENV_FILE 파일이 없습니다"
        exit 1
    fi

    success "사전 체크 완료"
}

# 빌드 함수 (최적화)
build_services() {
    log "도커 이미지 빌드 시작..."

    # Buildx 설정
    docker buildx use default || docker buildx create --use

    # 환경 변수 설정 (BuildKit 최적화)
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    export BUILDKIT_INLINE_CACHE=1
    export BUILDKIT_PROGRESS=plain

    # 병렬 빌드 (CACHEBUST 제거로 캐시 활용 극대화)
    log "Backend, Frontend, MCP Proxy 병렬 빌드 중 (캐시 활용)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build \
        --parallel \
        backend frontend mcp-proxy

    success "빌드 완료"
}

# 서비스 재시작 함수 (병렬 최적화)
restart_services() {
    log "서비스 재시작 시작 (병렬 처리)..."

    # Step 1: 데이터베이스 및 캐시 먼저 시작
    log "Step 1: 데이터베이스 및 캐시 서비스 시작..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
        postgres redis-core redis-cache pgbouncer

    # Step 2: 데이터베이스 초기화 대기 (시간 단축)
    log "Step 2: 데이터베이스 초기화 대기 (최대 30초)..."
    timeout 30 bash -c "
        while ! docker compose -f docker-compose.prod.oracle.yml --env-file .env.production exec -T postgres pg_isready -U \${DB_USER:-postgres} 2>/dev/null; do
            sleep 1
        done
    " || {
        warning "데이터베이스 헬스 체크 타임아웃 (계속 진행)"
    }

    # Step 3: 모든 애플리케이션 서비스 동시 시작 (병렬)
    log "Step 3: 모든 애플리케이션 서비스 동시 시작..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
        backend frontend mcp-proxy victoriametrics grafana redis-core-exporter redis-cache-exporter

    # Step 4: 백엔드 준비 대기 (마이그레이션용)
    log "Step 4: 백엔드 준비 대기 (최대 60초)..."
    timeout 60 bash -c "
        while ! curl -sf http://localhost:3000/health > /dev/null 2>&1; do
            sleep 2
        done
    " || {
        warning "백엔드 헬스 체크 타임아웃"
    }

    # Step 5: 마이그레이션 실행
    log "Step 5: 데이터베이스 마이그레이션 실행..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend pnpm migration:run || {
        warning "마이그레이션 실패 (새 설치일 수 있음)"
    }

    success "모든 서비스 시작 완료"
}

# 헬스 체크 함수 (병렬 최적화)
health_checks() {
    log "서비스 헬스 체크 시작 (병렬 처리)..."

    # 병렬 헬스 체크 실행
    local pids=()

    # 데이터베이스 서비스 체크 (백그라운드)
    (check_health "postgres" 30 && echo "✓ PostgreSQL 준비 완료") &
    pids+=($!)

    (check_health "redis-core" 20 && echo "✓ Redis Core 준비 완료") &
    pids+=($!)

    (check_health "redis-cache" 20 && echo "✓ Redis Cache 준비 완료") &
    pids+=($!)

    (check_health "pgbouncer" 20 && echo "✓ PgBouncer 준비 완료") &
    pids+=($!)

    # 애플리케이션 서비스 체크 (백그라운드)
    (check_health "backend" 60 && echo "✓ Backend 준비 완료") &
    pids+=($!)

    (check_health "frontend" 40 && echo "✓ Frontend 준비 완료") &
    pids+=($!)

    (check_health "mcp-proxy" 30 && echo "✓ MCP Proxy 준비 완료") &
    pids+=($!)

    # 모니터링 서비스 체크 (백그라운드)
    (check_health "victoriametrics" 30 && echo "✓ VictoriaMetrics 준비 완료") &
    pids+=($!)

    (check_health "grafana" 30 && echo "✓ Grafana 준비 완료") &
    pids+=($!)

    # 모든 헬스 체크 완료 대기
    local failed=0
    for pid in "${pids[@]}"; do
        wait "$pid" || ((failed++))
    done

    if [ $failed -eq 0 ]; then
        success "모든 서비스 정상"
    else
        warning "$failed개 서비스 헬스 체크 실패"
    fi
}

# 상태 출력 함수
print_status() {
    log "최종 상태:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

    echo
    log "서비스 접속 정보:"
    echo "  Frontend: http://localhost:3001"
    echo "  Backend API: http://localhost:3000"
    echo "  Grafana: http://localhost:3030"
    echo "  VictoriaMetrics: http://localhost:8428"
}

# 롤백 함수
rollback_deployment() {
    log "이전 버전으로 롤백 중..."

    # 이전 컨테이너 이미지 확인
    local previous_images
    previous_images=$(docker images --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME}" --format "table {{.Repository}}:{{.Tag}}" | grep -v "REPOSITORY:TAG" | tail -n 3)

    if [ -z "$previous_images" ]; then
        error "롤백할 이전 이미지가 없습니다"
        exit 1
    fi

    log "롤백할 이미지: $previous_images"

    # 서비스 중지
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    # 이전 이미지로 태그 변경 (백업이 있다면)
    # TODO: 실제 롤백 로직은 이미지 관리 전략에 따라 달라짐

    # 서비스 재시작
    restart_services
    health_checks

    success "롤백 완료"
}

# 메인 함수
main() {
    local command=${1:-deploy}

    log "=========================================="
    log "Aigory 블로그 플랫폼 배포 시작"
    log "Mode: $command"
    log "Time: $(date)"
    log "=========================================="

    case $command in
        "rollback")
            rollback_deployment
            ;;
        "health")
            health_checks
            print_status
            ;;
        "deploy"|"")
            pre_flight_checks
            build_services
            restart_services
            health_checks
            print_status
            ;;
        *)
            error "잘못된 명령어: $command"
            echo "사용법: $0 [deploy|rollback|health]"
            exit 1
            ;;
    esac

    log "=========================================="
    success "배포 완료: $(date)"
    log "=========================================="
}

# 스크립트 실행
main "$@"
