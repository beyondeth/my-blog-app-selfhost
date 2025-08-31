#!/bin/bash

# 블로그 MCP 서버 실행 스크립트 (FastMCP 기반)

# 스크립트가 있는 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 블로그 MCP 서버 시작..."
echo "📁 작업 디렉토리: $(pwd)"
echo "🐍 Python 버전: $(python3 --version 2>/dev/null || echo "Python not found")"

# 가상환경 활성화
if [ -d ".venv" ]; then
    echo "🔧 가상환경 활성화..."
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo "🔧 가상환경 활성화..."
    source venv/bin/activate
else
    echo "❌ 가상환경을 찾을 수 없습니다."
    exit 1
fi

# 환경 변수 확인
if [ -f ".env" ]; then
    echo "✅ .env 파일 발견"
    echo "📧 BLOG_EMAIL: $(grep BLOG_EMAIL .env | cut -d'=' -f2 | head -c 20)..."
    echo "🔑 BLOG_API_KEY: $(grep BLOG_API_KEY .env | cut -d'=' -f2 | head -c 10)..."
    echo "🌐 BLOG_API_URL: $(grep BLOG_API_URL .env | cut -d'=' -f2)"
else
    echo "⚠️ .env 파일이 없습니다."
fi

echo ""
echo "🎯 블로그 MCP 서버 실행 중... (FastMCP 기반)"
echo "   Claude Desktop에서 create_post(), authenticate() 도구를 사용할 수 있습니다."
echo "   중지하려면 Ctrl+C를 누르세요."
echo ""

# 블로그 MCP 서버 실행
python3 src/fastmcp_blog_server.py