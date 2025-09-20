#!/bin/bash

# 메트릭 보안 테스트 스크립트
# 모든 보안 조치가 제대로 작동하는지 확인

echo "================================================"
echo "메트릭 엔드포인트 보안 테스트"
echo "================================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 결과 카운터
PASSED=0
FAILED=0

# 테스트 함수
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="$3"
    local description="$4"

    echo -e "${YELLOW}테스트:${NC} $test_name"
    echo "설명: $description"
    echo "명령어: $command"

    # 명령 실행 및 상태 코드 캡처
    response=$(eval "$command" 2>&1)
    actual_status=$?

    # curl 명령의 경우 HTTP 상태 코드 추출
    if [[ "$command" == *"curl"* ]]; then
        http_status=$(echo "$command" | sed 's/-o \/dev\/null//' | eval 2>&1 | tail -n 1)

        if [[ "$http_status" == *"$expected_status"* ]]; then
            echo -e "${GREEN}✅ PASSED${NC} - 예상된 상태: $expected_status"
            ((PASSED++))
        else
            echo -e "${RED}❌ FAILED${NC} - 예상: $expected_status, 실제: $http_status"
            ((FAILED++))
        fi
    fi

    echo "응답 일부: ${response:0:100}..."
    echo "----------------------------------------"
    echo ""
}

echo "1. 기본 /metrics 엔드포인트 테스트 (404 예상)"
echo "================================================"
run_test \
    "외부에서 /metrics 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/metrics" \
    "404" \
    "누구나 예상할 수 있는 /metrics 경로는 404를 반환해야 함"

echo ""
echo "2. 숨겨진 메트릭 엔드포인트 테스트"
echo "================================================"

# .env 파일에서 실제 경로 읽기
if [ -f backend/.env ]; then
    METRICS_PATH=$(grep METRICS_PATH backend/.env | cut -d '=' -f2)
    if [ -z "$METRICS_PATH" ]; then
        METRICS_PATH="/internal/health-check-2f4a8b9c"
    fi
else
    METRICS_PATH="/internal/health-check-2f4a8b9c"
fi

echo "숨겨진 경로: $METRICS_PATH"
echo ""

run_test \
    "localhost에서 숨겨진 경로 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$METRICS_PATH" \
    "200" \
    "localhost/127.0.0.1에서는 접근 가능해야 함"

# 외부 IP 테스트 (실제 외부 IP가 있다면)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")
if [ ! -z "$EXTERNAL_IP" ]; then
    run_test \
        "외부 IP에서 숨겨진 경로 접근" \
        "curl -s -o /dev/null -w '%{http_code}' http://$EXTERNAL_IP:3000$METRICS_PATH" \
        "404" \
        "외부 IP에서는 404를 반환해야 함"
fi

echo ""
echo "3. Admin 메트릭 대시보드 테스트"
echo "================================================"

run_test \
    "인증 없이 Admin 대시보드 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/admin/monitoring/dashboard" \
    "401" \
    "인증되지 않은 사용자는 401 Unauthorized"

run_test \
    "인증 없이 Admin Raw 메트릭 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/admin/monitoring/raw" \
    "401" \
    "인증되지 않은 사용자는 401 Unauthorized"

echo ""
echo "4. Docker 포트 바인딩 테스트"
echo "================================================"

# Docker 컨테이너가 실행 중인지 확인
if docker ps | grep -q chat-prometheus; then
    echo "Prometheus 컨테이너 실행 중..."

    # netstat 또는 ss 명령으로 포트 바인딩 확인
    if command -v netstat &> /dev/null; then
        echo "포트 바인딩 상태 (netstat):"
        netstat -an | grep -E ":(9090|3030|9121|9100)" | grep LISTEN
    elif command -v ss &> /dev/null; then
        echo "포트 바인딩 상태 (ss):"
        ss -tlnp | grep -E ":(9090|3030|9121|9100)"
    fi

    echo ""
    echo "✅ 모든 포트가 127.0.0.1에만 바인딩되어 있어야 합니다."
else
    echo "⚠️  모니터링 컨테이너가 실행되지 않음"
    echo "실행: docker-compose -f docker-compose.monitoring.yml up -d"
fi

echo ""
echo "5. Prometheus 직접 접근 테스트"
echo "================================================"

run_test \
    "localhost에서 Prometheus 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/metrics" \
    "200" \
    "localhost에서는 Prometheus 접근 가능"

echo ""
echo "6. Grafana 직접 접근 테스트"
echo "================================================"

run_test \
    "localhost에서 Grafana 접근" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3030/login" \
    "200" \
    "localhost에서는 Grafana 접근 가능"

echo ""
echo "================================================"
echo "테스트 결과 요약"
echo "================================================"
echo -e "${GREEN}통과:${NC} $PASSED"
echo -e "${RED}실패:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 보안 테스트를 통과했습니다!${NC}"
    echo ""
    echo "보안 구성 요약:"
    echo "1. /metrics → 404 (모든 사용자)"
    echo "2. $METRICS_PATH → IP 제한 (localhost만)"
    echo "3. /api/v1/admin/monitoring/* → Admin 권한 필요"
    echo "4. Prometheus:9090 → localhost 바인딩"
    echo "5. Grafana:3030 → localhost 바인딩"
    echo "6. Exporters → localhost 바인딩"
else
    echo -e "${RED}⚠️  일부 테스트가 실패했습니다. 위 결과를 확인하세요.${NC}"
fi

echo ""
echo "📝 추가 수동 테스트 권장사항:"
echo "1. Admin 계정으로 로그인 후 /api/v1/admin/monitoring/dashboard 접근"
echo "2. 일반 사용자 계정으로 같은 엔드포인트 접근 시도 (403 예상)"
echo "3. 외부 네트워크에서 포트 9090, 3030 접근 시도 (연결 거부 예상)"