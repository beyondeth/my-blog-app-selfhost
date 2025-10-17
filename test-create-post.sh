#!/bin/bash

# MCP create_post 도구 테스트 스크립트
# 인증된 세션으로 블로그 포스트 생성

echo "📝 Testing MCP create_post Tool (Authenticated Session)..."
echo ""

SESSION_ID="5528c85f-4fa3-4d2e-ab62-60b095a544ba"

echo "🔧 Calling create_post with session: $SESSION_ID"
echo ""

response=$(curl -s -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d @- <<'EOF'
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_post",
    "arguments": {
      "title": "MCP OAuth 2.1 테스트 포스트",
      "content_markdown": "## 소개\n\nMCP OAuth 2.1 표준을 구현한 테스트 포스트입니다.\n\n## 주요 기능\n\n- Dynamic Client Registration (RFC 7591)\n- PKCE (RFC 7636)\n- Resource Indicators (RFC 8707)\n- Discovery Metadata (RFC 9728, RFC 8414)\n\n## 결론\n\n모든 OAuth 플로우가 정상적으로 작동합니다!",
      "tags": ["mcp", "oauth", "test", "ai:claude"],
      "validationToken": "writing-style-default-2025-v1",
      "challengeAnswer": "Claude Code MCP Proxy를 통한 자동 블로그 포스팅 시스템"
    }
  },
  "id": 3
}
EOF
)

echo "$response" | jq .

# 결과 확인
if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
  echo ""
  echo "✅ create_post 호출 성공!"
  echo ""
  echo "📋 Response Content:"
  echo "$response" | jq -r '.result.content[0].text'
else
  echo ""
  echo "❌ create_post 호출 실패"
  echo ""
  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "Error: $(echo "$response" | jq -r '.error.message')"
  fi
fi

echo ""
echo "---"
echo ""
echo "✨ create_post Test Complete!"
