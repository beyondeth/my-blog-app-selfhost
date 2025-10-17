#!/bin/bash

echo "🔐 Testing WWW-Authenticate Header Implementation"
echo ""

# Step 1: 세션 ID 생성
session_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Session ID: $session_id"
echo ""

# Step 2: MCP 초기화
echo "📡 Step 1: Initialize MCP server..."
init_response=$(curl -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }')

echo "$init_response" | jq .
echo ""

# Step 3: 인증 없이 create_post 호출 → 401 + WWW-Authenticate 헤더 기대
echo "🔒 Step 2: Call create_post without authentication..."
echo "Expected: 401 Unauthorized with WWW-Authenticate header"
echo ""

# -i 플래그로 헤더 포함
response=$(curl -i -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_post",
      "arguments": {
        "title": "Test",
        "content_markdown": "Test"
      }
    },
    "id": 2
  }')

echo "📋 HTTP Response Headers:"
echo "$response" | grep -E "(HTTP/|WWW-Authenticate|Mcp-Session-Id)" | head -10
echo ""

echo "📋 Response Body:"
echo "$response" | tail -n +10 | jq . 2>/dev/null || echo "$response" | tail -n +10
echo ""

# WWW-Authenticate 헤더 확인
if echo "$response" | grep -q "WWW-Authenticate"; then
  echo "✅ WWW-Authenticate header found!"
  echo ""
  echo "📝 Header value:"
  echo "$response" | grep "WWW-Authenticate"
else
  echo "❌ WWW-Authenticate header NOT found!"
  echo ""
  echo "⚠️  This header is required for MCP OAuth 2.1 standard."
  echo "    LLM hosts need this to auto-launch browser."
fi

echo ""
echo "---"
echo ""
echo "✨ WWW-Authenticate Header Test Complete!"
