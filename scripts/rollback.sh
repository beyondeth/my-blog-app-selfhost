#!/bin/bash
# ============================================
# 프로덕션 롤백 스크립트
# ============================================
# 실패한 배포를 이전 상태로 안전하게 롤백
# - 데이터베이스 복원
# - 이전 이미지로 되돌리기
# - PM2 프로세스 복구
#
# 사용법:
#   ./scripts/rollback.sh [reason]
#   reason: auto, migration-failed, manual, etc.
# ============================================

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 롤백 정보
ROLLBACK_START_TIME=$(date +%s)
ROLLBACK_REASON="${1:-manual}"
ROLLBACK_ID="rollback-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/var/log/rollback.log"

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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 로그 기록 함수
write_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 롤백 가능 여부 확인
check_rollback_feasibility() {
    log_info "롤백 가능 여부 확인..."

    # 1. 백업 파일 확인
    if [ ! -f "$BACKUP_DIR/.last_backup" ]; then
        log_error "최근 백업 파일을 찾을 수 없습니다."
        log_error "수동 복구가 필요합니다."
        exit 1
    fi

    local backup_file=$(cat $BACKUP_DIR/.last_backup)
    if [ ! -f "${backup_file}.gz" ] && [ ! -f "$backup_file" ]; then
        log_error "백업 파일이 존재하지 않습니다: $backup_file"
        exit 1
    fi

    log_info "✓ 백업 파일 확인: $backup_file"

    # 2. Docker 상태 확인
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker가 실행되지 않았습니다."
        exit 1
    fi

    # 3. 현재 배포 상태 확인
    cd /home/ubuntu/my-blog-app || exit 1

    if ! docker compose -f docker-compose.prod.oracle.yml ps >/dev/null 2>&1; then
        log_warn "현재 배포된 서비스가 없습니다."
    fi

    log_info "✓ 롤백 사전 체크 완료"
}

# 데이터베이스 롤백
rollback_database() {
    log_info "데이터베이스 롤백 시작..."

    local backup_file=$(cat $BACKUP_DIR/.last_backup)

    # 압축된 백업 파일인 경우 해제
    if [ -f "${backup_file}.gz" ]; then
        log_info "백업 파일 압축 해제..."
        gunzip -c "${backup_file}.gz" > "${backup_file}.temp"
        backup_file="${backup_file}.temp"
    fi

    # 환경 변수 로드
    source .env.production

    # DATABASE_URL에서 연결 정보 추출
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

    if [ -z "$DB_HOST" ]; then DB_HOST="localhost"; fi
    if [ -z "$DB_PORT" ]; then DB_PORT="5432"; fi

    # 현재 연결된 세션 종료
    log_info "데이터베이스 연결 종료..."
    docker exec codebase-prod-backend psql -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
    " 2>/dev/null || true

    # 데이터베이스 복원
    log_info "데이터베이스 복원 중... (시간이 다소 소요될 수 있습니다)"
    DB_RESTORE_START=$(date +%s)

    if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$backup_file" \
        --verbose \
        --single-transaction \
        2>&1 | tee -a $LOG_FILE; then

        DB_RESTORE_END=$(date +%s)
        DB_RESTORE_DURATION=$((DB_RESTORE_END - DB_RESTORE_START))
        log_info "✅ 데이터베이스 복원 완료 (${DB_RESTORE_DURATION}초)"
    else
        log_error "❌ 데이터베이스 복원 실패!"
        log_error "백업 파일: $backup_file"
        exit 1
    fi

    # 임시 파일 정리
    if [ -f "${backup_file}.temp" ]; then
        rm -f "${backup_file}.temp"
    fi
}

# 이전 이미지로 롤백
rollback_images() {
    log_info "Docker 이미지 롤백..."

    # 이전 이미지 정보 확인
    if [ -f "$BACKUP_DIR/.previous_image" ]; then
        local previous_image=$(cat $BACKUP_DIR/.previous_image)
        log_info "이전 이미지: $previous_image"

        # 현재 컨테이너 중지
        log_info "현재 컨테이너 중지..."
        docker compose -f docker-compose.prod.oracle.yml --env-file .env.production down

        # 이전 이미지로 컨테이너 재시작
        log_info "이전 이미지로 컨테이너 재시작..."

        # docker-compose.yml에서 이미지 태그 수정
        sed -i.bak "s/IMAGE_TAG=.*/IMAGE_TAG=previous/" .env.production

        # 컨테이너 시작
        docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d

        # 원복
        mv .env.production.bak .env.production

        log_info "✅ 이미지 롤백 완료"
    else
        log_warn "이전 이미지 정보가 없습니다. 현재 이미지를 계속 사용합니다."
    fi
}

