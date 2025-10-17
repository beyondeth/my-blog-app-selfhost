#!/bin/bash

# MCP Authenticate Tool 테스트 스크립트
# 전체 OAuth 플로우 (Dynamic Client Registration → Authorization → Token Exchange)

echo "🔐 Testing MCP Authenticate Tool (Full OAuth Flow)..."
echo ""
echo "이 테스트는 다음 단계를 실행합니다:"
echo "1. Dynamic Client Registration (자동)"
echo "2. OAuth Authorization URL 생성"
echo "3. 브라우저 자동 실행 (시뮬레이션)"
echo "4. Authorization Code 받기"
echo "5. Token Exchange"
echo ""

# MCP 서버 상태 확인
echo "📡 Checking MCP Proxy Server..."
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
  echo "✅ MCP Proxy Server is running on port 3002"
else
  echo "❌ MCP Proxy Server is not running"
  exit 1
fi
echo ""

# Step 1: MCP 서버 초기화 (필수)
echo "🔧 Step 1: Initializing MCP server..."
echo ""

# 세션 ID 생성
session_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Session ID: $session_id"
echo ""

# Initialize 요청
init_response=$(curl -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {
        "roots": {
          "listChanged": false
        }
      },
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }')

echo "$init_response" | jq .

if echo "$init_response" | jq -e '.result.protocolVersion' > /dev/null 2>&1; then
  echo ""
  echo "✅ MCP 서버 초기화 성공!"
else
  echo ""
  echo "❌ MCP 서버 초기화 실패"
  exit 1
fi
echo ""
echo "---"
echo ""

# Step 2: Initialized 알림
echo "🔧 Step 2: Sending initialized notification..."
echo ""

initialized_response=$(curl -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized",
    "params": {}
  }')

echo "Initialized notification sent"
echo ""
echo "---"
echo ""

# Step 3: MCP authenticate 도구 호출
echo "🔧 Step 3: Calling MCP authenticate tool..."
echo ""

response=$(curl -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "authenticate",
      "arguments": {}
    },
    "id": 2
  }')

echo "$response" | jq .

# 결과 확인
if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
  echo ""
  echo "✅ MCP authenticate tool 호출 성공!"
  echo ""
  echo "📋 Response Content:"
  echo "$response" | jq -r '.result.content[0].text'
else
  echo ""
  echo "❌ MCP authenticate tool 호출 실패"
  echo ""
  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "Error: $(echo "$response" | jq -r '.error.message')"
  fi
fi

echo ""
echo "---"
echo ""
echo "✨ MCP Authenticate Test Complete!"
