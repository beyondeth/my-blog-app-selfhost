# 프로덕션 배포 가이드

## 개요

이 문서는 개선된 프로덕션 배포 시스템의 사용법과 이전 버전과의 차이점을 설명합니다.

## 주요 개선사항

### 1. 마이그레이션 안정성
- **자동 백업**: 배포 전 데이터베이스 자동 백업
- **롤백 메커니즘**: 마이그레이션 실패 시 자동 롤백
- **TypeScript 의존성 제거**: 순수 JavaScript 실행으로 프로덕션 환경 호환성 향상

### 2. 에러 핸들링 강화
- **종합적인 헬스체크**: 모든 서비스 상태 확인
- **자동 롤백**: 실패 시 이전 상태로 복원
- **상세 로깅**: 모든 단계 로깅 및 이력 관리

### 3. 제로 다운타임 배포
- **PM2 Reload**: 워커 순차적 재시작으로 서비스 중단 방지
- **점진적 롤아웃**: 안정적인 배포 진행

## 스크립트 파일 구조

```
scripts/
├── deploy-production.sh           # 기존 배포 스크립트
├── deploy-production-enhanced.sh  # 개선된 배포 스크립트 (권장)
├── rollback.sh                    # 롤백 스크립트
└── run-migrations.sh             # 프로덕션 마이그레이션 스크립트

backend/
├── docker-entrypoint.sh           # Docker 컨테이너 진입점 스크립트
└── package.json                   # 마이그레이션 명령어 모음
```

## 사용법

### 1. 개선된 배포 스크립트 사용

```bash
# 서버에서 실행
cd /home/ubuntu/my-blog-app
./scripts/deploy-production-enhanced.sh
```

#### 배포 과정
1. 사전 체크 (디스크 공간, 필수 파일, Docker 상태)
2. 데이터베이스 백업 자동 생성
3. Docker 이미지 빌드 (병렬)
4. Backend 배포 및 마이그레이션 실행
5. PM2 reload로 제로 다운타임 재시작
6. Frontend/MCP Proxy 배포
7. 헬스체크 및 상태 확인
8. 정리 및 알림

### 2. 마이그레이션 전용 실행

```bash
# 개발 환경
cd backend
pnpm migration:run

# 프로덕션 환경 (빌드 필요)
cd backend
pnpm migration:run:prod

# 프로덕션 환경 (이미 빌드된 경우)
cd backend
pnpm migration:run:prod:nobuild

# 스크립트 사용 (권장)
cd backend
pnpm migration:run:script
```

### 3. 롤백 실행

```bash
# 자동 롤백 (마이그레이션 실패 등)
./scripts/rollback.sh auto

# 수동 롤백
./scripts/rollback.sh manual

# 마이그레이션 실패로 인한 롤백
./scripts/rollback.sh migration-failed

# 도움말 보기
./scripts/rollback.sh --help
```

## 마이그레이션 명령어 일관성

### 개발 환경 (TypeScript)
```bash
pnpm migration:generate    # 마이그레이션 생성
pnpm migration:run         # 마이그레이션 실행
pnpm migration:revert      # 마이그레이션 롤백
pnpm migration:status      # 상태 확인
```

### 프로덕션 환경 (JavaScript)
```bash
pnpm migration:run:prod           # 빌드 후 실행
pnpm migration:run:prod:nobuild   # 바로 실행
pnpm migration:run:script         # 스크립트 사용
pnpm migration:revert:prod        # 롤백
pnpm migration:status:prod        # 상태 확인
```

## Docker 진입점 자동화

Docker 컨테이너 시작 시 `docker-entrypoint.sh`가 자동으로 실행됩니다:

1. 데이터베이스 연결 대기
2. 마이그레이션 필요 여부 확인
3. 필요 시 마이그레이션 자동 실행
4. 애플리케이션 시작

## 주의사항

### 1. 마이그레이션 작성 시
- **항상 TypeScript로 작성**: `backend/src/migrations/` 디렉토리
- **rollback 함수 구현 필수**: 실패 시 복원 로직 포함
- **테스트 필수**: 개발 환경에서 충분히 테스트 후 배포

### 2. 프로덕션 배포 전
- **백업 확인**: 최근 백업이 있는지 확인
- **마이그레이션 검토**: 변경사항 충분히 검토
- **시간 선택**: 트래픽이 적은 시간에 배포 권장

### 3. 롤백 시
- **데이터베이스 상태 확인**: 롤백 전후 데이터 확인
- **서비스 상태 모니터링**: 롤백 후 서비스 정상 작동 확인
- **원인 분석**: 롤백 원인 파악 및 문서화

## 문제 해결

### 1. 마이그레이션 실패
```bash
# 마이그레이션 상태 확인
docker exec codebase-prod-backend pnpm migration:status:prod

# 마이그레이션 로그 확인
docker exec codebase-prod-backend cat .migration_state.json

# 롤백 실행
./scripts/rollback.sh migration-failed
```

### 2. 컨테이너 시작 실패
```bash
# 컨테이너 로그 확인
docker logs codebase-prod-backend
docker logs codebase-prod-frontend
docker logs codebase-prod-mcp-proxy

# PM2 상태 확인
docker exec codebase-prod-backend pm2 status
docker exec codebase-prod-backend pm2 logs
```

### 3. 헬스체크 실패
```bash
# 직접 헬스체크
curl http://localhost/internal/health-check-2f4a8b9c

# API 테스트
curl http://localhost/api/v1/blogs/public

# 데이터베이스 연결 확인
docker exec codebase-prod-backend node -e "
const { DataSource } = require('./dist/src/data-source.js');
const dataSource = new DataSource();
dataSource.initialize()
  .then(() => console.log('DB 연결 성공'))
  .catch(err => console.error('DB 연결 실패:', err));
"
```

## 모니터링

### 1. 로그 파일
- 배포 로그: `/var/log/deploy-production.log`
- 롤백 로그: `/var/log/rollback.log`
- PM2 로그: Docker 컨테이너 내부

### 2. 백업 위치
- 백업 디렉토리: `/home/ubuntu/backups/`
- 자동 정리: 7일 이전 백업 파일 삭제

### 3. 알림 설정
슬랙/디스코드 알림을 활성화하려면 스크립트 내부의 Webhook URL을 설정하세요.

## 모범 사례

1. **항상 개선된 스크립트 사용**: `deploy-production-enhanced.sh` 사용 권장
2. **마이그레이션 테스트**: 개발 환경에서 충분히 테스트
3. **점진적 배포**: 큰 변경사항은 여러 단계로 나누어 배포
4. **롤백 계획**: 항상 롤백 계획 준비
5. **문서화**: 모든 배포와 롤백 기록 유지