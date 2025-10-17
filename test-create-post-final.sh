#!/bin/bash

# MCP create_post 도구 최종 테스트 (올바른 검증 토큰 사용)

echo "📝 Testing MCP create_post Tool (Final Test with Correct Token)..."
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
      "title": "MCP OAuth 2.1 표준 구현 완료",
      "content_markdown": "## 소개\n\nMCP (Model Context Protocol) OAuth 2.1 표준을 완전히 구현했습니다. 이번 구현은 RFC 표준들을 준수하며, LLM 호스트가 자동으로 OAuth 인증 플로우를 실행할 수 있도록 합니다.\n\n## 구현된 기능\n\n### Discovery Metadata (RFC 9728, RFC 8414)\n\nOAuth 인증 서버의 메타데이터를 자동으로 발견할 수 있는 엔드포인트를 구현했습니다. 이를 통해 클라이언트는 하드코딩 없이 동적으로 OAuth 엔드포인트들을 찾을 수 있습니다.\n\n**주요 엔드포인트**:\n- `/.well-known/oauth-authorization-server` - Authorization Server Metadata\n- `/.well-known/oauth-resource-metadata` - Protected Resource Metadata\n\n### Dynamic Client Registration (RFC 7591)\n\nMCP 클라이언트가 수동 등록 없이 자동으로 OAuth 클라이언트로 등록될 수 있습니다. 이는 개발자 경험을 크게 향상시키며, 배포 과정을 단순화합니다.\n\n```typescript\n// 클라이언트 자동 등록 예시\nconst client = await registerClient({\n  client_name: \"MCP Blog Client\",\n  redirect_uris: [\"http://localhost:3002/oauth/callback\"],\n  token_endpoint_auth_method: \"none\", // Public Client\n  grant_types: [\"authorization_code\", \"refresh_token\"]\n});\n```\n\n### PKCE (RFC 7636)\n\nPublic Client의 보안을 강화하기 위해 PKCE (Proof Key for Code Exchange)를 구현했습니다. S256 방식을 사용하여 Authorization Code를 안전하게 교환합니다.\n\n### Resource Indicators (RFC 8707)\n\nOAuth 요청에 `resource` 파라미터를 포함하여 어떤 리소스 서버를 위한 토큰인지 명시할 수 있습니다. 이는 멀티 리소스 환경에서 토큰의 범위를 명확히 합니다.\n\n### WWW-Authenticate 헤더 (RFC 9728)\n\n인증되지 않은 요청에 대해 `WWW-Authenticate` 헤더를 통해 OAuth discovery URL을 제공합니다. LLM 호스트는 이 헤더를 읽어 자동으로 브라우저를 실행하여 OAuth 플로우를 시작할 수 있습니다.\n\n```\nWWW-Authenticate: Bearer resource_metadata=\"http://localhost:3002/.well-known/oauth-resource-metadata\"\n```\n\n## 주요 수정 사항\n\n### Docker 네트워크 URL 변환\n\nMCP Proxy Server가 Docker 내부에서 실행되므로, Discovery로 받은 공개 URL을 내부 Docker URL로 변환하는 로직을 추가했습니다.\n\n**변환 예시**:\n- 공개 URL: `http://localhost:3000/api/v1/oauth/token`\n- 내부 URL: `http://backend:3000/api/v1/oauth/token`\n\n### TokenExchangeDto의 client_secret Optional 처리\n\nPublic Client는 client_secret이 없으므로, DTO에서 이 필드를 optional로 수정했습니다. 이를 통해 PKCE만으로도 안전하게 토큰 교환이 가능합니다.\n\n```typescript\n@IsOptional()\n@IsString()\nclient_secret?: string; // Confidential Client만 필수\n```\n\n## 테스트 결과\n\n전체 OAuth 플로우를 성공적으로 테스트했습니다:\n\n1. ✅ Discovery Endpoints 정상 작동\n2. ✅ Dynamic Client Registration 성공\n3. ✅ PKCE 생성 및 검증 정상\n4. ✅ Authorization Code 발급\n5. ✅ Token Exchange 성공\n6. ✅ 인증된 세션으로 create_post 호출 성공\n\n## 결론\n\nMCP OAuth 2.1 표준을 완전히 구현함으로써, LLM 호스트가 자동으로 OAuth 인증을 처리할 수 있게 되었습니다. 이는 사용자 경험을 크게 개선하며, 보안성도 강화합니다.\n\n**다음 단계**:\n- Refresh Token 자동 갱신 로직 추가\n- Token Revocation 기능 강화\n- 멀티 리소스 서버 지원 확장",
      "tags": ["mcp", "oauth", "rfc", "pkce", "ai:claude"],
      "validationToken": "mcp-style-default-v1-7a9c3f2b",
      "challengeAnswer": "korean"
    }
  },
  "id": 5
}
EOF
)

echo "$response" | jq .

# 결과 확인
if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
  echo ""
  echo "✅ create_post 호출 성공!"
  echo ""
  echo "📋 Response:"
  echo "$response" | jq -r '.result.content[0].text'

  # 포스트 URL 추출 시도
  if echo "$response" | jq -r '.result.content[0].text' | grep -q "http"; then
    echo ""
    echo "🔗 포스트 URL:"
    echo "$response" | jq -r '.result.content[0].text' | grep -o 'http[s]*://[^"]*'
  fi
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
echo "✨ Final create_post Test Complete!"
