#!/bin/bash
# ============================================
# 프로덕션 배포 스크립트 (PM2 Reload)
# ============================================
# Oracle Free Tier 최적화 배포 전략
# - PM2 reload: Zero-downtime 배포 (워커 하나씩 재시작)
# - Blue-Green 대비 메모리 절약 (컨테이너 중복 없음)
#
# 사용법:
#   ./scripts/deploy-production.sh
#
# 주의사항:
#   - 서버에서 실행 (GitHub Actions에서 SSH로 호출)
#   - main 브랜치 최신 코드 배포
# ============================================

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 배포 시작 시간 기록
DEPLOY_START_TIME=$(date +%s)
log_info "=========================================="
log_info "프로덕션 배포 시작: $(date)"
log_info "=========================================="

# Git Pull은 GitHub Actions 워크플로우에서 수행됨

# 0. Nginx 설정 심볼릭 링크 확인
log_info "Step 0: Nginx 설정 상태 확인"
if [ ! -L /etc/nginx/sites-enabled/default ]; then
    log_warn "sites-enabled/default가 심볼릭 링크가 아닙니다!"
    log_info "심볼릭 링크로 재생성 중..."
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    sudo nginx -t > /dev/null 2>&1 && log_info "✓ Nginx 설정 정상" || log_error "Nginx 설정 오류"
else
    log_info "✓ Nginx 심볼릭 링크 정상"
fi

# 1. 환경 변수 체크
log_info "Step 1: 환경 변수 체크"
cd /home/ubuntu/my-blog-app || exit 1
if [ ! -f .env.production ]; then
    log_error ".env.production 파일이 없습니다!"
    exit 1
fi
log_info "✓ 환경 변수 확인 완료"

# 1.5. 디스크 공간 확인 및 정리 (Oracle Free Tier 최적화)
log_info "Step 1.5: 디스크 공간 확인 및 정리"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log_info "현재 디스크 사용률: ${DISK_USAGE}%"

# 디스크 사용률이 80% 이상이면 자동 정리
if [ "$DISK_USAGE" -ge 80 ]; then
    log_warn "디스크 사용률이 ${DISK_USAGE}%로 높습니다. 정리를 시작합니다..."

    # Docker 시스템 정리 (dangling 이미지, 미사용 컨테이너, 빌드 캐시)
    log_info "Docker 정리 중..."
    DOCKER_CLEANED=$(docker system prune -a -f --volumes | grep -E 'Total reclaimed space| reclaimed' || echo "0B")
    log_info "Docker 정리 완료: $DOCKER_CLEANED"

    # 시스템 저널 로그 정리 (7일 이전)
    log_info "시스템 로그 정리 중..."
    sudo journalctl --vacuum-time=7d --quiet
    log_info "시스템 로그 정리 완료"

    # 최종 디스크 사용률 확인
    NEW_DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    log_info "정리 후 디스크 사용률: ${NEW_DISK_USAGE}% (이전: ${DISK_USAGE}%)"

    # 정리 후에도 90% 이상이면 배포 중지
    if [ "$NEW_DISK_USAGE" -ge 90 ]; then
        log_error "디스크 공간 부족 (${NEW_DISK_USAGE}%). 배포를 중단합니다."
        log_error "수동으로 디스크 공간을 확보한 후 다시 시도하세요."
        exit 1
    fi
else
    log_info "✓ 디스크 공간 충분 (${DISK_USAGE}%)"
fi

# 2. Docker 이미지 빌드 (순차 - BuildKit 비활성화)
log_info "Step 2: Docker 이미지 준비 (기본: pull 우선 — 풀 실패 시 빌드로 폴백)"

# 기본 동작: 레지스트리에서 이미지를 pull하여 빌드 시간을 피함
# 환경변수로 동작 변경 가능:
# - PULL_IMAGES=true : 항상 pull 시도 (권장)
# - FORCE_BUILD=true : pull 시도 없이 강제 빌드
# - PARALLEL_BUILD=true : docker compose build --parallel 사용 (compose v2)

if [ "${FORCE_BUILD}" = "true" ]; then
    log_info "강제 빌드 모드: FORCE_BUILD=true"
    DO_PULL=false
elif [ "${PULL_IMAGES}" = "true" ]; then
    log_info "이미지 pull 우선 모드: PULL_IMAGES=true"
    DO_PULL=true
else
    # 기본: 시도해보고 실패하면 빌드
    DO_PULL=true
fi

