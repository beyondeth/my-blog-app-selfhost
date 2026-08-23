#!/bin/bash
# ============================================
# 프로덕션 배포 스크립트 (개선 버전)
# ============================================
# Oracle Free Tier 최적화 배포 전략
# - PM2 reload: Zero-downtime 배포 (워커 하나씩 재시작)
# - 마이그레이션 자동 롤백
# - 안정적인 배포를 위한 헬스체크 강화
#
# 사용법:
#   ./scripts/deploy-production-enhanced.sh
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
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 에러 핸들링 함수
handle_error() {
    local exit_code=$?
    local line_number=$1

    log_error "스크립트 실행 실패 (라인: ${line_number}, 종료 코드: ${exit_code})"
    log_error "자동 롤백을 실행합니다..."

    # 롤백 스크립트 실행
    if [ -f "./scripts/rollback.sh" ]; then
        ./scripts/rollback.sh "auto" || log_error "롤백 실패! 수동으로 복구해주세요."
    else
        log_error "롤백 스크립트를 찾을 수 없습니다. 수동으로 복구해주세요."
    fi

    exit $exit_code
}

# 트랩 설정
trap 'handle_error ${LINENO}' ERR

# 배포 정보
DEPLOY_START_TIME=$(date +%s)
DEPLOY_ID="deploy-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/var/log/deploy-production.log"

# 로그 디렉토리 생성
mkdir -p $(dirname $LOG_FILE)
mkdir -p $BACKUP_DIR

# 로그 기록 함수
write_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 디스크 공간 확인
check_disk_space() {
    log_info "디스크 공간 확인..."

    local available=$(df / | awk 'NR==2 {print $4}')
    local required=1048576  # 1GB in KB

    if [ "$available" -lt "$required" ]; then
        log_error "디스크 공간 부족! 필요: 1GB, 사용 가능: $((available/1024))MB"
        exit 1
    fi

    log_info "✓ 디스크 공간 충분 (${available}KB 사용 가능)"
}

