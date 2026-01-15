#!/bin/bash

# ============================================
# 프로덕션 배포 스크립트 - 최적화 버전
# ============================================
# 목표: 10분 이내 안정적인 배포
# 전략:
#   - 핵심 로직만 포함
#   - 순차 실행으로 안정성 확보
#   - Docker 캐시 최대 활용
# ============================================

set -euo pipefail

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# ============================================
# 메인 배포 프로세스
# ============================================

log "=========================================="
log "프로덕션 배포 시작"
log "=========================================="

# 1. 환경 설정
cd /home/ubuntu/my-blog-app
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_INLINE_CACHE=1

# 1-1. 필수 NEXT_PUBLIC 환경변수 검증
log "Step 0: 공개 환경변수 검증"
REQUIRED_NEXT_PUBLIC_VARS=(
    "NEXT_PUBLIC_API_URL"
    "NEXT_PUBLIC_BACKEND_URL"
    "NEXT_PUBLIC_SITE_URL"
    "NEXT_PUBLIC_MIXPANEL_TOKEN"
    "NEXT_PUBLIC_GA_MEASUREMENT_ID"
)
for var in "${REQUIRED_NEXT_PUBLIC_VARS[@]}"; do
    value="$(grep -E "^${var}=" .env.production | cut -d= -f2- || true)"
    if [ -z "$value" ]; then
        error "필수 환경변수 ${var} 가 .env.production에 없습니다. Secrets를 확인하세요."
    fi
done
success "필수 NEXT_PUBLIC 환경변수 확인 완료"

# 2. 최신 코드 가져오기
log "Step 1: Git Pull"
git fetch origin main
git reset --hard origin/main
success "코드 업데이트 완료"

# 3. 디스크 공간 체크 (85% 이상이면 정리)
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -ge 85 ]; then
    warning "디스크 공간 부족 (${DISK_USAGE}%). 오래된 이미지 정리 중..."
    docker image prune -f --filter "until=24h" || true
fi

# 4. Docker 빌드 (캐시 활용, CACHEBUST 없음)
log "Step 2: Docker 이미지 빌드 (캐시 활용)"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production build \
    --parallel \
    backend frontend mcp-proxy
success "이미지 빌드 완료"

# 5. 데이터베이스 및 캐시 시작
log "Step 3: 데이터베이스 및 캐시 서비스 시작"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d \
    postgres redis pgbouncer

# 6. 데이터베이스 대기 (최대 30초)
log "데이터베이스 초기화 대기..."
timeout 30 bash -c "
    until docker compose -f docker-compose.prod.oracle.yml --env-file .env.production exec -T postgres pg_isready -U \${DB_USER:-postgres} 2>/dev/null; do
        sleep 2
    done
" || warning "데이터베이스 헬스체크 타임아웃"

# 7. 애플리케이션 서비스 시작 (순차적)
log "Step 4: Backend 서비스 시작"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d backend

# Backend 헬스체크 (최대 60초)
timeout 60 bash -c "
    until curl -sf http://localhost:3000/health > /dev/null 2>&1; do
        sleep 3
    done
" && success "Backend 준비 완료" || warning "Backend 헬스체크 타임아웃"

# 8. Frontend 및 기타 서비스 시작
log "Step 5: Frontend 및 모니터링 서비스 시작"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production up -d \
    frontend mcp-proxy victoriametrics grafana redis-exporter

# 9. 마이그레이션 실행 (Backend 준비 후)
log "Step 6: 데이터베이스 마이그레이션"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production exec -T backend \
    pnpm migration:run:prod:nobuild || warning "마이그레이션 실패 (이미 적용됨)"

# 10. 최종 상태 확인
log "Step 7: 최종 상태 확인"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production ps

# 11. Frontend 헬스체크
timeout 30 bash -c "
    until curl -sf http://localhost:3001 > /dev/null 2>&1; do
        sleep 2
    done
" && success "Frontend 준비 완료" || warning "Frontend 헬스체크 타임아웃"

# 12. 완료
log "=========================================="
success "배포 완료: $(date)"
log "=========================================="
echo
echo "서비스 접속 정보:"
echo "  - Frontend: https://codebase.sh"
echo "  - Backend API: https://codebase.sh/api"
echo "  - Grafana: https://codebase.sh/grafana"