# PM2 프로세스 복구
recover_pm2() {
    log_info "PM2 프로세스 복구..."

    # 컨테이너가 실행될 때까지 대기
    sleep 10

    if docker ps | grep -q "codebase-prod-backend"; then
        # PM2 프로세스 상태 확인
        if docker exec codebase-prod-backend pm2 list >/dev/null 2>&1; then
            # 모든 프로세스 재시작
            log_info "PM2 프로세스 재시작..."
            docker exec codebase-prod-backend pm2 restart all

            # 워커 수 확인
            sleep 5
            local workers=$(docker exec codebase-prod-backend pm2 jlist | grep -o '"pm_id":[0-9]*' | wc -l | tr -d ' ')
            log_info "PM2 워커 수: $workers"

            if [ "$workers" -lt 2 ]; then
                log_info "PM2 워커 스케일업 (2개)"
                docker exec codebase-prod-backend pm2 scale codebase-backend 2
            fi

            log_info "✅ PM2 복구 완료"
        else
            log_error "PM2를 초기화할 수 없습니다."
            docker exec codebase-prod-backend npm run start:prod || true
        fi
    else
        log_error "Backend 컨테이너가 실행되지 않았습니다."
    fi
}

# 헬스체크
health_check_after_rollback() {
    log_info "롤백 후 헬스체크..."

    local max_wait=60
    local waited=0

    while [ $waited -lt $max_wait ]; do
        # Backend 헬스체크
        if docker exec codebase-prod-backend curl -f http://localhost:3000/internal/health-check-2f4a8b9c >/dev/null 2>&1; then
            log_info "✅ Backend 헬스체크 통과"

            # API 테스트
            if curl -f http://localhost/api/v1/blogs/public >/dev/null 2>&1; then
                log_info "✅ API 엔드포인트 정상"
                return 0
            fi
        fi

        sleep 2
        waited=$((waited + 2))
        log_info "헬스체크 대기 중... (${waited}/${max_wait}초)"
    done

    log_error "❌ 롤백 후 헬스체크 실패"
    log_error "수동 확인이 필요합니다."

    # PM2 로그 출력
    if docker ps | grep -q "codebase-prod-backend"; then
        log_error "PM2 로그:"
        docker exec codebase-prod-backend pm2 logs --lines 50
    fi

    return 1
}

# 롤백 상태 기록
record_rollback() {
    log_info "롤백 상태 기록..."

    local rollback_info="$BACKUP_DIR/rollback_${ROLLBACK_ID}.json"

    cat > "$rollback_info" << EOF
{
    "rollback_id": "$ROLLBACK_ID",
    "rollback_reason": "$ROLLBACK_REASON",
    "rollback_time": "$(date -Iseconds)",
    "duration_seconds": $(($(date +%s) - ROLLBACK_START_TIME)),
    "backup_used": "$(cat $BACKUP_DIR/.last_backup 2>/dev/null || echo 'unknown')",
    "previous_image": "$(cat $BACKUP_DIR/.previous_image 2>/dev/null || echo 'unknown')",
    "containers": $(docker compose -f docker-compose.prod.oracle.yml --env-file .env.production ps --format json 2>/dev/null | jq -c . || echo '[]')
}
EOF

    log_info "롤백 정보 저장: $rollback_info"
}

# 롤백 완료 알림
notify_rollback() {
    log_info "롤백 완료 알림..."

    # 슬랙/디스코드 알림 (선택사항)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"🚨 프로덕션 롤백 완료 ($ROLLBACK_ID, 이유: $ROLLBACK_REASON)\"}" \
    #   YOUR_WEBHOOK_URL

    # 이메일 알림 (선택사항)
    # echo "롤백 완료: $ROLLBACK_ID" | mail -s "Production Rollback" admin@example.com
}

# 메인 롤백 함수
main() {
    write_log "===== 롤백 시작: $ROLLBACK_ID ====="
    write_log "롤백 사유: $ROLLBACK_REASON"
    write_log "시작 시간: $(date)"

    # 사전 체크
    check_rollback_feasibility

    # 데이터베이스 롤백
    if [ "$ROLLBACK_REASON" = "migration-failed" ] || [ "$ROLLBACK_REASON" = "auto" ]; then
        rollback_database
    else
        read -p "데이터베이스도 롤백하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback_database
        fi
    fi

    # 이미지 롤백
    rollback_images

    # PM2 복구
    recover_pm2

    # 헬스체크
    if health_check_after_rollback; then
        # 상태 기록
        record_rollback

        # 롤백 완료
        ROLLBACK_END_TIME=$(date +%s)
        ROLLBACK_DURATION=$((ROLLBACK_END_TIME - ROLLBACK_START_TIME))

        write_log "===== 롤백 성공 완료: $ROLLBACK_ID ====="
        log_info "소요 시간: ${ROLLBACK_DURATION}초"
        log_info "완료 시간: $(date)"

        # 알림
        notify_rollback

        exit 0
    else
        log_error "롤백 후 시스템이 정상적으로 동작하지 않습니다."
        log_error "수동 개입이 필요합니다."
        exit 1
    fi
}

# 사용법 안내
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "사용법: $0 [reason]"
    echo ""
    echo "reason:"
    echo "  auto               - 자동 롤백 (에러 발생 시)"
    echo "  migration-failed   - 마이그레이션 실패로 인한 롤백"
    echo "  manual             - 수동 롤백"
    echo ""
    echo "예시:"
    echo "  $0 manual"
    echo "  $0 migration-failed"
    exit 0
fi

# 스크립트 실행
main "$@"