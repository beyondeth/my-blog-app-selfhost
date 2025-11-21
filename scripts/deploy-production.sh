#!/bin/bash
# ============================================
# 프로덕션 배포 스크립트 (단순화 버전)
# ============================================
# - 순차적 빌드 (안정성 확보)
# - BuildKit 자동 캐시 활용
# - 단일 빌드 경로
# ============================================

set -e  # 에러 발생 시 즉시 종료
set -x  # 명령어 출력 (SSH 타임아웃 방지)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 배포 시작 시간 기록
DEPLOY_START_TIME=$(date +%s)
log_info "=========================================="
log_info "프로덕션 배포 시작: $(date)"
log_info "=========================================="

# 1. 환경 설정
cd /home/ubuntu/my-blog-app || exit 1

# BuildKit 활성화
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 환경 변수 체크
if [ ! -f .env.production ]; then
    log_error ".env.production 파일이 없습니다!"
    exit 1
fi

log_info "✓ BuildKit 활성화 및 환경 변수 확인 완료"

# 2. 디스크 공간 확인
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -ge 90 ]; then
    log_error "디스크 공간 부족 (${DISK_USAGE}%). 정리 후 다시 시도하세요."
    docker system prune -a -f --volumes || true
    exit 1
fi

log_info "✓ 디스크 공간 충분 (${DISK_USAGE}%)"

# 3. Git 정보 확인
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_info "빌드할 커밋: $CURRENT_COMMIT"

# 4. 순차적 이미지 빌드 (안정성 확보)
log_info "Step 4: Docker 이미지 순차적 빌드"

# Backend 빌드
log_info "1/3 Backend 빌드 중..."
if docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    build backend; then
    log_info "✓ Backend 빌드 완료"
else
    log_error "✗ Backend 빌드 실패"
    exit 1
fi

# Frontend 빌드
log_info "2/3 Frontend 빌드 중..."
if docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    build frontend; then
    log_info "✓ Frontend 빌드 완료"
else
    log_error "✗ Frontend 빌드 실패"
    exit 1
fi

# MCP Proxy 빌드
log_info "3/3 MCP Proxy 빌드 중..."
if docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    build mcp-proxy; then
    log_info "✓ MCP Proxy 빌드 완료"
else
    log_error "✗ MCP Proxy 빌드 실패"
    exit 1
fi

log_info "✓ 모든 이미지 빌드 완료"

# 5. 컨테이너 재시작 (Zero-downtime)
log_info "Step 5: 컨테이너 재시작"

# Backend 먼저 재시작 (PM2 reload)
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate backend

# Backend 헬스체크
log_info "Backend 헬스체크 대기..."
for i in {1..20}; do
    if docker exec codebase-prod-backend curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log_info "✓ Backend 헬스체크 통과"
        break
    fi
    sleep 3
done

# PM2 워커 스케일업 확인
docker exec codebase-prod-backend pm2 scale codebase-backend 4 || true

# 데이터베이스 마이그레이션
docker exec codebase-prod-backend npm run migration:run:prod:nobuild || log_info "마이그레이션 없음"

# Frontend 재시작
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate frontend

# MCP Proxy 재시작
docker compose -f docker-compose.prod.oracle.yml \
    --env-file .env.production \
    up -d --force-recreate mcp-proxy

log_info "✓ 모든 컨테이너 재시작 완료"

# 6. 최종 상태 확인
log_info "Step 6: 최종 상태 확인"
docker compose -f docker-compose.prod.oracle.yml --env-file .env.production ps
docker exec codebase-prod-backend pm2 status

# 7. 배포 완료
DEPLOY_END_TIME=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
log_info "=========================================="
log_info "배포 완료: $(date)"
log_info "소요 시간: ${DEPLOY_DURATION}초"
log_info "커밋: $CURRENT_COMMIT"
log_info "=========================================="

exit 0