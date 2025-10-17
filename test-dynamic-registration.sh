#!/bin/bash

# Dynamic Client Registration (RFC 7591) 테스트 스크립트

echo "🔐 Testing Dynamic Client Registration (RFC 7591)..."
echo ""

# Test 1: Public Client 등록 (MCP 표준)
echo "📋 Test 1: Register Public Client (MCP Standard)"
echo "POST http://localhost:3000/api/v1/oauth/register"
echo ""

response=$(curl -s -X POST http://localhost:3000/api/v1/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "MCP Blog Client (Public)",
    "redirect_uris": ["http://localhost:3002/oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
    "scope": "mcp:post:create"
  }')

echo "$response" | python3 -m json.tool
echo ""

# client_id 추출
client_id=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('client_id', ''))")

if [ -n "$client_id" ]; then
  echo "✅ Public Client 등록 성공!"
  echo "   Client ID: $client_id"
  echo "   Auth Method: none (PKCE 사용)"
  echo ""
else
  echo "❌ Public Client 등록 실패"
  echo ""
fi

echo "---"
echo ""

# Test 2: Confidential Client 등록
echo "📋 Test 2: Register Confidential Client"
echo "POST http://localhost:3000/api/v1/oauth/register"
echo ""

response2=$(curl -s -X POST http://localhost:3000/api/v1/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "MCP Blog Client (Confidential)",
    "redirect_uris": ["http://localhost:3002/oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "client_secret_post",
    "scope": "mcp:post:create"
  }')

echo "$response2" | python3 -m json.tool
echo ""

# client_secret 확인
client_secret=$(echo "$response2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('client_secret', ''))")

if [ -n "$client_secret" ]; then
  echo "✅ Confidential Client 등록 성공!"
  echo "   Client ID: $(echo "$response2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('client_id', ''))")"
  echo "   Client Secret: ${client_secret:0:10}... (truncated)"
  echo "   Auth Method: client_secret_post"
  echo ""
else
  echo "❌ Confidential Client 등록 실패"
  echo ""
fi

echo "---"
echo ""

# Test 3: 잘못된 Redirect URI 테스트 (보안 검증)
echo "📋 Test 3: Invalid Redirect URI (Security Test)"
echo "POST http://localhost:3000/api/v1/oauth/register"
echo ""

response3=$(curl -s -X POST http://localhost:3000/api/v1/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Invalid Client",
    "redirect_uris": ["https://evil.com/callback"],
    "token_endpoint_auth_method": "none"
  }')

echo "$response3" | python3 -m json.tool
echo ""

if echo "$response3" | grep -q "localhost"; then
  echo "✅ 보안 검증 성공: localhost가 아닌 URI 차단됨"
else
  echo "⚠️ 보안 검증 필요: 외부 URI가 허용되었습니다"
fi

echo ""
echo "---"
echo ""
echo "✨ Dynamic Client Registration Test Complete!"
echo ""
echo "📝 참고사항:"
echo "- Public Client: PKCE 사용, client_secret 없음 (MCP 권장)"
echo "- Confidential Client: client_secret 사용 (서버 환경)"
echo "- Redirect URI: localhost 또는 127.0.0.1만 허용 (보안)"
