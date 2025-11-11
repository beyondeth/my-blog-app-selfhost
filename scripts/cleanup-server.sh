#!/bin/bash
# ============================================
# 서버 정리 스크립트
# ============================================
# Oracle Free Tier 최적화를 위한 주기적 정리
# - Docker 캐시 정리
# - 시스템 로그 정리
# - 디스크 사용량 확인 및 알림
#
# 사용법:
#   ./scripts/cleanup-server.sh
#
# 크론잡 등록 (매일 새벽 3시):
#   0 3 * * * /home/ubuntu/my-blog-app/scripts/cleanup-server.sh >> /var/log/cleanup.log 2>&1
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# 시작 시간 기록
START_TIME=$(date)
log_info "=========================================="
log_info "서버 정리 시작: $START_TIME"
log_info "=========================================="

# 1. 디스크 사용량 확인
log_info "Step 1: 디스크 사용량 확인"
DISK_BEFORE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log_info "정리 전 디스크 사용률: ${DISK_BEFORE}%"

# 2. Docker 정리
log_info "Step 2: Docker 시스템 정리"
DOCKER_BEFORE=$(docker system df --format "table {{.Type}}\t{{.Size}}" 2>/dev/null | tail -n +2 | awk '{sum+=$2} END {print sum}' || echo "0")
log_info "Docker 사용량 (정리 전): ${DOCKER_BEFORE}"

# Docker 이미지, 컨테이너, 빌드 캐시 정리
log_info "Docker 정리 실행 중..."
DOCKER_CLEANED=$(docker system prune -a -f --volumes | grep -E 'Total reclaimed space| reclaimed' || echo "0B")
log_info "✓ Docker 정리 완료: $DOCKER_CLEANED"

DOCKER_AFTER=$(docker system df --format "table {{.Type}}\t{{.Size}}" 2>/dev/null | tail -n +2 | awk '{sum+=$2} END {print sum}' || echo "0")
log_info "Docker 사용량 (정리 후): ${DOCKER_AFTER}"

# 3. 시스템 로그 정리
log_info "Step 3: 시스템 로그 정리"
sudo journalctl --vacuum-time=7d --quiet
log_info "✓ 시스템 로그 정리 완료 (7일 이전 로그 삭제)"

# 4. Nginx 로그 정리 (30일 이전)
log_info "Step 4: Nginx 로그 정리"
sudo find /var/log/nginx -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
log_info "✓ Nginx 로그 정리 완료"

# 5. 최종 디스크 사용량 확인
log_info "Step 5: 정리 결과 확인"
DISK_AFTER=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log_info "정리 후 디스크 사용률: ${DISK_AFTER}% (이전: ${DISK_BEFORE}%)"

# 6. 디스크 사용량 경고
if [ "$DISK_AFTER" -ge 80 ]; then
    log_error "⚠️ 경고: 디스크 사용률이 ${DISK_AFTER}%로 높습니다!"
    log_error "추가 정리가 필요할 수 있습니다."
elif [ "$DISK_AFTER" -ge 60 ]; then
    log_warn "디스크 사용률이 ${DISK_AFTER}%입니다. 주의가 필요합니다."
else
    log_info "✅ 디스크 사용량이 정상입니다 (${DISK_AFTER}%)"
fi

# 7. 정리 완료
END_TIME=$(date)
log_info "=========================================="
log_info "서버 정리 완료: $END_TIME"
log_info "=========================================="

# Slack/디스코드 알림 (선택사항)
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"✅ 서버 정리 완료 (디스크: ${DISK_BEFORE}% → ${DISK_AFTER}%)\"}" \
#   YOUR_WEBHOOK_URL

exit 0