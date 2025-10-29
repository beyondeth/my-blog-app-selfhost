#!/bin/bash
# ============================================
# Nginx 설정 상태 체크 스크립트
# ============================================
# 용도: Nginx 설정 파일의 정합성 및 심볼릭 링크 상태 확인
#
# 사용법:
#   ./scripts/check-nginx.sh
# ============================================

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}       Nginx 설정 상태 체크${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# 1. 심볼릭 링크 확인
echo "1. 심볼릭 링크 상태:"
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo -e "   ${GREEN}✅ sites-enabled/default: 심볼릭 링크 (정상)${NC}"
    LINK_TARGET=$(readlink -f /etc/nginx/sites-enabled/default)
    echo -e "   ${CYAN}   → $LINK_TARGET${NC}"
else
    echo -e "   ${RED}❌ sites-enabled/default: 실제 파일 (문제!)${NC}"
    echo -e "   ${YELLOW}   수정 필요: sudo rm -f /etc/nginx/sites-enabled/default${NC}"
    echo -e "   ${YELLOW}            sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default${NC}"
fi
echo ""

# 2. 설정 파일 동기화 확인
echo "2. 설정 파일 동기화:"
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo -e "   ${GREEN}✅ 심볼릭 링크이므로 자동 동기화됨${NC}"
else
    DIFF=$(diff /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>&1)
    if [ -z "$DIFF" ]; then
        echo -e "   ${GREEN}✅ 설정 파일 동일${NC}"
    else
        echo -e "   ${RED}❌ 설정 파일 불일치!${NC}"
        echo -e "   ${YELLOW}   차이점:${NC}"
        echo "$DIFF" | head -20
    fi
fi
echo ""

# 3. 최근 수정 시간 확인
echo "3. 파일 정보:"
echo -e "   ${CYAN}sites-available/default:${NC}"
stat -c "     수정: %y" /etc/nginx/sites-available/default 2>/dev/null || echo "     파일 없음"
stat -c "     크기: %s bytes" /etc/nginx/sites-available/default 2>/dev/null

echo -e "   ${CYAN}sites-enabled/default:${NC}"
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "     타입: 심볼릭 링크"
else
    stat -c "     수정: %y" /etc/nginx/sites-enabled/default 2>/dev/null || echo "     파일 없음"
    stat -c "     크기: %s bytes" /etc/nginx/sites-enabled/default 2>/dev/null
fi
echo ""

# 4. Nginx 설정 테스트
echo "4. Nginx 설정 유효성:"
if sudo nginx -t 2>&1 | grep -q successful; then
    echo -e "   ${GREEN}✅ Nginx 설정 유효${NC}"
else
    echo -e "   ${RED}❌ Nginx 설정 오류${NC}"
    sudo nginx -t 2>&1 | sed 's/^/   /'
fi
echo ""

# 5. 중요 설정 확인
echo "5. 중요 설정 확인:"

# Legal API 설정 확인
if grep -q "location /api/legal/" /etc/nginx/sites-enabled/default 2>/dev/null; then
    echo -e "   ${GREEN}✅ Legal API 라우팅 설정 있음${NC}"
    grep -A 2 "location /api/legal/" /etc/nginx/sites-enabled/default | head -3 | sed 's/^/      /'
else
    echo -e "   ${RED}❌ Legal API 라우팅 설정 없음${NC}"
fi

# Rate Limit 설정 확인
echo ""
echo "   Rate Limit Zones:"
grep "limit_req_zone" /etc/nginx/nginx.conf 2>/dev/null | sed 's/^/      /' || echo "      설정 없음"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}         체크 완료: $(date +"%Y-%m-%d %H:%M:%S")${NC}"
echo -e "${CYAN}============================================${NC}"