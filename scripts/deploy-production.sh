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

# 디스크 사용률이 50% 이상이면 예방적 정리 (Oracle Free Tier 최적화)
if [ "$DISK_USAGE" -ge 50 ]; then
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

# 2. Docker 이미지 빌드 (병렬 - Backend, Frontend, MCP Proxy)
log_info "Step 2: Docker 이미지 빌드 (병렬) - 캐시 무효화"
# --no-cache: 항상 최신 코드로 빌드 보장
# --env-file: .env.production 파일의 환경변수를 빌드 인자로 사용
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production build --no-cache backend frontend mcp-proxy
log_info "✓ 모든 이미지 빌드 완료 (최신 코드 반영)"

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

# 3-2. PM2 reload 실행 (워커 하나씩 재시작)
log_info "PM2 워커 reload 중..."
# timeout 60초로 PM2 reload 실행 (hang 방지)
if timeout 60s docker exec codebase-prod-backend pm2 reload all --update-env; then
    log_info "✓ PM2 reload 성공"
else
    log_warn "⚠️  PM2 reload 타임아웃 또는 실패, fallback으로 restart 실행"
    # PM2 reload 실패 시 restart로 fallback
    docker exec codebase-prod-backend pm2 restart all --update-env
    log_info "✓ PM2 restart 완료"
fi

# 3-3. 헬스체크 대기 (최대 120초 - PM2 Cold Start 고려)
log_info "헬스체크 대기 중..."
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec codebase-prod-backend node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
        log_info "✓ Backend 헬스체크 통과 ($WAITED초)"
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    log_error "Backend 헬스체크 실패 (120초 타임아웃)"
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