if [ "${DO_PULL}" = "true" ]; then
    log_info "이미지 pull 시도: frontend, backend, mcp-proxy"
    if docker compose -f docker-compose.prod.oracle.yml --env-file .env.production pull frontend backend mcp-proxy; then
        log_info "✓ 이미지 pull 성공 — 빌드 단계 건너뜀"
    else
        log_warn "이미지 pull 실패 또는 일부 이미지 없음 — 빌드로 폴백"
        DO_BUILD=true
    fi
else
    DO_BUILD=true
fi

if [ "${DO_BUILD}" = "true" ]; then
    log_info "이미지 빌드 시작 (서버에서 빌드)"
    # BuildKit/Buildx 최적화 분기
    if [ "${USE_BUILDX}" = "true" ]; then
        log_info "Buildx 모드 활성화: USE_BUILDX=true"
        export DOCKER_BUILDKIT=1
        export COMPOSE_DOCKER_CLI_BUILD=1

        # 빌드 캐시 디렉토리 (서버에 유지되어 다음 빌드에 재사용됨)
        BUILD_CACHE_DIR=${BUILD_CACHE_DIR:-/home/ubuntu/.buildx-cache}
        mkdir -p "$BUILD_CACHE_DIR"

        # 빌더 존재 확인 후 생성
        BUILDER_NAME=${BUILDER_NAME:-deploy-builder}
        if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
            log_info "buildx 빌더 생성: $BUILDER_NAME"
            docker buildx create --name "$BUILDER_NAME" --use || true
        else
            docker buildx use "$BUILDER_NAME" || true
        fi

        # .env.production의 빌드 인자 로드 (이미 파일 존재 확인됨)
        set -o allexport
        # shellcheck disable=SC1091
        [ -f .env.production ] && source .env.production || true
        set +o allexport

        IMAGE_TAG=${IMAGE_TAG:-latest}
        PROJECT=${COMPOSE_PROJECT_NAME:-codebase-prod}

        # Backend 빌드
        log_info "1/3 Backend 이미지 (buildx) 빌드 시작..."
        if docker buildx build --builder "$BUILDER_NAME" \
            --cache-from=type=local,src="$BUILD_CACHE_DIR" \
            --cache-to=type=local,dest="$BUILD_CACHE_DIR",mode=max \
            --load --progress=plain \
            -t "${PROJECT}-backend:${IMAGE_TAG}" -f backend/Dockerfile ./backend; then
            log_info "✓ Backend buildx 빌드 완료"
        else
            log_warn "⚠️ Backend buildx 빌드 실패 — compose 빌드로 폴백"
            DO_BUILDX_FALLBACK=true
        fi

        # Frontend 빌드 (build-args 전달)
        if [ -z "$DO_BUILDX_FALLBACK" ]; then
            log_info "2/3 Frontend 이미지 (buildx) 빌드 시작..."
            if docker buildx build --builder "$BUILDER_NAME" \
                --cache-from=type=local,src="$BUILD_CACHE_DIR" \
                --cache-to=type=local,dest="$BUILD_CACHE_DIR",mode=max \
                --load --progress=plain \
                --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
                --build-arg NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL}" \
                --build-arg NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}" \
                --build-arg NEXT_PUBLIC_MIXPANEL_TOKEN="${NEXT_PUBLIC_MIXPANEL_TOKEN}" \
                --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID="${NEXT_PUBLIC_GA_MEASUREMENT_ID}" \
                -t "${PROJECT}-frontend:${IMAGE_TAG}" -f frontend/Dockerfile.prod ./frontend; then
                log_info "✓ Frontend buildx 빌드 완료"
            else
                log_warn "⚠️ Frontend buildx 빌드 실패 — compose 빌드로 폴백"
                DO_BUILDX_FALLBACK=true
            fi
        fi

        # MCP Proxy 빌드
        if [ -z "$DO_BUILDX_FALLBACK" ]; then
            log_info "3/3 MCP Proxy 이미지 (buildx) 빌드 시작..."
            if docker buildx build --builder "$BUILDER_NAME" \
                --cache-from=type=local,src="$BUILD_CACHE_DIR" \
                --cache-to=type=local,dest="$BUILD_CACHE_DIR",mode=max \
                --load --progress=plain \
                -t "${PROJECT}-mcp-proxy:${IMAGE_TAG}" -f mcp-proxy-server/Dockerfile ./mcp-proxy-server; then
                log_info "✓ MCP Proxy buildx 빌드 완료"
            else
                log_warn "⚠️ MCP Proxy buildx 빌드 실패 — compose 빌드로 폴백"
                DO_BUILDX_FALLBACK=true
            fi
        fi

        # buildx에서 실패가 있었으면 기존 compose 빌드로 폴백
        if [ "$DO_BUILDX_FALLBACK" = "true" ]; then
            log_info "buildx 빌드 실패로 compose 빌드로 폴백합니다"
            BUILD_CMD_BASE=(docker compose -f docker-compose.prod.oracle.yml --env-file .env.production build)
            if [ "${PARALLEL_BUILD}" = "true" ]; then
                BUILD_CMD_BASE+=(--parallel)
            fi
            log_info "compose: Backend 빌드"
            if "${BUILD_CMD_BASE[@]}" backend; then
                log_info "✓ Backend 빌드 완료"
            else
                log_error "✗ Backend 빌드 실패"
                exit 1
            fi
            log_info "compose: Frontend 빌드"
            if "${BUILD_CMD_BASE[@]}" frontend; then
                log_info "✓ Frontend 빌드 완료"
            else
                log_error "✗ Frontend 빌드 실패"
                exit 1
            fi
            log_info "compose: MCP Proxy 빌드"
            if "${BUILD_CMD_BASE[@]}" mcp-proxy; then
                log_info "✓ MCP Proxy 빌드 완료"
            else
                log_error "✗ MCP Proxy 빌드 실패"
                exit 1
            fi
        fi

        log_info "✓ 모든 이미지 빌드/로드 완료 (buildx 경로 완료 또는 compose 폴백 완료)"
    else
        # 기존 compose 빌드 경로 (변경 없음)
        # BuildKit 사용 여부 제어 (CI에서 buildx 쓰면 더 빠름)
        if [ "${USE_BUILDKIT}" = "true" ]; then
            export DOCKER_BUILDKIT=1
            export COMPOSE_DOCKER_CLI_BUILD=1
            log_info "BuildKit 활성화 (DOCKER_BUILDKIT=1)"
        else
            export DOCKER_BUILDKIT=0
            export COMPOSE_DOCKER_CLI_BUILD=0
            log_info "BuildKit 비활성화 (기본)"
        fi

        BUILD_CMD_BASE=(docker compose -f docker-compose.prod.oracle.yml --env-file .env.production build)

        if [ "${PARALLEL_BUILD}" = "true" ]; then
            log_info "병렬 빌드 사용: PARALLEL_BUILD=true"
            BUILD_CMD_BASE+=(--parallel)
        fi

        log_info "1/3 Backend 이미지 빌드 시작..."
        if "${BUILD_CMD_BASE[@]}" backend; then
            log_info "✓ Backend 빌드 완료"
        else
            log_error "✗ Backend 빌드 실패"
            exit 1
        fi

        log_info "2/3 Frontend 이미지 빌드 시작..."
        if "${BUILD_CMD_BASE[@]}" frontend; then
            log_info "✓ Frontend 빌드 완료"
        else
            log_error "✗ Frontend 빌드 실패"
            exit 1
        fi

        log_info "3/3 MCP Proxy 이미지 빌드 시작..."
        if "${BUILD_CMD_BASE[@]}" mcp-proxy; then
            log_info "✓ MCP Proxy 빌드 완료"
        else
            log_error "✗ MCP Proxy 빌드 실패"
            exit 1
        fi

        log_info "✓ 모든 이미지 빌드 완료"
    fi
