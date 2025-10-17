#!/bin/bash

# MCP OAuth 2.1 Discovery Endpoints 테스트 스크립트

echo "🔍 Testing MCP OAuth 2.1 Discovery Endpoints..."
echo ""

# Test 1: Protected Resource Metadata (RFC 9728)
echo "📋 Test 1: Protected Resource Metadata (RFC 9728)"
echo "URL: http://localhost:3000/.well-known/oauth-protected-resource"
echo ""
curl -s http://localhost:3000/.well-known/oauth-protected-resource | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 2: Authorization Server Metadata (RFC 8414)
echo "📋 Test 2: Authorization Server Metadata (RFC 8414)"
echo "URL: http://localhost:3000/.well-known/oauth-authorization-server"
echo ""
curl -s http://localhost:3000/.well-known/oauth-authorization-server | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 3: Verify endpoints are accessible
echo "📋 Test 3: Verify All Endpoints"
echo ""

endpoints=(
  "/.well-known/oauth-protected-resource"
  "/.well-known/oauth-authorization-server"
  "/api/v1/oauth/authorize"
  "/api/v1/oauth/token"
  "/api/v1/oauth/introspect"
  "/api/v1/oauth/revoke"
)

for endpoint in "${endpoints[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint")
  if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "400" ]; then
    echo "✅ $endpoint - Status: $status (OK)"
  else
    echo "❌ $endpoint - Status: $status (Failed)"
  fi
done

echo ""
echo "✨ Discovery Endpoints Test Complete!"
