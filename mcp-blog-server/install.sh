#!/bin/bash

# 🚀 Blog MCP 원클릭 설치 스크립트
# macOS & Linux 지원

set -e  # 에러 시 스크립트 중단

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로고
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║           🚀 Blog MCP Installer          ║"
echo "║              원클릭 설치                 ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# 스크립트 위치로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}📂 설치 위치: $SCRIPT_DIR${NC}"

# Python 3 확인
echo -e "${BLUE}🔍 Python 환경 확인 중...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3가 설치되지 않았습니다.${NC}"
    echo "   Homebrew로 설치: brew install python"
    echo "   또는 python.org에서 다운로드하세요."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION 발견${NC}"

# 가상환경 생성/활성화
echo -e "${BLUE}🐍 Python 가상환경 설정 중...${NC}"
if [ ! -d "venv" ]; then
    echo "   가상환경 생성 중..."
    python3 -m venv venv
fi

source venv/bin/activate
echo -e "${GREEN}✅ 가상환경 활성화 완료${NC}"

# 의존성 설치 (최소한만)
echo -e "${BLUE}📦 필수 패키지 설치 중...${NC}"
cat > requirements.txt << EOF
# 최소 의존성으로 최적화
mcp>=1.0.0
aiohttp>=3.8.0
python-dotenv>=0.19.0
EOF

pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
echo -e "${GREEN}✅ 패키지 설치 완료${NC}"

# .env 파일 생성 (사용자 입력)
echo -e "${BLUE}🔐 환경 설정 중...${NC}"

if [ ! -f ".env" ]; then
    echo "환경 변수를 설정합니다:"
    
    read -p "📧 블로그 이메일: " BLOG_EMAIL
    read -s -p "🔑 블로그 비밀번호: " BLOG_PASSWORD
    echo
    read -p "🗝️  API 키: " BLOG_API_KEY
    read -p "🌐 API URL (기본값: http://localhost:3000): " BLOG_API_URL
    
    # 기본값 설정
    BLOG_API_URL=${BLOG_API_URL:-"http://localhost:3000"}
    
    cat > .env << EOF
BLOG_EMAIL=$BLOG_EMAIL
BLOG_PASSWORD=$BLOG_PASSWORD
BLOG_API_KEY=$BLOG_API_KEY
BLOG_API_URL=$BLOG_API_URL
EOF

    chmod 600 .env
    echo -e "${GREEN}✅ 환경 설정 완료${NC}"
else
    echo -e "${GREEN}✅ 기존 환경 설정 사용${NC}"
fi

# 실행 스크립트 업데이트
echo -e "${BLUE}📝 실행 스크립트 최적화 중...${NC}"
cat > run_server.sh << 'EOF'
#!/bin/bash

# Blog MCP 서버 실행 (최적화)
cd "$(dirname "$0")"

# 에러 체크 함수
check_error() {
    if [ $? -ne 0 ]; then
        echo "❌ 오류: $1"
        exit 1
    fi
}

# 가상환경 확인/활성화
if [ ! -d "venv" ]; then
    echo "❌ 가상환경이 없습니다. install.sh를 먼저 실행하세요."
    exit 1
fi

source venv/bin/activate
check_error "가상환경 활성화 실패"

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo "❌ .env 파일이 없습니다. install.sh를 먼저 실행하세요."
    exit 1
fi

# MCP 서버 실행
echo "🚀 Blog MCP 서버 시작 중..."
python src/unified_mcp_server.py
EOF

chmod +x run_server.sh
echo -e "${GREEN}✅ 실행 스크립트 업데이트 완료${NC}"

# Claude Desktop 설정 도움말
echo -e "${BLUE}📋 Claude Desktop 설정 가이드${NC}"
echo "다음을 Claude Desktop 설정에 추가하세요:"
echo ""
echo -e "${YELLOW}파일 위치: ~/.config/claude-desktop/config.json${NC}"
echo ""
echo -e "${GREEN}{"
echo '  "mcpServers": {'
echo '    "blog-mcp": {'
echo '      "command": "bash",'
echo "      \"args\": [\"$SCRIPT_DIR/run_server.sh\"]"
echo '    }'
echo '  }'
echo -e "}${NC}"

# 설정 파일 자동 생성 제안
echo ""
read -p "🤖 Claude Desktop 설정을 자동으로 추가하시겠습니까? (y/N): " AUTO_CONFIG

if [[ $AUTO_CONFIG =~ ^[Yy]$ ]]; then
    CLAUDE_CONFIG_DIR="$HOME/.config/claude-desktop"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/config.json"
    
    # 디렉토리 생성
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # 기존 설정 백업
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup"
        echo -e "${GREEN}✅ 기존 설정 백업 완료${NC}"
    fi
    
    # 새 설정 생성/병합
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "blog-mcp": {
      "command": "bash",
      "args": ["$SCRIPT_DIR/run_server.sh"]
    }
  }
}
EOF
    
    echo -e "${GREEN}✅ Claude Desktop 설정 자동 추가 완료${NC}"
    echo -e "${YELLOW}⚠️  Claude Desktop을 재시작해야 적용됩니다.${NC}"
fi

# 테스트 실행
echo ""
echo -e "${BLUE}🧪 설치 테스트 중...${NC}"
timeout 5s bash run_server.sh &
TEST_PID=$!
sleep 2

if kill -0 $TEST_PID 2>/dev/null; then
    kill $TEST_PID 2>/dev/null
    echo -e "${GREEN}✅ MCP 서버 정상 실행 확인${NC}"
else
    echo -e "${YELLOW}⚠️  서버 테스트를 완료하지 못했습니다. 수동으로 확인하세요.${NC}"
fi

# 완료 메시지
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          🎉 설치 완료!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "다음 단계:"
echo "1. Claude Desktop 재시작"
echo "2. Claude에서 'create_post' 도구 사용 가능"
echo ""
echo "문제 발생 시:"
echo "- 로그 확인: ./run_server.sh"
echo "- 설정 초기화: rm .env && ./install.sh"
echo ""
echo -e "${BLUE}Happy blogging! 🚀${NC}"