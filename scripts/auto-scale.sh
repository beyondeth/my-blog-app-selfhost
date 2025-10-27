#!/bin/bash
# ============================================
# PM2 자동 스케일링 스크립트
# ============================================
# Oracle Free Tier 할당량 최적화
# - 월 3,000 OCPU시간 (평균 4.17 OCPU)
# - CPU 사용률에 따라 PM2 워커 수 동적 조절
#
# 사용법:
#   ./scripts/auto-scale.sh
#
# Cron 등록:
#   */5 * * * * /home/ubuntu/my-blog-app/scripts/auto-scale.sh >> /var/log/auto-scale.log 2>&1
#
# 스케일링 전략:
#   - CPU > 90%: 워커 감소 (4→2→1)
#   - CPU < 60%: 워커 증가 (1→2→4)
# ============================================

set -e

# 로그 디렉토리 생성
LOG_DIR="/var/log/codebase"
mkdir -p $LOG_DIR
LOG_FILE="$LOG_DIR/auto-scale.log"

# 로그 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Docker 컨테이너 이름
CONTAINER_NAME="codebase-prod-backend"

# 컨테이너 실행 여부 확인
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "ERROR: ${CONTAINER_NAME} 컨테이너가 실행 중이 아닙니다."
    exit 1
fi

# CPU 사용률 측정 (백분율, 소수점 제거)
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" $CONTAINER_NAME | sed 's/%//')
CPU_USAGE_INT=$(printf "%.0f" $CPU_USAGE)

log "현재 CPU 사용률: ${CPU_USAGE}%"

# 현재 PM2 워커 수 확인
# jq가 설치되어 있으면 사용, 없으면 grep/sed로 파싱
if command -v jq &> /dev/null; then
    CURRENT_WORKERS=$(docker exec $CONTAINER_NAME pm2 jlist 2>/dev/null | jq '.[0].pm2_env.instances' 2>/dev/null || echo "4")
else
    log "WARNING: jq not installed. Using grep/sed fallback (less reliable)"
    CURRENT_WORKERS=$(docker exec $CONTAINER_NAME pm2 jlist 2>/dev/null | grep -o '"instances":[0-9]*' | head -1 | cut -d':' -f2 || echo "4")
fi

if [ -z "$CURRENT_WORKERS" ] || [ "$CURRENT_WORKERS" = "null" ]; then
    CURRENT_WORKERS=4
fi

log "현재 PM2 워커 수: ${CURRENT_WORKERS}개"

# 스케일링 결정 (임계치 적용)
NEW_WORKERS=$CURRENT_WORKERS

# CPU 사용률이 90% 이상: Scale Down
if [ $CPU_USAGE_INT -ge 90 ]; then
    log "⚠️  CPU 사용률 90% 이상 감지 - Scale Down 시작"

    if [ "$CURRENT_WORKERS" -eq 4 ]; then
        NEW_WORKERS=2
        log "워커 4개 → 2개로 감소"
    elif [ "$CURRENT_WORKERS" -eq 2 ]; then
        NEW_WORKERS=1
        log "워커 2개 → 1개로 감소"
    else
        log "이미 최소 워커 수 (1개)"
    fi

# CPU 사용률이 70% 이상: 현상 유지
elif [ $CPU_USAGE_INT -ge 70 ]; then
    log "✓ CPU 사용률 정상 범위 (70-90%) - 현상 유지"

# CPU 사용률이 60% 이하: Scale Up 가능
elif [ $CPU_USAGE_INT -le 60 ]; then
    log "✅ CPU 여유 감지 - Scale Up 가능"

    if [ "$CURRENT_WORKERS" -eq 1 ]; then
        NEW_WORKERS=2
        log "워커 1개 → 2개로 증가"
    elif [ "$CURRENT_WORKERS" -eq 2 ] && [ $CPU_USAGE_INT -le 50 ]; then
        NEW_WORKERS=4
        log "워커 2개 → 4개로 증가"
    else
        log "현재 워커 수 유지 (CPU 사용률: ${CPU_USAGE}%)"
    fi

# CPU 사용률이 60-70%: 현상 유지
else
    log "✓ CPU 사용률 정상 범위 (60-70%) - 현상 유지"
fi

# PM2 스케일링 실행
if [ "$NEW_WORKERS" != "$CURRENT_WORKERS" ]; then
    log "🔄 PM2 스케일링 실행: ${CURRENT_WORKERS}개 → ${NEW_WORKERS}개"

    # PM2 scale 명령어 실행
    if docker exec $CONTAINER_NAME pm2 scale codebase-backend $NEW_WORKERS 2>&1 | tee -a $LOG_FILE; then
        log "✓ PM2 스케일링 성공"

        # 스케일링 후 상태 확인
        sleep 5
        docker exec $CONTAINER_NAME pm2 status | tee -a $LOG_FILE

        # VictoriaMetrics 메트릭 업데이트 (선택사항)
        # curl -X POST http://localhost:8428/api/v1/import/prometheus \
        #   -d "pm2_worker_count{instance=\"$CONTAINER_NAME\"} $NEW_WORKERS $(date +%s)000"
    else
        log "❌ PM2 스케일링 실패"
        exit 1
    fi
else
    log "스케일링 불필요 (워커 수: ${CURRENT_WORKERS}개)"
fi

# 메모리 사용률 체크 (경고 알림용)
MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" $CONTAINER_NAME | sed 's/%//')
MEMORY_USAGE_INT=$(printf "%.0f" $MEMORY_USAGE)

if [ $MEMORY_USAGE_INT -ge 85 ]; then
    log "⚠️  메모리 사용률 85% 이상: ${MEMORY_USAGE}%"
    # 알림 전송 (선택사항)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"⚠️ 메모리 사용률 ${MEMORY_USAGE}%\"}" \
    #   YOUR_WEBHOOK_URL
fi

log "=========================================="

exit 0
