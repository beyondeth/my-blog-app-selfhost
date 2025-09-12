# 🚀 배포 전략 비교: PM2 vs Docker Container

## 📊 현재 상황 분석

### 인프라 제약
- **EC2**: t4g.micro (ARM, 1GB RAM, 2 vCPU)
- **예산**: 월 50,000원
- **목표**: 1,000명 사용자 지원
- **현재 설정**: PM2 클러스터 모드 (2 워커)

## 🔄 무중단 배포 전략 비교

### Option 1: PM2 클러스터 모드 (현재 설정) ✅ 추천

#### 장점
- **메모리 효율적**: 컨테이너 오버헤드 없음 (약 100-200MB 절약)
- **간단한 설정**: 이미 `aws-ec2-setup.sh`에 구현됨
- **무중단 배포 가능**: `pm2 reload` 명령으로 자동 처리
- **비용 효율적**: 추가 인프라 불필요
- **ARM 호환성**: t4g.micro에서 문제없이 작동

#### 무중단 배포 방법
```bash
# 1. 코드 업데이트
git pull origin main

# 2. 의존성 설치
cd backend && pnpm install --frozen-lockfile
cd ../frontend && pnpm install --frozen-lockfile

# 3. 빌드
cd backend && pnpm build
cd ../frontend && pnpm build

# 4. PM2 무중단 재시작 (자동으로 순차 재시작)
pm2 reload ecosystem.config.js --env production

# 5. 상태 확인
pm2 status
```

#### PM2 Graceful Reload 작동 방식
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'blog-backend',
    instances: 2,
    exec_mode: 'cluster',
    listen_timeout: 3000,      // 새 프로세스 시작 대기
    kill_timeout: 5000,        // 이전 프로세스 종료 대기
    wait_ready: true,          // ready 신호 대기
    max_memory_restart: '400M',
  }]
};

// backend/src/main.ts에 추가
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  
  // PM2에 ready 신호 전송
  if (process.send) {
    process.send('ready');
  }
}
```

### Option 2: Docker 컨테이너 방식 ❌ 비추천 (현재 상황)

#### 단점 (t4g.micro 환경)
- **메모리 오버헤드**: 컨테이너당 50-100MB 추가 사용
- **복잡도 증가**: Docker, Docker Compose 관리 필요
- **ARM 이미지 빌드**: 별도 ARM64 이미지 빌드 필요
- **성능 오버헤드**: 네트워크 가상화로 약 5-10% 성능 저하

#### 만약 Docker를 사용한다면
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  backend:
    image: blog-backend:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first  # 무중단 배포
    restart: always
    mem_limit: 400m
    cpus: '0.5'
    
  frontend:
    image: blog-frontend:latest
    deploy:
      replicas: 1
      update_config:
        order: start-first
    mem_limit: 300m
    cpus: '0.5'
```

## 🎯 권장 배포 아키텍처

### 1단계: 현재 (PM2 기반) ✅
```
[Nginx]
   ├── [PM2 Cluster]
   │     ├── Backend Worker 1 (Port 3000)
   │     └── Backend Worker 2 (Port 3001)
   └── Frontend (Port 3002)
```

### 2단계: 성장 후 (사용자 5,000명+)
```
[ALB/CloudFront]
   ├── [EC2 Auto Scaling Group]
   │     ├── EC2 Instance 1 (t3.small)
   │     └── EC2 Instance 2 (t3.small)
   └── [RDS Read Replica]
```

## 🔧 무중단 배포 자동화 스크립트

```bash
#!/bin/bash
# deploy-zero-downtime.sh

set -e

echo "🚀 Starting zero-downtime deployment..."

# 1. 현재 상태 백업
pm2 save

# 2. 코드 업데이트
echo "📦 Pulling latest code..."
git fetch origin
git reset --hard origin/main

# 3. 의존성 설치
echo "📚 Installing dependencies..."
cd backend
pnpm install --frozen-lockfile --prefer-offline

cd ../frontend  
pnpm install --frozen-lockfile --prefer-offline

# 4. 빌드
echo "🔨 Building applications..."
cd ../backend
pnpm build

cd ../frontend
export NEXT_PUBLIC_API_URL=http://your-domain.com/api/v1
pnpm build

# 5. Database 마이그레이션
echo "📊 Running migrations..."
cd ../backend
pnpm migration:run

# 6. PM2 무중단 재시작
echo "🔄 Reloading PM2 processes..."
cd ..
pm2 reload ecosystem.config.js --env production

# 7. 캐시 정리 (선택적)
echo "🧹 Clearing cache..."
redis-cli FLUSHDB

# 8. Nginx 재로드
echo "🔄 Reloading Nginx..."
sudo nginx -s reload

# 9. 헬스체크
echo "❤️ Health check..."
sleep 5
curl -f http://localhost/health || exit 1

echo "✅ Deployment completed successfully!"
pm2 status
```

## 📈 성능 비교

| 항목 | PM2 클러스터 | Docker 컨테이너 |
|------|-------------|-----------------|
| **메모리 사용** | ~600MB | ~800MB |
| **CPU 오버헤드** | 최소 | 5-10% |
| **배포 속도** | 30초 | 1-2분 |
| **무중단 배포** | ✅ 간단 | ✅ 복잡 |
| **모니터링** | PM2 내장 | 별도 구축 |
| **롤백** | `pm2 reload` | 이미지 교체 |
| **ARM 호환성** | ✅ 완벽 | ⚠️ 빌드 필요 |

## 💰 비용 영향

### PM2 방식 (현재)
- **추가 비용**: 없음
- **리소스 사용**: 최적화됨
- **관리 복잡도**: 낮음

### Docker 방식
- **추가 비용**: ECR 사용 시 월 ~$1
- **리소스 사용**: 20-30% 더 필요
- **관리 복잡도**: 높음

## 🎯 최종 권장사항

### 현재 상황 (사용자 1,000명, t4g.micro)
✅ **PM2 클러스터 모드 유지**
- 이미 구현되어 있음
- 메모리 효율적
- 무중단 배포 간단
- 비용 효율적

### 무중단 배포 구현
1. **PM2 graceful reload** 사용
2. **Nginx 업스트림** 설정으로 로드밸런싱
3. **헬스체크 엔드포인트** 구현
4. **자동화 스크립트** 작성

### 컨테이너 전환 시점
- 사용자 5,000명 이상
- 멀티 인스턴스 필요 시
- Kubernetes 도입 시
- 예산 10만원/월 이상

## 🚨 주의사항

1. **세션 관리**: Redis 세션 스토어 사용 (이미 구현됨)
2. **파일 업로드**: S3 사용 (로컬 저장 금지)
3. **로그 관리**: CloudWatch 또는 PM2 로그 로테이션
4. **모니터링**: PM2 Plus 또는 CloudWatch 설정

## 📝 구현 체크리스트

- [x] PM2 클러스터 모드 설정
- [x] Redis 세션 스토어
- [x] Nginx 리버스 프록시
- [ ] 헬스체크 엔드포인트 추가
- [ ] 자동 배포 스크립트 작성
- [ ] 롤백 전략 수립
- [ ] 모니터링 대시보드 설정

---

**결론**: 현재 PM2 클러스터 모드가 최적입니다. 무중단 배포는 `pm2 reload` 명령으로 쉽게 구현 가능하며, 컨테이너는 나중에 필요시 전환하세요.