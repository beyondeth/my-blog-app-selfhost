#!/bin/bash
# ============================================
# 개발 서버 배포 스크립트
# ============================================
# develop 브랜치 자동 배포
# - 다운타임 허용 (빠른 재시작)
# - 리소스 제한 더 낮게 설정
#
# 사용법:
#   ./scripts/deploy-development.sh
#
# 주의사항:
#   - 개발 서버에서 실행
#   - develop 브랜치 최신 코드 배포
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

# 배포 시작
log_info "=========================================="
log_info "개발 서버 배포 시작: $(date)"
log_info "=========================================="

# 1. Git Pull (develop 브랜치)
log_info "Step 1: Git Pull (develop 브랜치)"
cd /home/ubuntu/my-blog-app || exit 1
git fetch origin develop
git reset --hard origin/develop
log_info "✓ Git Pull 완료"

# 2. 환경 변수 체크
log_info "Step 2: 환경 변수 체크"
if [ ! -f .env.development ]; then
    log_error ".env.development 파일이 없습니다!"
    exit 1
fi
log_info "✓ 환경 변수 확인 완료"

# 3. Docker Compose Down (기존 컨테이너 정리)
log_info "Step 3: 기존 컨테이너 중지"
docker compose -f docker-compose.dev-server.yml down
log_info "✓ 기존 컨테이너 중지 완료"

# 4. Docker 이미지 빌드
log_info "Step 4: Docker 이미지 빌드"
docker compose -f docker-compose.dev-server.yml build
log_info "✓ 이미지 빌드 완료"

# 5. Docker Compose Up
log_info "Step 5: 컨테이너 시작"
docker compose -f docker-compose.dev-server.yml up -d
log_info "✓ 컨테이너 시작 완료"

# 6. 헬스체크 대기
log_info "Step 6: 헬스체크 대기 (30초)"
sleep 30

# 7. 컨테이너 상태 확인
log_info "Step 7: 컨테이너 상태 확인"
docker compose -f docker-compose.dev-server.yml ps

# 8. 배포 완료
log_info "=========================================="
log_info "개발 서버 배포 완료: $(date)"
log_info "=========================================="

exit 0
