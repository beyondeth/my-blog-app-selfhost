#!/bin/bash
# ============================================
# 디스크 공간 정리 스크립트 (크론잡용)
# ============================================
# Oracle Free Tier 디스크 공간 관리
# - Docker 정리
# - 로그 정리
# - 디스크 사용량 모니터링 및 알림
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 로그 함수
log_info() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_info "🧹 디스크 정리 시작..."

# 디스크 사용량 확인
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log_info "현재 디스크 사용률: ${DISK_USAGE}%"

CLEANED_SPACE=0

# 1. Docker 정리 (항상 실행)
log_info "Docker 정리 중..."
DOCKER_OUTPUT=$(docker system prune -a -f --volumes 2>&1)
if echo "$DOCKER_OUTPUT" | grep -q "Total reclaimed space"; then
    DOCKER_SPACE=$(echo "$DOCKER_OUTPUT" | grep "Total reclaimed space" | awk '{print $4}')
    log_info "Docker 정리 완료: ${DOCKER_SPACE}"
    CLEANED_SPACE=$((CLEANED_SPACE + 1))  # 플래그 용도
else
    log_info "Docker 정리 완료 (정리할 항목 없음)"
fi

# 2. 시스템 저널 로그 정리
log_info "시스템 저널 로그 정리 중 (7일 이전)..."
JOURNAL_OUTPUT=$(sudo journalctl --vacuum-time=7d 2>&1)
if echo "$JOURNAL_OUTPUT" | grep -q "freed"; then
    JOURNAL_SPACE=$(echo "$JOURNAL_OUTPUT" | grep "freed" | tail -1 | awk '{print $(NF-1)}' | sed 's/[A-Za-z]//g')
    log_info "저널 로그 정리 완료: ${JOURNAL_SPACE}"
fi

# 3. PM2 로그 정리 (컨테이너 내부)
log_info "PM2 로그 정리 중..."
if docker ps | grep -q "aigory-blog-prod-backend"; then
    # PM2 로그 플러시 및 회전
    docker exec aigory-blog-prod-backend pm2 flush all 2>/dev/null || true
    log_info "PM2 로그 플러시 완료"
fi

# 4. 최종 디스크 사용량 확인
NEW_DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
SAVED_SPACE=$((DISK_USAGE - NEW_DISK_USAGE))

log_info "========================================"
log_info "정리 완료"
log_info "이전 사용률: ${DISK_USAGE}%"
log_info "현재 사용률: ${NEW_DISK_USAGE}%"
log_info "확보된 공간: ${SAVED_SPACE}%"
log_info "========================================"

# 5. 알림 (디스크 사용률이 85% 이상이면 경고)
if [ "$NEW_DISK_USAGE" -ge 85 ]; then
    log_warn "⚠️  디스크 사용률이 여전히 높습니다: ${NEW_DISK_USAGE}%"
    # 여기에 Slack/Discord 알림 추가 가능
fi

exit 0