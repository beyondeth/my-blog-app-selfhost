#!/bin/bash

# ============================================
# Frontend Docker 빌드 벤치마크 스크립트
# ============================================
# 목적: 각 Dockerfile 버전의 빌드 시간 측정
# 사용법: bash scripts/benchmark-frontend-build.sh
# ============================================

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 로그 함수
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

header() {
    echo -e "\n${MAGENTA}============================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}============================================${NC}\n"
}

# BuildKit 환경 설정
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain
export COMPOSE_DOCKER_CLI_BUILD=1

# 환경 변수 (테스트용)
export NEXT_PUBLIC_API_URL="http://localhost:3000/api/v1"
export NEXT_PUBLIC_BACKEND_URL="http://localhost:3000"
export NEXT_PUBLIC_SITE_URL="http://localhost:3001"
export NEXT_PUBLIC_MIXPANEL_TOKEN="test"
export NEXT_PUBLIC_GA_MEASUREMENT_ID="test"

# 프로젝트 디렉토리
PROJECT_DIR="$(dirname "$(dirname "$(realpath "$0")")")"
FRONTEND_DIR="$PROJECT_DIR/frontend"

cd "$FRONTEND_DIR"

# 결과 저장 배열
declare -A BUILD_TIMES

# Docker 캐시 정리 함수
clean_docker_cache() {
    log "Docker 캐시 정리 중..."
    docker builder prune -af > /dev/null 2>&1 || true
    success "캐시 정리 완료"
}

# 빌드 시간 측정 함수
benchmark_build() {
    local dockerfile=$1
    local tag=$2
    local description=$3

    header "$description"

    log "빌드 시작: $dockerfile"

    # 시간 측정 시작
    START_TIME=$(date +%s)

    # Docker 빌드 실행
    if docker build \
        -f "$dockerfile" \
        -t "codebase-frontend:$tag" \
        --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
        --build-arg NEXT_PUBLIC_BACKEND_URL="$NEXT_PUBLIC_BACKEND_URL" \
        --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
        --build-arg NEXT_PUBLIC_MIXPANEL_TOKEN="$NEXT_PUBLIC_MIXPANEL_TOKEN" \
        --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID="$NEXT_PUBLIC_GA_MEASUREMENT_ID" \
        . > /tmp/docker-build-$tag.log 2>&1; then

        # 시간 측정 종료
        END_TIME=$(date +%s)
        ELAPSED=$((END_TIME - START_TIME))

        success "빌드 성공! 소요 시간: ${ELAPSED}초"
        BUILD_TIMES["$tag"]=$ELAPSED

        # 이미지 크기 확인
        IMAGE_SIZE=$(docker images "codebase-frontend:$tag" --format "{{.Size}}")
        log "이미지 크기: $IMAGE_SIZE"

        # node_modules COPY 시간 추출 (있는 경우)
        if grep -q "COPY --from=deps /app/node_modules" /tmp/docker-build-$tag.log 2>/dev/null; then
            warning "node_modules COPY 단계 포함됨"
        fi

    else
        error "빌드 실패: $dockerfile"
        cat /tmp/docker-build-$tag.log
        return 1
    fi
}

# 메인 실행
main() {
    header "Frontend Docker 빌드 벤치마크"

    log "환경 정보:"
    echo "  - Docker Version: $(docker --version)"
    echo "  - BuildKit: Enabled"
    echo "  - Platform: $(uname -m)"
    echo "  - Available Memory: $(free -h | grep Mem | awk '{print $7}')"

    # 1. 캐시 없는 상태에서 테스트
    header "테스트 1: 캐시 없는 초기 빌드"

    clean_docker_cache

    # 원본 Dockerfile 테스트
    benchmark_build "Dockerfile.prod" "original" "원본 Dockerfile (멀티스테이지)"

    # 캐시 정리
    clean_docker_cache

    # Phase 1 최적화 테스트
    benchmark_build "Dockerfile.prod" "phase1" "Phase 1 최적화 (pnpm 캐시 마운트)"

    # 캐시 정리
    clean_docker_cache

    # V2 테스트 (Phase 2)
    if [ -f "Dockerfile.prod.v2" ]; then
        benchmark_build "Dockerfile.prod.v2" "v2" "V2 최적화 (단일 빌드 스테이지)"
    fi

    # 캐시 정리
    clean_docker_cache

    # V3 테스트 (극한 최적화)
    if [ -f "Dockerfile.prod.v3" ]; then
        benchmark_build "Dockerfile.prod.v3" "v3" "V3 극한 최적화 (BuildKit 극대화)"
    fi

    # 2. 캐시 있는 상태에서 재테스트
    header "테스트 2: 캐시 활용 재빌드"

    # V3로 캐시 생성
    if [ -f "Dockerfile.prod.v3" ]; then
        log "소스 코드 변경 시뮬레이션..."
        echo "// Benchmark test $(date)" >> src/app/page.tsx

        benchmark_build "Dockerfile.prod.v3" "v3-cached" "V3 캐시 활용 재빌드"

        # 변경 사항 되돌리기
        git checkout -- src/app/page.tsx 2>/dev/null || true
    fi

    # 결과 요약
    header "벤치마크 결과 요약"

    echo -e "${CYAN}빌드 시간 비교:${NC}"
    echo "================================================"
    printf "%-20s | %-15s | %-10s\n" "버전" "빌드 시간" "개선율"
    echo "================================================"

    ORIGINAL_TIME=${BUILD_TIMES["original"]:-0}

    for tag in original phase1 v2 v3 v3-cached; do
        if [ -n "${BUILD_TIMES[$tag]:-}" ]; then
            TIME=${BUILD_TIMES[$tag]}
            if [ "$ORIGINAL_TIME" -gt 0 ] && [ "$tag" != "original" ]; then
                IMPROVEMENT=$(( (ORIGINAL_TIME - TIME) * 100 / ORIGINAL_TIME ))
                printf "%-20s | %-15s | ${GREEN}%d%% 개선${NC}\n" "$tag" "${TIME}초" "$IMPROVEMENT"
            else
                printf "%-20s | %-15s | -\n" "$tag" "${TIME}초"
            fi
        fi
    done

    echo "================================================"

    # 권장사항
    header "권장사항"

    BEST_TIME=999999
    BEST_VERSION=""

    for tag in phase1 v2 v3; do
        if [ -n "${BUILD_TIMES[$tag]:-}" ]; then
            if [ "${BUILD_TIMES[$tag]}" -lt "$BEST_TIME" ]; then
                BEST_TIME="${BUILD_TIMES[$tag]}"
                BEST_VERSION="$tag"
            fi
        fi
    done

    if [ -n "$BEST_VERSION" ]; then
        success "가장 빠른 버전: $BEST_VERSION (${BEST_TIME}초)"

        case "$BEST_VERSION" in
            "phase1")
                echo "✅ Phase 1 최적화 사용 권장 (안정적)"
                ;;
            "v2")
                echo "✅ V2 사용 권장 (균형잡힌 최적화)"
                ;;
            "v3")
                echo "✅ V3 사용 권장 (최고 성능)"
                ;;
        esac
    fi

    # 로그 파일 위치
    echo
    log "상세 빌드 로그: /tmp/docker-build-*.log"
}

# 스크립트 실행
main "$@"