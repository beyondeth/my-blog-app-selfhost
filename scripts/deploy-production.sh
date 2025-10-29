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

# 1. 환경 변수 체크
log_info "Step 1: 환경 변수 체크"
cd /home/ubuntu/my-blog-app || exit 1
if [ ! -f .env.production ]; then
    log_error ".env.production 파일이 없습니다!"
    exit 1
fi
log_info "✓ 환경 변수 확인 완료"

# 2. Docker 이미지 빌드 (병렬 - Backend, Frontend, MCP Proxy)
log_info "Step 2: Docker 이미지 빌드 (병렬)"
docker compose -f docker-compose.prod.oracle.yml build backend frontend mcp-proxy
log_info "✓ 모든 이미지 빌드 완료"

# 3. Backend 컨테이너 재시작 (PM2 reload)
log_info "Step 3: Backend PM2 Reload (Zero-downtime)"

# 3-1. Backend 컨테이너 시작 (새 이미지)
docker compose -f docker-compose.prod.oracle.yml up -d backend

# 3-2. PM2 reload 실행 (워커 하나씩 재시작)
log_info "PM2 워커 reload 중..."
docker exec codebase-prod-backend pm2 reload all --update-env

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
docker compose -f docker-compose.prod.oracle.yml build frontend
docker compose -f docker-compose.prod.oracle.yml up -d frontend

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
docker compose -f docker-compose.prod.oracle.yml build mcp-proxy
docker compose -f docker-compose.prod.oracle.yml up -d mcp-proxy

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
