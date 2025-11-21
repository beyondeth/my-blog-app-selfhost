#!/bin/bash
# ============================================
# 프로덕션 배포 스크립트 (GHCR 없는 단일 빌드)
# ============================================
# Oracle Free Tier 최적화 - BuildKit + 병렬 빌드
# - BuildKit 활성화로 빌드 캐시 극대화
# - 단일 빌드 경로로 복잡성 제거
# - 병렬 빌드로 배포 시간 단축
#
# 사용법:
#   ./scripts/deploy-production.sh
#   FORCE_BUILD=true ./scripts/deploy-production.sh  # 강제 재빌드
# ============================================

set -e  # 에러 발생 시 즉시 종료
set -x  # 명령어 출력 (SSH 타임아웃 방지)

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

# 1. 환경 설정 및 BuildKit 활성화
log_info "Step 1: BuildKit 환경 설정"
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
log_info "✓ BuildKit 활성화 (DOCKER_BUILDKIT=1)"

# 2. 환경 변수 체크
log_info "Step 2: 환경 변수 체크"
cd /home/ubuntu/my-blog-app || exit 1
if [ ! -f .env.production ]; then
    log_error ".env.production 파일이 없습니다!"
    exit 1
fi
log_info "✓ 환경 변수 확인 완료"

# 환경 변수 로드
set -o allexport
[ -f .env.production ] && source .env.production || true
set +o allexport

# 3. 디스크 공간 확인 및 정리
log_info "Step 3: 디스크 공간 확인 및 정리"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log_info "현재 디스크 사용률: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -ge 80 ]; then
    log_warn "디스크 사용률이 ${DISK_USAGE}%로 높습니다. 정리를 시작합니다..."

    # Docker 시스템 정리
    log_info "Docker 정리 중..."
    DOCKER_CLEANED=$(docker system prune -a -f --volumes | grep -E 'Total reclaimed space| reclaimed' || echo "0B")
    log_info "Docker 정리 완료: $DOCKER_CLEANED"

    # 시스템 로그 정리
    sudo journalctl --vacuum-time=7d --quiet
    log_info "시스템 로그 정리 완료"

    # 최종 디스크 사용률 확인
    NEW_DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    log_info "정리 후 디스크 사용률: ${NEW_DISK_USAGE}% (이전: ${DISK_USAGE}%)"

    if [ "$NEW_DISK_USAGE" -ge 90 ]; then
        log_error "디스크 공간 부족 (${NEW_DISK_USAGE}%). 배포를 중단합니다."
        exit 1
    fi
else
    log_info "✓ 디스크 공간 충분 (${DISK_USAGE}%)"
fi

# 4. BuildKit 캐시 설정
log_info "Step 4: BuildKit 캐시 설정"
# BuildKit은 자동으로 내부 캐시를 사용합니다
log_info "✓ BuildKit 내부 캐시 활성화"

# 5. 현재 커밋 정보 확인
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
IMAGE_TAG=${IMAGE_TAG:-$CURRENT_COMMIT}
log_info "빌드할 커밋: $CURRENT_COMMIT"

# 6. 이미지 빌드 (BuildKit + 병렬)
log_info "Step 5: Docker 이미지 병렬 빌드 (BuildKit 활성화)"

# 빌드 전 이미지 태그 설정
PROJECT=${COMPOSE_PROJECT_NAME:-codebase-prod}

# BuildKit 캐시를 사용한 병렬 빌드 실행
log_info "frontend, backend, mcp-proxy 이미지 동시 빌드 시작..."

# compose build 명령으로 병렬 빌드 실행
if docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    build \
    --parallel \
    --pull; then
    log_info "✓ 모든 이미지 빌드 완료"
else
    log_error "✗ 이미지 빌드 실패"
    exit 1
fi

# 7. 빌드 검증
log_info "Step 6: 빌드 검증"
for SERVICE in "frontend" "backend" "mcp-proxy"; do
    IMAGE="${PROJECT}-${SERVICE}"
    if docker images "$IMAGE" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep -q "$IMAGE"; then
        IMAGE_CREATED=$(docker images "$IMAGE" --format "{{.CreatedAt}}")
        log_info "✓ $IMAGE 이미지 생성: $IMAGE_CREATED"
    else
        log_error "✗ $IMAGE 이미지를 찾을 수 없습니다"
        exit 1
    fi
done

# 8. Backend 재시작 (PM2 Zero-downtime)
log_info "Step 7: Backend PM2 Reload (Zero-downtime)"

# 컨테이너 강제 재생성
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate backend

# PM2 reload 실행
log_info "PM2 워커 reload 중..."
if timeout 30s docker exec codebase-prod-backend pm2 reload codebase-backend --update-env; then
    log_info "✓ PM2 reload 성공 (30초 내)"
else
    log_warn "⚠️ PM2 reload 타임아웃 또는 실패, restart로 fallback"
    docker exec codebase-prod-backend pm2 restart codebase-backend --update-env
    log_info "✓ PM2 restart 완료"
fi

# 헬스체크 대기
log_info "Backend 헬스체크 대기 중..."
MAX_WAIT=60
WAITED=0
CHECK_INTERVAL=3

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
    exit 1
fi

# PM2 워커 스케일업 확인
log_info "PM2 워커 수 확인 중..."
CURRENT_WORKERS=$(docker exec codebase-prod-backend pm2 jlist | grep -o '"pm_id":[0-9]*' | wc -l | tr -d ' ')

if [ "$CURRENT_WORKERS" -ge 4 ]; then
    log_info "✓ 이미 ${CURRENT_WORKERS}개 워커 실행 중"
else
    log_info "PM2 워커 스케일업 (${CURRENT_WORKERS} → 4 워커)"
    docker exec codebase-prod-backend pm2 scale codebase-backend 4
    sleep 5
    log_info "✓ PM2 워커 스케일업 완료"
fi

# 데이터베이스 마이그레이션
log_info "데이터베이스 마이그레이션 실행 중..."
if docker exec codebase-prod-backend npm run migration:run:prod:nobuild 2>&1 | tee -a /tmp/migration.log; then
    log_info "✓ 마이그레이션 완료"
else
    log_warn "⚠️ 마이그레이션 실패 또는 변경사항 없음"
fi

# 9. Frontend 재시작
log_info "Step 8: Frontend 재시작"
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate frontend

# 헬스체크
sleep 10
if docker exec codebase-prod-frontend node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ Frontend 헬스체크 통과"
else
    log_warn "Frontend 헬스체크 실패 (비정상 종료는 아님)"
fi

# 10. MCP Proxy 재시작
log_info "Step 9: MCP Proxy 재시작"
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate mcp-proxy

# 헬스체크
sleep 5
if docker exec codebase-prod-mcp-proxy node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ MCP Proxy 헬스체크 통과"
else
    log_warn "MCP Proxy 헬스체크 실패 (비정상 종료는 아님)"
fi

# 11. 최종 상태 확인
log_info "Step 10: 최종 상태 확인"
log_info "컨테이너 상태:"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production ps

log_info "PM2 상태:"
docker exec codebase-prod-backend pm2 status

# 12. 배포 완료
DEPLOY_END_TIME=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
log_info "=========================================="
log_info "배포 완료: $(date)"
log_info "소요 시간: ${DEPLOY_DURATION}초"
log_info "커밋: $CURRENT_COMMIT"
log_info "=========================================="

exit 0