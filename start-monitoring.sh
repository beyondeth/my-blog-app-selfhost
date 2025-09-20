#!/bin/bash

# 채팅 큐 모니터링 시스템 시작 스크립트
# Prometheus + Grafana + Redis Exporter

echo "🚀 채팅 큐 모니터링 시스템을 시작합니다..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Docker 실행 여부 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker가 설치되어 있지 않습니다.${NC}"
    echo "Docker를 먼저 설치해주세요: https://docs.docker.com/get-docker/"
    exit 1
fi

# Docker Compose 실행 여부 확인
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

# 기존 컨테이너 정리
echo "🧹 기존 모니터링 컨테이너 정리 중..."
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null || true

# 볼륨 생성 (필요한 경우)
echo "📦 Docker 볼륨 생성 중..."
docker volume create prometheus_data 2>/dev/null || true
docker volume create grafana_data 2>/dev/null || true

# 모니터링 스택 시작
echo "🔧 모니터링 스택 시작 중..."
docker-compose -f docker-compose.monitoring.yml up -d

# 컨테이너 상태 확인
echo ""
echo "⏳ 서비스 시작 대기 중..."
sleep 5

# 서비스 상태 확인 함수
check_service() {
    local service_name=$1
    local port=$2
    local url=$3

    if docker ps | grep -q "$service_name"; then
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302"; then
            echo -e "${GREEN}✅ $service_name 서비스가 정상 실행 중입니다.${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  $service_name 서비스가 시작 중입니다...${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ $service_name 컨테이너가 실행되지 않았습니다.${NC}"
        return 1
    fi
}

# 각 서비스 확인
echo ""
echo "📊 서비스 상태 확인:"
echo "------------------------"

# Prometheus 확인
check_service "chat-prometheus" 9090 "http://localhost:9090/-/ready"

# Grafana 확인
check_service "chat-grafana" 3030 "http://localhost:3030/api/health"

# Redis Exporter 확인
check_service "chat-redis-exporter" 9121 "http://localhost:9121/metrics"

# Node Exporter 확인
check_service "chat-node-exporter" 9100 "http://localhost:9100/metrics"

# NestJS 메트릭 엔드포인트 확인
echo ""
echo "🔍 NestJS 메트릭 엔드포인트 확인:"
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/metrics" | grep -q "200"; then
    echo -e "${GREEN}✅ NestJS 메트릭 엔드포인트가 활성화되어 있습니다.${NC}"
else
    echo -e "${YELLOW}⚠️  NestJS 앱을 시작해주세요: cd backend && pnpm start:dev${NC}"
fi

# 접속 정보 출력
echo ""
echo "🎉 모니터링 시스템이 시작되었습니다!"
echo ""
echo "📌 접속 정보:"
echo "------------------------"
echo "• Prometheus: http://localhost:9090"
echo "• Grafana: http://localhost:3030"
echo "  - 기본 계정: admin / admin"
echo "• NestJS Metrics: http://localhost:3000/metrics"
echo ""
echo "📊 Grafana 대시보드 설정:"
echo "1. http://localhost:3030 접속"
echo "2. admin/admin 로그인"
echo "3. Configuration > Data Sources > Prometheus 확인"
echo "4. Dashboards > Browse > Chat Queue Monitoring 확인"
echo ""
echo "🛑 종료하려면: docker-compose -f docker-compose.monitoring.yml down"
echo ""

# 로그 확인 옵션
read -p "📜 로그를 확인하시겠습니까? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "로그를 확인합니다. (종료: Ctrl+C)"
    docker-compose -f docker-compose.monitoring.yml logs -f
fi