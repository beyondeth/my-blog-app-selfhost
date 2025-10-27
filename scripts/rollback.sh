#!/bin/bash
# ============================================
# 긴급 롤백 스크립트
# ============================================
# 배포 실패 시 이전 커밋으로 롤백
#
# 사용법:
#   ./scripts/rollback.sh [commit_hash]
#   예: ./scripts/rollback.sh HEAD~1
#       ./scripts/rollback.sh abc1234
#
# 주의사항:
#   - 프로덕션 서버에서만 사용
#   - 롤백 후 수동 확인 필수
# ============================================

set -e

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

# 롤백 대상 커밋 (기본값: HEAD~1)
ROLLBACK_TARGET=${1:-HEAD~1}

log_warn "=========================================="
log_warn "긴급 롤백 시작"
log_warn "대상: $ROLLBACK_TARGET"
log_warn "=========================================="

# 1. 현재 커밋 정보 저장 (롤백 실패 시 복구용)
CURRENT_COMMIT=$(git rev-parse HEAD)
log_info "현재 커밋: $CURRENT_COMMIT"
log_info "롤백 대상: $(git rev-parse $ROLLBACK_TARGET)"

# 2. 사용자 확인
read -p "정말로 롤백하시겠습니까? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log_error "롤백이 취소되었습니다."
    exit 1
fi

# 3. Git Reset (Hard)
log_info "Step 1: Git Reset"
cd /home/ubuntu/my-blog-app || exit 1
git fetch origin main
git reset --hard $ROLLBACK_TARGET
log_info "✓ Git Reset 완료"

# 4. Docker 이미지 재빌드
log_info "Step 2: Docker 이미지 재빌드"
docker compose -f docker-compose.prod.oracle.yml build
log_info "✓ 이미지 재빌드 완료"

# 5. PM2 Reload (Backend)
log_info "Step 3: Backend PM2 Reload"
docker compose -f docker-compose.prod.oracle.yml up -d backend
sleep 5
docker exec codebase-prod-backend pm2 reload all --update-env
log_info "✓ Backend 재시작 완료"

# 6. Frontend/MCP 재시작
log_info "Step 4: Frontend/MCP 재시작"
docker compose -f docker-compose.prod.oracle.yml up -d frontend mcp-proxy
log_info "✓ Frontend/MCP 재시작 완료"

# 7. 헬스체크
log_info "Step 5: 헬스체크 (30초 대기)"
sleep 30

# Backend 헬스체크
if docker exec codebase-prod-backend node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ Backend 헬스체크 통과"
else
    log_error "❌ Backend 헬스체크 실패"
    log_error "수동 확인이 필요합니다!"
    exit 1
fi

# Frontend 헬스체크
if docker exec codebase-prod-frontend node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    log_info "✓ Frontend 헬스체크 통과"
else
    log_warn "Frontend 헬스체크 실패 (비정상 종료는 아님)"
fi

# 8. 컨테이너 상태 확인
log_info "Step 6: 컨테이너 상태 확인"
docker compose -f docker-compose.prod.oracle.yml ps

# 9. PM2 상태 확인
log_info "Step 7: PM2 상태 확인"
docker exec codebase-prod-backend pm2 status

# 10. 롤백 완료
log_info "=========================================="
log_info "롤백 완료: $(date)"
log_info "이전 커밋: $CURRENT_COMMIT"
log_info "현재 커밋: $(git rev-parse HEAD)"
log_info "=========================================="
log_warn "⚠️  수동으로 서비스 정상 작동 여부를 확인하세요!"

# 11. 롤백 히스토리 기록
echo "[$(date)] Rollback: $CURRENT_COMMIT → $(git rev-parse HEAD)" >> /var/log/codebase/rollback-history.log

exit 0
