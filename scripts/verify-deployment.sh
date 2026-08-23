#!/bin/bash
# ============================================
# 배포 검증 스크립트
# ============================================
# 용도: Docker 이미지 및 컨테이너가 최신 버전인지 확인
#
# 사용법:
#   ./scripts/verify-deployment.sh
# ============================================

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}         배포 상태 검증${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# 현재 시간
CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")
echo -e "${CYAN}현재 시간: $CURRENT_TIME${NC}"
echo ""

# 1. Git 정보 확인
echo "1. Git 커밋 정보:"
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
COMMIT_TIME=$(git log -1 --format="%cd" --date=format:"%Y-%m-%d %H:%M:%S" 2>/dev/null)
echo -e "   브랜치: ${CYAN}$CURRENT_BRANCH${NC}"
echo -e "   커밋: ${CYAN}$CURRENT_COMMIT${NC}"
echo -e "   커밋 시간: ${CYAN}$COMMIT_TIME${NC}"
echo ""

# 2. Docker 이미지 생성 시간 확인
echo "2. Docker 이미지 빌드 시간:"
IMAGES=("aigory-blog-prod-frontend" "aigory-blog-prod-backend" "aigory-blog-prod-mcp-proxy")
ALL_RECENT=true

for IMAGE in "${IMAGES[@]}"; do
    IMAGE_CREATED=$(docker inspect $IMAGE --format='{{.Created}}' 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ' | cut -d'.' -f1)

    if [ -n "$IMAGE_CREATED" ]; then
        # 이미지 생성 시간을 Unix timestamp로 변환
        IMAGE_TIMESTAMP=$(date -d "$IMAGE_CREATED" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$IMAGE_CREATED" +%s 2>/dev/null)
        CURRENT_TIMESTAMP=$(date +%s)
        TIME_DIFF=$((CURRENT_TIMESTAMP - IMAGE_TIMESTAMP))

        # 10분(600초) 이내에 빌드되었는지 확인
        if [ $TIME_DIFF -lt 600 ]; then
            echo -e "   ${GREEN}✅ $IMAGE: $IMAGE_CREATED (최근 빌드)${NC}"
        else
            HOURS=$((TIME_DIFF / 3600))
            echo -e "   ${YELLOW}⚠️  $IMAGE: $IMAGE_CREATED (${HOURS}시간 전)${NC}"
            ALL_RECENT=false
        fi
    else
        echo -e "   ${RED}❌ $IMAGE: 이미지를 찾을 수 없음${NC}"
        ALL_RECENT=false
    fi
done
echo ""

# 3. 컨테이너 시작 시간 확인
echo "3. 컨테이너 시작 시간:"
CONTAINERS=("aigory-blog-prod-backend" "aigory-blog-prod-frontend" "aigory-blog-prod-mcp-proxy")

for CONTAINER in "${CONTAINERS[@]}"; do
    STARTED=$(docker inspect $CONTAINER --format='{{.State.StartedAt}}' 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ' | cut -d'.' -f1)
    STATUS=$(docker inspect $CONTAINER --format='{{.State.Status}}' 2>/dev/null)

    if [ "$STATUS" = "running" ]; then
        # 시작 시간을 Unix timestamp로 변환
        START_TIMESTAMP=$(date -d "$STARTED" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$STARTED" +%s 2>/dev/null)
        CURRENT_TIMESTAMP=$(date +%s)
        TIME_DIFF=$((CURRENT_TIMESTAMP - START_TIMESTAMP))

        # 10분(600초) 이내에 시작되었는지 확인
        if [ $TIME_DIFF -lt 600 ]; then
            echo -e "   ${GREEN}✅ $CONTAINER: $STARTED (최근 시작)${NC}"
        else
            HOURS=$((TIME_DIFF / 3600))
            echo -e "   ${YELLOW}⚠️  $CONTAINER: $STARTED (${HOURS}시간 전)${NC}"
        fi
    else
        echo -e "   ${RED}❌ $CONTAINER: $STATUS${NC}"
    fi
done
echo ""

# 4. 헬스체크 상태
echo "4. 헬스체크 상태:"
# Backend 헬스체크
if docker exec aigory-blog-prod-backend node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    echo -e "   ${GREEN}✅ Backend: 정상${NC}"
else
    echo -e "   ${RED}❌ Backend: 실패${NC}"
fi

# Frontend 헬스체크
if docker exec aigory-blog-prod-frontend node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    echo -e "   ${GREEN}✅ Frontend: 정상${NC}"
else
    echo -e "   ${RED}❌ Frontend: 실패${NC}"
fi

# MCP Proxy 헬스체크
if docker exec aigory-blog-prod-mcp-proxy node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
    echo -e "   ${GREEN}✅ MCP Proxy: 정상${NC}"
else
    echo -e "   ${RED}❌ MCP Proxy: 실패${NC}"
fi
echo ""

# 5. 컨테이너 내부 코드 버전 확인 (선택사항)
echo "5. 컨테이너 내부 Git 정보 (가능한 경우):"
# Frontend package.json 버전 확인
FRONTEND_VERSION=$(docker exec aigory-blog-prod-frontend cat package.json 2>/dev/null | grep '"version"' | head -1 | cut -d'"' -f4)
if [ -n "$FRONTEND_VERSION" ]; then
    echo -e "   Frontend 버전: ${CYAN}$FRONTEND_VERSION${NC}"
fi

# Backend package.json 버전 확인
BACKEND_VERSION=$(docker exec aigory-blog-prod-backend cat package.json 2>/dev/null | grep '"version"' | head -1 | cut -d'"' -f4)
if [ -n "$BACKEND_VERSION" ]; then
    echo -e "   Backend 버전: ${CYAN}$BACKEND_VERSION${NC}"
fi
echo ""

# 6. PM2 상태 확인
echo "6. PM2 워커 상태:"
PM2_WORKERS=$(docker exec aigory-blog-prod-backend pm2 jlist 2>/dev/null | grep -o '"pm_id":[0-9]*' | wc -l | tr -d ' ')
if [ -n "$PM2_WORKERS" ] && [ "$PM2_WORKERS" -gt 0 ]; then
    echo -e "   ${GREEN}✅ PM2 워커 수: $PM2_WORKERS 개${NC}"
    # PM2 메모리 사용량
    docker exec aigory-blog-prod-backend pm2 status 2>/dev/null | grep "aigory-blog-backend" | head -5
else
    echo -e "   ${RED}❌ PM2 상태를 확인할 수 없음${NC}"
fi
echo ""

# 7. 전체 검증 결과
echo -e "${CYAN}============================================${NC}"
if [ "$ALL_RECENT" = true ]; then
    echo -e "${GREEN}✅ 배포 검증 완료: 모든 이미지가 최신 상태${NC}"
else
    echo -e "${YELLOW}⚠️  배포 검증 경고: 일부 이미지가 오래됨${NC}"
    echo -e "${YELLOW}   다시 배포하려면: ./scripts/deploy-production.sh${NC}"
fi
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}검증 완료 시간: $(date +"%Y-%m-%d %H:%M:%S")${NC}"
echo -e "${CYAN}============================================${NC}"