#!/bin/bash

# MCP 자동 포스팅 부하 테스트 스크립트
# 100명의 동시 사용자가 블로그 포스팅하는 시나리오

echo "🚀 MCP 자동 포스팅 부하 테스트 시작"
echo "📊 시뮬레이션: 100명의 동시 사용자"
echo ""

# 테스트 설정
CONCURRENT_USERS=100
DURATION=60  # 60초 동안 테스트
BASE_URL="http://localhost:8080"
MCP_ENDPOINT="${BASE_URL}/api/v1/mcp"

# 통계 변수
total_requests=0
successful_requests=0
failed_requests=0

# 단일 사용자 시나리오 함수
simulate_user() {
  user_id=$1
  session_id="test-session-${user_id}-$(date +%s)"

  # 1. MCP 초기화 (연결)
  curl -s -X POST "$MCP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Mcp-Session-Id: $session_id" \
    -d '{
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
          "name": "load-test-user-'$user_id'",
          "version": "1.0.0"
        }
      }
    }' > /dev/null 2>&1

  # 2. 인증 요청 시뮬레이션
  curl -s -X POST "$MCP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Mcp-Session-Id: $session_id" \
    -d '{
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/call",
      "params": {
        "name": "authenticate",
        "arguments": {}
      }
    }' > /dev/null 2>&1

  # 3. 포스트 생성 요청 시뮬레이션
  curl -s -X POST "$MCP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Mcp-Session-Id: $session_id" \
    -d '{
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "create_post",
        "arguments": {
          "title": "Load Test Post from User '$user_id'",
          "content_markdown": "# Test Content\n\nThis is a load test post.",
          "tags": ["test", "load-test"]
        }
      }
    }' > /dev/null 2>&1

  # 4. Health check
  curl -s "$BASE_URL/health" > /dev/null 2>&1

  # 5. Metrics 조회
  curl -s "$BASE_URL/metrics" > /dev/null 2>&1
}

# 진행 상황 표시 함수
show_progress() {
  local current=$1
  local total=$2
  local percent=$((current * 100 / total))
  local filled=$((percent / 2))
  local empty=$((50 - filled))

  printf "\r["
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "] %3d%% (%d/%d 사용자)" $percent $current $total
}

echo "📈 단계별 부하 증가 테스트:"
echo ""

# Phase 1: 10명 동시 접속
echo "Phase 1: 10명 동시 접속 (워밍업)"
for i in {1..10}; do
  simulate_user $i &
  show_progress $i 10
  sleep 0.1
done
wait
echo ""
echo "✅ Phase 1 완료"
echo ""

sleep 2

# Phase 2: 50명 동시 접속
echo "Phase 2: 50명 동시 접속 (중간 부하)"
for i in {11..60}; do
  simulate_user $i &
  show_progress $((i-10)) 50
  sleep 0.05
done
wait
echo ""
echo "✅ Phase 2 완료"
echo ""

sleep 2

# Phase 3: 100명 동시 접속 (최대 부하)
echo "Phase 3: 100명 동시 접속 (최대 부하)"
echo "⚠️  시스템 리소스를 집중 모니터링하세요!"
for i in {61..160}; do
  simulate_user $i &
  show_progress $((i-60)) 100
  sleep 0.03
done
wait
echo ""
echo "✅ Phase 3 완료"
echo ""

sleep 2

# Phase 4: 지속적인 트래픽 (60초)
echo "Phase 4: 지속적인 사용자 활동 (60초)"
echo "🔄 실제 사용 패턴 시뮬레이션..."
echo ""

end_time=$(($(date +%s) + 60))
user_counter=161

while [ $(date +%s) -lt $end_time ]; do
  # 5명씩 동시에 요청
  for batch in {1..5}; do
    simulate_user $user_counter &
    user_counter=$((user_counter + 1))
  done

  elapsed=$(($(date +%s) - (end_time - 60)))
  remaining=$((60 - elapsed))
  printf "\r⏱️  남은 시간: %02d초 | 활성 요청: %d개    " $remaining $(jobs -p | wc -l)

  sleep 1
done
wait

echo ""
echo ""
echo "✅ Phase 4 완료"
echo ""

# 최종 메트릭 수집
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 부하 테스트 결과 요약"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Prometheus에서 메트릭 조회
echo "🔍 실시간 서버 상태:"
echo ""

# HTTP 요청 총합
http_total=$(curl -s "http://localhost:9091/api/v1/query?query=sum(mcp_http_requests_total)" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(int(float(data['data']['result'][0]['value'][1])))" 2>/dev/null || echo "N/A")

# 활성 세션
active_sessions=$(curl -s "http://localhost:9091/api/v1/query?query=mcp_sessions_active" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(int(float(data['data']['result'][0]['value'][1])))" 2>/dev/null || echo "0")

# 에러 총합
errors_total=$(curl -s "http://localhost:9091/api/v1/query?query=sum(mcp_errors_total)" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(int(float(data['data']['result'][0]['value'][1])))" 2>/dev/null || echo "0")

# Redis 연결 상태
redis_connected=$(curl -s "http://localhost:9091/api/v1/query?query=mcp_redis_connected" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print('✅ 연결됨' if data['data']['result'][0]['value'][1] == '1' else '❌ 끊김')" 2>/dev/null || echo "N/A")

echo "   📈 총 HTTP 요청: $http_total"
echo "   👥 활성 세션: $active_sessions"
echo "   ❌ 에러 발생: $errors_total"
echo "   🔗 Redis 상태: $redis_connected"
echo ""

# 응답 시간 (P95)
p95_latency=$(curl -s "http://localhost:9091/api/v1/query?query=histogram_quantile(0.95,rate(mcp_http_request_duration_seconds_bucket[5m]))" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); result = data['data']['result']; print(f\"{float(result[0]['value'][1])*1000:.2f}ms\" if result else 'N/A')" 2>/dev/null || echo "N/A")

echo "   ⚡ P95 응답 시간: $p95_latency"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 부하 테스트 완료!"
echo ""
echo "📊 Grafana 대시보드에서 상세 분석:"
echo "   http://localhost:3333/d/mcp-proxy-dashboard"
echo ""
echo "💡 확인 사항:"
echo "   - 활성 세션 수 그래프의 피크값"
echo "   - HTTP 요청률의 급증 패턴"
echo "   - 응답 시간의 변화 (부하 증가 시 지연)"
echo "   - Redis 작업률 증가"
echo "   - 에러 발생 패턴"
echo ""