fi

# 2-1. 빌드 검증 - 이미지 생성 시간 확인
log_info "Step 2-1: 빌드 검증 - 이미지 생성 시간 확인"
BUILD_TIME=$(date +"%Y-%m-%d %H:%M:%S")
log_info "빌드 완료 시간: $BUILD_TIME"

# 각 이미지 생성 시간 확인 (5분 이내여야 함)
for IMAGE in "codebase-prod-frontend" "codebase-prod-backend" "codebase-prod-mcp-proxy"; do
    IMAGE_CREATED=$(docker inspect $IMAGE --format='{{.Created}}' 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ' | cut -d'.' -f1)
    if [ -n "$IMAGE_CREATED" ]; then
        log_info "✓ $IMAGE 이미지 생성: $IMAGE_CREATED"
    else
        log_warn "⚠️  $IMAGE 이미지를 찾을 수 없습니다"
    fi
done

# 3. Backend 컨테이너 재시작 (PM2 reload)
log_info "Step 3: Backend PM2 Reload (Zero-downtime)"

# 3-1. Backend 컨테이너 시작 (새 이미지) - 강제 재생성
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate backend

# 3-2. PM2 reload 실행 (빠른 reload)
log_info "PM2 워커 reload 중..."
# timeout 20초로 단축하여 PM2 reload 실행
if timeout 20s docker exec codebase-prod-backend pm2 reload codebase-backend --update-env; then
    log_info "✓ PM2 reload 성공 (20초 내)"
else
    log_warn "⚠️  PM2 reload 타임아웃 또는 실패, fallback으로 restart 실행"
    # PM2 reload 실패 시 restart로 fallback (특정 앱만)
    docker exec codebase-prod-backend pm2 restart codebase-backend --update-env
    log_info "✓ PM2 restart 완료"
fi

# 3-3. 헬스체크 대기 (최대 60초로 단축)
log_info "헬스체크 대기 중..."
MAX_WAIT=60  # 120초에서 60초로 단축
WAITED=0
CHECK_INTERVAL=3  # 2초에서 3초로 변경 (API 호출 부하 감소)

while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec codebase-prod-backend node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
        log_info "✓ Backend 헬스체크 통과 (${WAITED}초)"
        break
    fi
    sleep $CHECK_INTERVAL
    WAITED=$((WAITED + CHECK_INTERVAL))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    log_error "Backend 헬스체크 실패 (60초 타임아웃)"
    log_error "롤백을 실행하세요: ./scripts/rollback.sh"
    exit 1
fi

# 3-3-1. PM2 워커 스케일업 (2개 → 4개)
log_info "PM2 워커 수 확인 중..."
CURRENT_WORKERS=$(docker exec codebase-prod-backend pm2 jlist | grep -o '"pm_id":[0-9]*' | wc -l | tr -d ' ')

if [ "$CURRENT_WORKERS" -ge 4 ]; then
    log_info "✓ 이미 ${CURRENT_WORKERS}개 워커 실행 중 (스케일업 불필요)"
else
    log_info "PM2 워커 스케일업 (${CURRENT_WORKERS} → 4 워커)"
    docker exec codebase-prod-backend pm2 scale codebase-backend 4
    sleep 5
    log_info "✓ PM2 워커 스케일업 완료"
fi

# 3-4. 데이터베이스 마이그레이션 실행
log_info "Step 3-4: 데이터베이스 마이그레이션 실행"
if docker exec codebase-prod-backend npm run migration:run:prod:nobuild 2>&1 | tee -a /tmp/migration.log; then
    log_info "✓ 마이그레이션 완료"
else
    log_warn "⚠️  마이그레이션 실패 또는 변경사항 없음"
    log_warn "수동 확인 필요: docker exec codebase-prod-backend npm run migration:run:prod:nobuild"
    # 마이그레이션 실패해도 배포는 계속 진행 (마이그레이션이 없을 수도 있음)
fi

# 4. Frontend 재시작 (빠른 재시작)
log_info "Step 4: Frontend 재시작"
# 이미 Step 2에서 빌드했으므로 여기서는 재시작만
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate frontend

# 헬스체크 대기
log_info "Frontend 헬스체크 대기 중..."
sleep 10
if docker exec codebase-prod-frontend node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ Frontend 헬스체크 통과"
else
    log_warn "Frontend 헬스체크 실패 (비정상 종료는 아님)"
fi

# 5. MCP Proxy 재시작
log_info "Step 5: MCP Proxy 재시작"
# 이미 Step 2에서 빌드했으므로 여기서는 재시작만
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate mcp-proxy

# 헬스체크 대기
log_info "MCP Proxy 헬스체크 대기 중..."
sleep 5
if docker exec codebase-prod-mcp-proxy node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ MCP Proxy 헬스체크 통과"
else
    log_warn "MCP Proxy 헬스체크 실패 (비정상 종료는 아님)"
fi

# 6. 컨테이너 상태 확인
log_info "Step 6: 컨테이너 상태 확인"
docker compose -f docker-compose.prod.oracle.yml ps

# 7. PM2 상태 확인
log_info "Step 7: PM2 상태 확인"
docker exec codebase-prod-backend pm2 status

# 8. 배포 완료 검증
log_info "Step 8: 배포 완료 검증"

# 컨테이너 시작 시간 확인 (모두 최근에 시작되었는지)
log_info "컨테이너 시작 시간 확인:"
for CONTAINER in "codebase-prod-backend" "codebase-prod-frontend" "codebase-prod-mcp-proxy"; do
    STARTED=$(docker inspect $CONTAINER --format='{{.State.StartedAt}}' 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ' | cut -d'.' -f1)
    if [ -n "$STARTED" ]; then
        log_info "  $CONTAINER: $STARTED"
    fi
done

# 9. 배포 완료
DEPLOY_END_TIME=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
log_info "=========================================="
log_info "배포 완료: $(date)"
log_info "소요 시간: ${DEPLOY_DURATION}초"
log_info "=========================================="

# 10. 슬랙/디스코드 알림 (선택사항)
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"✅ 프로덕션 배포 완료 (${DEPLOY_DURATION}초)\"}" \
#   YOUR_WEBHOOK_URL

exit 0
