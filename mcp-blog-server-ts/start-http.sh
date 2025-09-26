#!/bin/bash

# MCP 블로그 서버를 HTTP 모드로 실행하는 스크립트
# HTTP transport를 사용하여 Base64 인코딩 없이 대용량 텍스트 전송 가능

echo "🚀 MCP Blog Server를 HTTP 모드로 시작합니다..."
echo "📍 Port: 3002"
echo "🌐 Endpoint: http://localhost:3002/mcp"
echo ""

# 환경 변수 설정
export NODE_ENV=development

# dist 폴더 확인
if [ ! -d "dist" ]; then
  echo "⚠️  dist 폴더가 없습니다. 빌드를 먼저 실행합니다..."
  pnpm build
fi

# HTTP 모드로 서버 실행
# --transport http: HTTP transport 사용
# --port 3002: 3002 포트에서 실행
echo "🔄 서버 시작 중..."
node dist/index.js --transport http --port 3002