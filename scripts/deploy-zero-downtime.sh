#!/bin/bash

# ================================================
# Zero-Downtime Deployment Script for Blog App
# ================================================
# 
# 사용법: ./deploy-zero-downtime.sh
# 
# 요구사항:
# - PM2가 설치되어 있어야 함
# - ecosystem.config.js 파일이 있어야 함
# - Git repository가 설정되어 있어야 함
#
# ================================================

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 설정
APP_DIR="/home/ec2-user/app"
BACKUP_DIR="/home/ec2-user/backups"
MAX_WAIT_TIME=30
HEALTH_CHECK_URL="http://localhost/health"

# 함수: 로그 출력
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 함수: 헬스체크
health_check() {
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s $HEALTH_CHECK_URL > /dev/null 2>&1; then
            return 0
        fi
        log "헬스체크 재시도 중... ($attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    return 1
}

# 함수: 현재 상태 백업
backup_current_state() {
    log "현재 상태 백업 중..."
    
    # 백업 디렉토리 생성
    BACKUP_DATE=$(date +'%Y%m%d_%H%M%S')
    CURRENT_BACKUP="$BACKUP_DIR/deploy_$BACKUP_DATE"
    mkdir -p "$CURRENT_BACKUP"
    
    # Git 커밋 해시 저장
    git rev-parse HEAD > "$CURRENT_BACKUP/commit_hash.txt"
    
    # PM2 상태 저장
    pm2 save
    
    # 환경 변수 백업
    cp .env.production "$CURRENT_BACKUP/.env.production.backup" 2>/dev/null || true
    
    log "백업 완료: $CURRENT_BACKUP"
}

# 함수: 롤백
rollback() {
    error "배포 실패! 롤백 시작..."
    
    if [ -f "$CURRENT_BACKUP/commit_hash.txt" ]; then
        PREVIOUS_COMMIT=$(cat "$CURRENT_BACKUP/commit_hash.txt")
        git reset --hard "$PREVIOUS_COMMIT"
        
        # 환경 변수 복원
        if [ -f "$CURRENT_BACKUP/.env.production.backup" ]; then
            cp "$CURRENT_BACKUP/.env.production.backup" .env.production
        fi
        
        # PM2 재시작
        pm2 reload all
        
        warning "롤백 완료: 커밋 $PREVIOUS_COMMIT"
    else
        error "백업을 찾을 수 없습니다. 수동 복구가 필요합니다."
    fi
    
    exit 1
}

# ================================================
# 메인 배포 프로세스
# ================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   무중단 배포 시작${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 사전 체크
log "사전 체크 수행 중..."

# PM2 실행 확인
if ! pm2 status > /dev/null 2>&1; then
    error "PM2가 실행되고 있지 않습니다"
    exit 1
fi

# 헬스체크
if ! health_check; then
    warning "초기 헬스체크 실패. 계속하시겠습니까? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi

# 2. 백업
backup_current_state

# 3. 코드 업데이트
log "코드 업데이트 중..."
CURRENT_COMMIT=$(git rev-parse HEAD)

git fetch origin
git pull origin main || {
    error "Git pull 실패"
    rollback
}

NEW_COMMIT=$(git rev-parse HEAD)

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    log "이미 최신 버전입니다. 배포를 건너뜁니다."
    exit 0
fi

log "업데이트됨: $CURRENT_COMMIT → $NEW_COMMIT"

# 4. Backend 의존성 설치 및 빌드
log "Backend 의존성 설치 중..."
cd backend
if ! pnpm install --frozen-lockfile --prefer-offline; then
    error "Backend 의존성 설치 실패"
    cd ..
    rollback
fi

log "Backend 빌드 중..."
if ! pnpm build; then
    error "Backend 빌드 실패"
    cd ..
    rollback
fi

# 5. Frontend 의존성 설치 및 빌드
log "Frontend 의존성 설치 중..."
cd ../frontend
if ! pnpm install --frozen-lockfile --prefer-offline; then
    error "Frontend 의존성 설치 실패"
    cd ..
    rollback
fi

log "Frontend 빌드 중..."
if ! pnpm build; then
    error "Frontend 빌드 실패"
    cd ..
    rollback
fi

# 6. 데이터베이스 마이그레이션
log "데이터베이스 마이그레이션 실행 중..."
cd ../backend
pnpm migration:run || {
    warning "마이그레이션 실행 중 경고가 발생했습니다. 계속합니다..."
}

# 7. PM2 무중단 재시작
cd ..
log "Backend 프로세스 재시작 중..."

# Backend 클러스터 모드 재시작 (순차적으로)
if pm2 list | grep -q "blog-backend"; then
    pm2 reload blog-backend --update-env
    sleep 3
else
    warning "blog-backend 프로세스를 찾을 수 없습니다. 시작합니다..."
    pm2 start ecosystem.config.js --only blog-backend --env production
fi

log "Frontend 프로세스 재시작 중..."

# Frontend 재시작
if pm2 list | grep -q "blog-frontend"; then
    pm2 reload blog-frontend --update-env
    sleep 2
else
    warning "blog-frontend 프로세스를 찾을 수 없습니다. 시작합니다..."
    pm2 start ecosystem.config.js --only blog-frontend --env production
fi

# 8. Redis 캐시 정리 (선택적)
log "캐시 정리 중..."
redis-cli FLUSHDB > /dev/null 2>&1 || warning "Redis 캐시 정리 실패 (계속 진행)"

# 9. Nginx 재로드
log "Nginx 설정 재로드 중..."
sudo nginx -t && sudo nginx -s reload || warning "Nginx 재로드 실패"

# 10. 배포 검증
log "배포 검증 중..."
sleep 5

if health_check; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ 무중단 배포 성공!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # PM2 상태 출력
    pm2 status
    
    # 배포 정보 기록
    echo "배포 시간: $(date)" >> "$BACKUP_DIR/deployment.log"
    echo "커밋: $NEW_COMMIT" >> "$BACKUP_DIR/deployment.log"
    echo "---" >> "$BACKUP_DIR/deployment.log"
    
    # 오래된 백업 정리 (7일 이상)
    find "$BACKUP_DIR" -name "deploy_*" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    
else
    error "배포 후 헬스체크 실패!"
    rollback
fi

log "배포 완료 시간: $(date)"
exit 0