# 사전 배포 체크리스트
pre_deploy_checks() {
    log_info "사전 배포 체크리스트..."

    # 1. 필수 파일 확인
    local required_files=(
        ".env.production"
        "docker-compose.prod.oracle.yml"
        "backend/Dockerfile"
        "frontend/Dockerfile"
        "scripts/run-migrations.sh"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "필수 파일 누락: $file"
            exit 1
        fi
    done

    # 2. Docker 상태 확인
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker가 실행되지 않았습니다."
        exit 1
    fi

    # 3. 포트 확인
    local ports=(80 443 3000 3001 3002 5432 6379)
    for port in "${ports[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            log_debug "포트 $port 사용 중: $(lsof -i :$port | tail -n +2 | awk '{print $1}' | uniq)"
        fi
    done

    log_info "✓ 사전 배포 체크 완료"
}

# 데이터베이스 백업
backup_database() {
    log_info "데이터베이스 백업 생성..."

    local backup_file="$BACKUP_DIR/pre_deploy_$DEPLOY_ID.sql"

    # 환경 변수 로드
    source .env.production

    # DATABASE_URL에서 연결 정보 추출
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

    if [ -z "$DB_HOST" ]; then DB_HOST="localhost"; fi
    if [ -z "$DB_PORT" ]; then DB_PORT="5432"; fi

    # 백업 생성
    if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --verbose \
        --file="$backup_file" 2>/dev/null; then

        log_info "✓ 데이터베이스 백업 완료: $backup_file"
        echo "$backup_file" > $BACKUP_DIR/.last_backup

        # 백업 파일 압축
        gzip "$backup_file"
        log_info "✓ 백업 파일 압축 완료: ${backup_file}.gz"
    else
        log_error "데이터베이스 백업 실패"
        exit 1
    fi
}

# 점진적 롤아웃 준비
prepare_canary() {
    log_info "점진적 롤아웃 준비..."

    # 현재 버전 정보 저장
    if docker inspect aigory-blog-prod-backend >/dev/null 2>&1; then
        CURRENT_IMAGE=$(docker inspect aigory-blog-prod-backend --format='{{.Config.Image}}')
        echo "$CURRENT_IMAGE" > $BACKUP_DIR/.previous_image
        log_info "현재 이미지 저장: $CURRENT_IMAGE"
    fi

    # 새 버전 이미지 태그
    export IMAGE_TAG="$DEPLOY_ID"
    log_info "새 이미지 태그: $IMAGE_TAG"
}

# 메인 배포 함수
main() {
    write_log "===== 개선된 프로덕션 배포 시작: $DEPLOY_ID ====="
    log_info "배포 ID: $DEPLOY_ID"
    log_info "시작 시간: $(date)"

    # 0. 사전 체크
    check_disk_space
    pre_deploy_checks

    # 1. 작업 디렉토리 이동
    cd /home/ubuntu/my-blog-app || exit 1
    write_log "작업 디렉토리: $(pwd)"

    # 2. Nginx 설정 확인
    log_info "Step 0: Nginx 설정 상태 확인"
    if [ ! -L /etc/nginx/sites-enabled/default ]; then
        log_warn "sites-enabled/default가 심볼릭 링크가 아닙니다!"
        sudo rm -f /etc/nginx/sites-enabled/default
        sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
        sudo nginx -t && log_info "✓ Nginx 설정 정상" || log_error "Nginx 설정 오류"
    else
        log_info "✓ Nginx 심볼릭 링크 정상"
    fi

    # 3. 데이터베이스 백업
    backup_database

    # 4. 점진적 롤아웃 준비
    prepare_canary

    # 5. Docker 이미지 빌드 (병렬)
    log_info "Step 1: Docker 이미지 빌드 (병렬) - 캐시 무효화"

    # 빌드 전 Docker 시스템 정리
    log_debug "Docker 시스템 정리..."
    docker system prune -f

    # 이미지 빌드
    docker compose -f docker-compose.prod.oracle.yml --env-file .env.production build \
        --no-cache \
        --parallel \
        backend frontend mcp-proxy

    log_info "✓ 모든 이미지 빌드 완료"

    # 6. 빌드 검증
    log_info "Step 1-1: 빌드 검증"

    # 이미지 존재 확인
    for IMAGE in "aigory-blog-prod-frontend" "aigory-blog-prod-backend" "aigory-blog-prod-mcp-proxy"; do
        if ! docker inspect $IMAGE >/dev/null 2>&1; then
            log_error "$IMAGE 이미지를 찾을 수 없습니다"
            exit 1
        fi

        local image_size=$(docker inspect $IMAGE --format='{{.Size}}' | awk '{print int($1/1024/1024)}')
        log_info "✓ $IMAGE 이미지 (${image_size}MB)"
    done

    # 7. Backend 배포 (마이그레이션 포함)
    log_info "Step 2: Backend 배포 (마이그레이션 포함)"

    # Backend 컨테이너 시작
    docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate backend

    # 컨테이너 시작 대기
    log_info "Backend 컨테이너 시작 대기..."
    sleep 10

    # 마이그레이션 전 데이터베이스 연결 확인
    log_info "데이터베이스 연결 확인..."
    if ! docker exec aigory-blog-prod-backend timeout 30 node -e "
        const { DataSource } = require('./dist/src/data-source.js');
        const dataSource = new DataSource();
        dataSource.initialize()
            .then(() => {
                console.log('✅ 데이터베이스 연결 성공');
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ 데이터베이스 연결 실패:', err.message);
                process.exit(1);
            });
    "; then
        log_error "데이터베이스 연결 실패"
        exit 1
    fi

    # 마이그레이션 실행
    log_info "마이그레이션 실행..."
    MIGRATION_START_TIME=$(date +%s)

    if docker exec aigory-blog-prod-backend ./scripts/run-migrations.sh 2>&1 | tee -a $LOG_FILE; then
        MIGRATION_END_TIME=$(date +%s)
        MIGRATION_DURATION=$((MIGRATION_END_TIME - MIGRATION_START_TIME))
        log_info "✅ 마이그레이션 성공 (${MIGRATION_DURATION}초)"

        # 마이그레이션 상태 저장
        docker exec aigory-blog-prod-backend cat .migration_state.json | tee -a $LOG_FILE || true
    else
        log_error "❌ 마이그레이션 실패!"
        log_error "마이그레이션 로그 확인: docker exec aigory-blog-prod-backend cat .migration_state.json"
        log_error "자동 롤백을 시작합니다..."

        # 롤백 실행
        if [ -f "./scripts/rollback.sh" ]; then
            ./scripts/rollback.sh "migration-failed"
        fi

        exit 1
    fi

    # 8. PM2 설정 및 헬스체크
    log_info "Step 3: PM2 설정 및 헬스체크"

    # PM2 reload 실행
    log_info "PM2 reload 중..."
    docker exec aigory-blog-prod-backend pm2 reload all --update-env

    # PM2 워커 스케일 확인 및 조정
    log_info "PM2 워커 수 확인..."
    CURRENT_WORKERS=$(docker exec aigory-blog-prod-backend pm2 jlist | grep -o '"pm_id":[0-9]*' | wc -l | tr -d ' ')

    if [ "$CURRENT_WORKERS" -lt 4 ]; then
        log_info "PM2 워커 스케일업 (${CURRENT_WORKERS} → 4)"
        docker exec aigory-blog-prod-backend pm2 scale aigory-blog-backend 4
        sleep 5
    fi

    # 헬스체크 (최대 120초)
    log_info "Backend 헬스체크 대기..."
    MAX_WAIT=120
    WAITED=0

    while [ $WAITED -lt $MAX_WAIT ]; do
        if docker exec aigory-blog-prod-backend curl -f http://localhost:3000/internal/health-check-2f4a8b9c >/dev/null 2>&1; then
            log_info "✅ Backend 헬스체크 통과 (${WAITED}초)"
            break
        fi

        # PM2 프로세스 상태 확인
        if ! docker exec aigory-blog-prod-backend pm2 list | grep -q "online"; then
            log_error "PM2 프로세스가 실행되지 않았습니다"
            docker exec aigory-blog-prod-backend pm2 logs --lines 20
            exit 1
        fi

        sleep 2
        WAITED=$((WAITED + 2))
    done

    if [ $WAITED -ge $MAX_WAIT ]; then
        log_error "Backend 헬스체크 실패 (120초 타임아웃)"
        docker exec aigory-blog-prod-backend pm2 logs --lines 50
        exit 1
    fi

    # 9. Frontend 배포
    log_info "Step 4: Frontend 배포"
    docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate frontend

    # Frontend 헬스체크
    log_info "Frontend 헬스체크 대기..."
    sleep 15

    if docker exec aigory-blog-prod-frontend curl -f http://localhost:3000 >/dev/null 2>&1; then
        log_info "✅ Frontend 헬스체크 통과"
    else
        log_warn "Frontend 헬스체크 실패 (계속 진행)"
    fi

    # 10. MCP Proxy 배포
    log_info "Step 5: MCP Proxy 배포"
    docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d --force-recreate mcp-proxy

    # MCP Proxy 헬스체크
    log_info "MCP Proxy 헬스체크 대기..."
    sleep 10

    if docker exec aigory-blog-prod-mcp-proxy curl -f http://localhost:3002/health >/dev/null 2>&1; then
        log_info "✅ MCP Proxy 헬스체크 통과"
    else
        log_warn "MCP Proxy 헬스체크 실패 (계속 진행)"
    fi

    # 11. 최종 상태 확인
    log_info "Step 6: 최종 상태 확인"

    # 컨테이너 상태
    log_info "컨테이너 상태:"
    docker compose -f docker-compose.prod.oracle.yml --env-file .env.production ps

    # PM2 상태
    log_info "PM2 상태:"
    docker exec aigory-blog-prod-backend pm2 status

    # 메모리 사용량
    log_info "메모리 사용량:"
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}"

    # 12. 배포 후 검증
    log_info "Step 7: 배포 후 검증"

    # API 엔드포인트 테스트
    log_info "주요 API 엔드포인트 테스트..."

    # Health endpoint
    if curl -f http://localhost/api/v1/internal/health-check-2f4a8b9c >/dev/null 2>&1; then
        log_info "✅ Health endpoint 통과"
    else
        log_warn "Health endpoint 실패"
    fi

    # Blogs endpoint
    if curl -f http://localhost/api/v1/blogs/public >/dev/null 2>&1; then
        log_info "✅ Blogs API 통과"
    else
        log_warn "Blogs API 실패"
    fi

    # 13. 배포 완료
    DEPLOY_END_TIME=$(date +%s)
    DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))

    write_log "===== 배포 성공 완료: $DEPLOY_ID ====="
    log_info "소요 시간: ${DEPLOY_DURATION}초"
    log_info "완료 시간: $(date)"

    # 14. 정리
    log_info "Step 8: 정리"

    # 7일 이전 된 백업 파일 정리
    find $BACKUP_DIR -name "pre_deploy_*.sql.gz" -mtime +7 -delete 2>/dev/null || true
    log_info "오래된 백업 파일 정리 완료"

    # Docker 불필요 이미지 정리
    docker image prune -f

    write_log "배포 성공: $DEPLOY_ID (소요시간: ${DEPLOY_DURATION}초)"

    # 15. 알림 (선택사항)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"✅ 프로덕션 배포 성공 ($DEPLOY_ID, ${DEPLOY_DURATION}초)\"}" \
    #   YOUR_WEBHOOK_URL

    exit 0
}

# 스크립트 실행
main "$@"