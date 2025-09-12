# ⚡ 무중단 배포 구현 가이드

## 🎯 구현 목표
t4g.micro 단일 인스턴스에서 PM2를 활용한 무중단 배포 구현

## 📋 필수 구현 사항

### 1. Health Check 엔드포인트 추가

#### Backend (NestJS)
```typescript
// backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('ready')
  @Public()
  ready() {
    // DB 연결 체크, Redis 연결 체크 등
    return { ready: true };
  }
}
```

#### Frontend (Next.js)
```typescript
// frontend/src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
```

### 2. PM2 Ecosystem 파일 최적화

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'blog-backend',
      script: './backend/dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      
      // 무중단 배포 설정
      wait_ready: true,
      listen_timeout: 5000,
      kill_timeout: 5000,
      
      // 환경 변수
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // 자동 재시작
      max_memory_restart: '400M',
      autorestart: true,
      
      // 로그 설정
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'blog-frontend',
      script: 'node',
      args: './frontend/.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      
      max_memory_restart: '300M',
      autorestart: true,
    }
  ]
};
```

### 3. Graceful Shutdown 구현

```typescript
// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS, 미들웨어 설정...
  
  await app.listen(process.env.PORT || 3000);
  
  // PM2에 준비 완료 신호 전송
  if (process.send) {
    process.send('ready');
  }
  
  // Graceful shutdown 처리
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, closing server gracefully...`);
      
      // 새 연결 거부, 기존 연결 처리 완료 대기
      await app.close();
      
      // Redis 연결 종료
      // await redis.quit();
      
      process.exit(0);
    });
  });
}

bootstrap();
```

### 4. Nginx 무중단 설정

```nginx
# /etc/nginx/conf.d/myblog.conf
upstream backend {
    least_conn;  # 연결 수 기반 로드밸런싱
    
    # PM2 클러스터 워커들
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    
    # 헬스체크를 통한 자동 제외
    keepalive 32;
}

server {
    listen 80;
    server_name _;
    
    # 헬스체크 엔드포인트
    location /health {
        access_log off;
        proxy_pass http://backend/health;
    }
    
    # API 프록시
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # 무중단 배포를 위한 재시도
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
        
        # 타임아웃 설정
        proxy_connect_timeout 2s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
}
```

### 5. 자동 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 무중단 배포 시작${NC}"

# 1. 배포 전 헬스체크
echo -e "${YELLOW}헬스체크 수행...${NC}"
if ! curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${RED}❌ 서버가 응답하지 않습니다${NC}"
    exit 1
fi

# 2. 코드 업데이트
echo -e "${YELLOW}코드 업데이트...${NC}"
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "이미 최신 버전입니다"
    exit 0
fi

# 3. 의존성 설치
echo -e "${YELLOW}의존성 설치...${NC}"
cd backend
pnpm install --frozen-lockfile --silent

cd ../frontend
pnpm install --frozen-lockfile --silent

# 4. 빌드
echo -e "${YELLOW}애플리케이션 빌드...${NC}"
cd ../backend
pnpm build

cd ../frontend
pnpm build

# 5. 데이터베이스 마이그레이션
echo -e "${YELLOW}DB 마이그레이션...${NC}"
cd ../backend
pnpm migration:run || true

# 6. PM2 무중단 재시작
echo -e "${YELLOW}PM2 프로세스 재시작...${NC}"
cd ..

# Backend 재시작 (한 번에 하나씩)
pm2 reload blog-backend --wait-ready --listen-timeout 5000

# Frontend 재시작
pm2 reload blog-frontend

# 7. 배포 후 헬스체크
echo -e "${YELLOW}배포 검증...${NC}"
sleep 5

for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 배포 성공!${NC}"
        pm2 status
        exit 0
    fi
    echo "재시도 $i/10..."
    sleep 2
done

echo -e "${RED}❌ 배포 후 헬스체크 실패${NC}"
# 롤백
git reset --hard $CURRENT_COMMIT
pm2 reload all
exit 1
```

### 6. 모니터링 설정

```bash
# scripts/monitor.sh
#!/bin/bash

# PM2 로그 모니터링
pm2 logs --lines 100

# 또는 PM2 대시보드
pm2 monit

# 시스템 리소스 모니터링
watch -n 1 'pm2 status && echo && free -h && echo && df -h'
```

## 🔄 배포 프로세스

### 자동 배포 (CI/CD)

```yaml
# .github/workflows/deploy.yml
name: Deploy to EC2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/app
            ./scripts/deploy.sh
```

### 수동 배포

```bash
# EC2 접속
ssh -i your-key.pem ec2-user@your-ec2-ip

# 배포 스크립트 실행
cd /home/ec2-user/app
./scripts/deploy.sh

# 로그 확인
pm2 logs --lines 50
```

## 📊 배포 모니터링

### 1. 실시간 모니터링
```bash
# PM2 모니터링
pm2 monit

# 로그 스트리밍
pm2 logs --raw
```

### 2. 메트릭 수집
```javascript
// backend/src/metrics/metrics.service.ts
@Injectable()
export class MetricsService {
  private deploymentMetrics = {
    lastDeployment: null,
    deploymentCount: 0,
    averageDeploymentTime: 0,
    failedDeployments: 0,
  };

  recordDeployment(success: boolean, duration: number) {
    this.deploymentMetrics.deploymentCount++;
    if (!success) {
      this.deploymentMetrics.failedDeployments++;
    }
    this.deploymentMetrics.lastDeployment = new Date();
    // CloudWatch로 전송
  }
}
```

## 🚨 롤백 전략

### 자동 롤백
```bash
#!/bin/bash
# scripts/rollback.sh

# 이전 커밋으로 롤백
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
git reset --hard $PREVIOUS_COMMIT

# 빌드 및 재시작
cd backend && pnpm build
cd ../frontend && pnpm build
pm2 reload all

echo "Rolled back to commit: $PREVIOUS_COMMIT"
```

### PM2 자동 복구
```javascript
// ecosystem.config.js
{
  min_uptime: '10s',     // 최소 실행 시간
  max_restarts: 3,       // 최대 재시작 횟수
  autorestart: true,     // 자동 재시작
  error_file: './logs/error.log',
}
```

## ✅ 체크리스트

### 구현 필수 사항
- [ ] Health check 엔드포인트 구현
- [ ] Graceful shutdown 처리
- [ ] PM2 wait_ready 설정
- [ ] Nginx upstream 설정
- [ ] 배포 스크립트 작성
- [ ] 롤백 스크립트 작성

### 선택 사항
- [ ] GitHub Actions CI/CD
- [ ] CloudWatch 모니터링
- [ ] 배포 알림 (Slack/Discord)
- [ ] Blue-Green 배포 (2개 EC2 사용 시)

## 📈 성공 지표

- **배포 시간**: < 1분
- **다운타임**: 0초
- **롤백 시간**: < 30초
- **성공률**: > 99%
- **500 에러**: < 0.1%

---

**요약**: PM2의 cluster mode와 reload 기능을 활용하면 t4g.micro 단일 인스턴스에서도 무중단 배포가 가능합니다. Docker는 현재 단계에서 불필요한 오버헤드입니다.