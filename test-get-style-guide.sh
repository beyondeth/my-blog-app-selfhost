#!/bin/bash

# MCP get_writing_style_guide 도구 테스트 스크립트

echo "📖 Testing MCP get_writing_style_guide Tool..."
echo ""

SESSION_ID="5528c85f-4fa3-4d2e-ab62-60b095a544ba"

echo "🔧 Calling get_writing_style_guide with session: $SESSION_ID"
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
    "name": "get_writing_style_guide",
    "arguments": {
      "style": "default"
    }
  },
  "id": 4
}
EOF
)

echo "$response" | jq .

# 결과 확인
if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
  echo ""
  echo "✅ get_writing_style_guide 호출 성공!"
  echo ""
  echo "📋 Response Content (first 500 chars):"
  echo "$response" | jq -r '.result.content[0].text' | head -c 500
  echo "..."
else
  echo ""
  echo "❌ get_writing_style_guide 호출 실패"
fi

echo ""
echo "---"
echo ""
echo "✨ get_writing_style_guide Test Complete!"
