# 🚀 OCI Local Testing & Deployment Guide

로컬 개발 환경에서 OCI Free Tier 제약사항을 시뮬레이션하고 검증하는 완벽한 가이드

## 📋 목차

1. [개요](#개요)
2. [빠른 시작](#빠른-시작)
3. [Docker 개발 환경](#docker-개발-환경)
4. [Kubernetes (K3s) 테스트](#kubernetes-k3s-테스트)
5. [리소스 검증](#리소스-검증)
6. [문제 해결](#문제-해결)
7. [프로덕션 배포](#프로덕션-배포)

## 📖 개요

이 프로젝트는 OCI (Oracle Cloud Infrastructure) Free Tier의 제약사항을 로컬에서 정확하게 시뮬레이션합니다:

- **CPU**: 4 OCPU (ARM Ampere A1)
- **RAM**: 24GB
- **Storage**: 200GB
- **Network**: 10TB/월 아웃바운드

### 🏗️ 아키텍처

```
┌──────────────────────────────────────────────┐
│              OCI Free Tier (24GB RAM)        │
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐           │
│  │  PostgreSQL │  │    Redis    │           │
│  │    (2GB)    │  │    (6GB)    │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  OpenSearch │  │   Backend   │           │
│  │   (10GB)    │  │    (3GB)    │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  Frontend   │  │  Monitoring │           │
│  │    (2GB)    │  │    (1GB)    │           │
│  └─────────────┘  └─────────────┘           │
└──────────────────────────────────────────────┘
```

## 🚀 빠른 시작

### 1️⃣ Docker 환경 (권장)

```bash
# 환경 설정 및 시작
./scripts/local-setup.sh

# 리소스 테스트
./scripts/test-resources.sh

# 검증
./scripts/validate-deployment.sh docker
```

### 2️⃣ Kubernetes 환경 (고급)

```bash
# K3s 클러스터 생성 및 배포
./scripts/k3s-setup.sh

# 검증
./scripts/validate-deployment.sh k3s
```

## 🐳 Docker 개발 환경

### 설정 파일 준비

1. **환경 변수 설정**:
```bash
cd docker/development
cp .env.example .env
# .env 파일을 열어 필요한 값 수정
```

2. **주요 설정**:
```env
# Database (로컬)
DB_HOST=postgres
DB_PASSWORD=your_secure_password

# AWS (기존 서비스 유지)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=myblog-uploads

# JWT
JWT_SECRET=change_this_in_production
```

### 서비스 시작

```bash
# 전체 스택 시작
cd docker/development
docker compose up -d

# 특정 서비스만 시작
docker compose up -d postgres redis opensearch

# 로그 확인
docker compose logs -f backend
```

### 서비스 접속

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **OpenSearch**: http://localhost:9200
- **Redis Commander**: http://localhost:8081
- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090

### 리소스 모니터링

```bash
# 실시간 리소스 사용량
docker stats

# 컨테이너별 상세 정보
docker compose ps

# 리소스 제한 확인
./scripts/test-resources.sh
```

## ☸️ Kubernetes (K3s) 테스트

### K3s 설정

K3s는 경량 Kubernetes로 OCI에서 실제 운영할 환경을 시뮬레이션합니다.

```bash
# K3s 클러스터 생성
./scripts/k3s-setup.sh

# 상태 확인
kubectl get nodes
kubectl get pods -n myblog
```

### 애플리케이션 배포

```bash
# Kustomize를 사용한 배포
kubectl apply -k k8s/base

# 개별 리소스 배포
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/secret.yaml
```

### 모니터링 및 디버깅

```bash
# Pod 상태 확인
kubectl get pods -n myblog -w

# 로그 확인
kubectl logs -f deployment/backend -n myblog

# Pod 접속
kubectl exec -it deployment/backend -n myblog -- sh

# 리소스 사용량
kubectl top nodes
kubectl top pods -n myblog
```

### 포트 포워딩

```bash
# Backend API 접근
kubectl port-forward svc/backend-service 3000:3000 -n myblog

# Frontend 접근
kubectl port-forward svc/frontend-service 3001:3000 -n myblog
```

## ✅ 리소스 검증

### 자동 검증 스크립트

```bash
# Docker 환경 검증
./scripts/validate-deployment.sh docker

# K3s 환경 검증
./scripts/validate-deployment.sh k3s

# 결과 저장
EXPORT_RESULTS=1 ./scripts/validate-deployment.sh docker
```

### 검증 항목

1. **리소스 제한**
   - CPU 제한 확인
   - 메모리 제한 확인
   - 총 리소스 합계 검증

2. **서비스 상태**
   - 컨테이너/Pod 실행 상태
   - 네트워크 연결성
   - 데이터베이스 접속

3. **성능 벤치마크**
   - Redis 레이턴시
   - API 응답 시간
   - 부하 테스트 (선택)

## 🔧 문제 해결

### Docker 문제

**문제**: 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker compose logs postgres

# 재시작
docker compose restart postgres

# 전체 초기화
docker compose down -v
./scripts/local-setup.sh
```

**문제**: 메모리 부족
```bash
# Docker Desktop 메모리 할당 확인
docker system info | grep Memory

# 불필요한 이미지 정리
docker system prune -a
```

### K3s 문제

**문제**: Pod가 Pending 상태
```bash
# 이벤트 확인
kubectl describe pod <pod-name> -n myblog

# PVC 상태 확인
kubectl get pvc -n myblog
```

**문제**: 서비스 접근 불가
```bash
# Service 확인
kubectl get svc -n myblog

# Ingress 확인
kubectl get ingress -n myblog
kubectl describe ingress myblog-ingress -n myblog
```

## 🚢 프로덕션 배포

### OCI 준비사항

1. **OCI 계정 생성 및 설정**
2. **Compute Instance 생성** (ARM Ampere A1)
3. **네트워크 설정** (Security List, Ingress Rules)

### 배포 절차

1. **Docker 이미지 빌드 및 푸시**:
```bash
# 이미지 빌드
docker build -t myblog/backend:latest -f docker/development/Dockerfile.backend backend/
docker build -t myblog/frontend:latest -f docker/development/Dockerfile.frontend frontend/

# OCI Container Registry로 푸시
docker tag myblog/backend:latest <region>.ocir.io/<tenancy>/myblog/backend:latest
docker push <region>.ocir.io/<tenancy>/myblog/backend:latest
```

2. **K3s 설치 (OCI Instance)**:
```bash
# SSH로 OCI 접속
ssh -i ~/.ssh/oci_key ubuntu@<instance-ip>

# K3s 설치
curl -sfL https://get.k3s.io | sh -

# kubeconfig 복사
sudo cat /etc/rancher/k3s/k3s.yaml
```

3. **애플리케이션 배포**:
```bash
# 로컬에서 OCI 클러스터에 배포
kubectl apply -k k8s/overlays/production
```

### 모니터링 설정

```bash
# Prometheus & Grafana 설치
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

## 📊 성능 최적화

### 메모리 최적화

```yaml
# OpenSearch JVM 힙 크기 조정
OPENSEARCH_JAVA_OPTS: "-Xms4g -Xmx4g"  # 50% of allocated memory

# Redis 메모리 정책
maxmemory-policy: allkeys-lru  # LRU 제거 정책
```

### CPU 최적화

```yaml
# Node.js 클러스터 모드
PM2_INSTANCES: 2  # CPU 코어의 50%

# Nginx 워커 프로세스
worker_processes: auto
worker_connections: 1024
```

## 📚 추가 리소스

- [OCI Free Tier 문서](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [K3s 문서](https://docs.k3s.io/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Kubernetes 문서](https://kubernetes.io/docs/)

## 🤝 지원

문제가 발생하면 다음을 시도하세요:

1. 검증 스크립트 실행: `./scripts/validate-deployment.sh`
2. 로그 확인: `docker compose logs` 또는 `kubectl logs`
3. 리소스 상태 확인: `docker stats` 또는 `kubectl top`
4. GitHub Issues에 문제 보고

---

**마지막 업데이트**: 2025년 9월

**작성자**: MyBlog DevOps Team