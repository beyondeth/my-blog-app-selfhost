# 📌 배포 전략 결정 요약

## 🤔 질문: "백엔드,프론트 나눠서 ec2 에 컨테이너로 배포해야하는건가?"

### 답변: ❌ 아니요, 현재는 PM2가 더 적합합니다

**이유:**
1. **t4g.micro는 메모리가 1GB뿐**
   - PM2: ~600MB 사용
   - Docker: ~800MB 사용 (컨테이너 오버헤드)
   
2. **이미 PM2 설정 완료**
   - `aws-ec2-setup.sh`에 구현됨
   - 클러스터 모드로 2개 워커 실행 중
   
3. **비용 절감**
   - ECR 비용 없음
   - 빌드 서버 불필요
   - 관리 복잡도 낮음

## 🤔 질문: "무중단 배포는 어렵나?"

### 답변: ✅ 아니요, PM2로 쉽게 가능합니다!

**구현 방법:**
```bash
# 단 한 줄로 무중단 배포
pm2 reload ecosystem.config.js --env production
```

**작동 원리:**
1. PM2가 새 프로세스 시작
2. 새 프로세스가 준비되면 트래픽 전환
3. 이전 프로세스 graceful 종료
4. **다운타임: 0초**

## 🎯 즉시 실행 가능한 배포 명령

### 1. 간단한 무중단 배포 (현재 가능)
```bash
# EC2 접속 후
cd /home/ec2-user/app

# 코드 업데이트
git pull origin main

# Backend 빌드 및 재시작
cd backend
pnpm install && pnpm build
pm2 reload blog-backend

# Frontend 빌드 및 재시작  
cd ../frontend
pnpm install && pnpm build
pm2 reload blog-frontend
```

### 2. 자동화된 무중단 배포 (스크립트 사용)
```bash
# 방금 생성한 스크립트 실행
chmod +x scripts/deploy-zero-downtime.sh
./scripts/deploy-zero-downtime.sh
```

## 📊 현재 vs 미래 전략

### 현재 (사용자 1,000명)
```
[단일 EC2 t4g.micro]
    ├── PM2 Cluster (2 workers)
    ├── Redis (256MB)
    └── Nginx
    
월 비용: ~30,000원
다운타임: 0초
```

### 미래 (사용자 5,000명+)
```
[2개 EC2 + ALB]
    ├── Docker Containers
    ├── Kubernetes (K3s)
    └── Blue-Green 배포
    
월 비용: ~100,000원
다운타임: 0초
```

## ✅ 결론

1. **컨테이너 불필요**: 현재 PM2로 충분
2. **무중단 배포 쉬움**: `pm2 reload` 명령으로 해결
3. **비용 효율적**: 월 3만원으로 1,000명 처리
4. **즉시 사용 가능**: 이미 모든 설정 완료

## 🚀 다음 단계

1. **오늘 할 일**
   - `deploy-zero-downtime.sh` 스크립트 EC2에 업로드
   - 테스트 배포 실행

2. **이번 주 할 일**
   - GitHub Actions CI/CD 설정
   - CloudWatch 모니터링 추가

3. **나중에 할 일** (사용자 5,000명 이상)
   - Docker 전환 검토
   - Auto Scaling 구성
   - Kubernetes 도입 고려

---

**핵심 메시지**: 지금은 PM2로 충분합니다. 무중단 배포도 쉽게 가능합니다. 컨테이너는 나중에!