# 🚀 멀티테넌트 SaaS 플랫폼 - Phase 6 실제 구현 시작 가이드

## 📋 Phase 6: 구현 시작 체크리스트 및 실행 계획 (Day 11-12)

### 🎯 목표
- 5개 Phase 설계를 바탕으로 실제 코드 구현 시작
- 개발 환경 세팅 및 초기 구조 구축
- 첫 번째 작동 가능한 프로토타입 완성

## 1️⃣ 개발 환경 준비 체크리스트

### A. 필수 도구 설치 확인
```bash
# Node.js 18+ 확인
node --version  # v18.0.0 이상

# pnpm 설치 (권장)
npm install -g pnpm

# PostgreSQL 15+ 확인
psql --version

# Redis 7+ 확인
redis-server --version

# Docker & Docker Compose 확인
docker --version
docker-compose --version
```

### B. 프로젝트 초기화
```bash
# 백엔드 의존성 설치
cd backend
pnpm install

# 추가 필요 패키지 설치
pnpm add @nestjs/cache-manager cache-manager cache-manager-redis-store
pnpm add @nestjs/throttler @nestjs/event-emitter
pnpm add stripe @nestjs/schedule
pnpm add ioredis bull @nestjs/bull
pnpm add class-transformer class-validator
pnpm add helmet compression

# 프론트엔드 의존성 설치
cd ../frontend
pnpm install

# 추가 필요 패키지 설치
pnpm add zustand @tanstack/react-query
pnpm add recharts react-hook-form zod
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

### C. 환경 변수 설정
```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/saas_blog
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
SENTRY_DSN=https://...@sentry.io/...

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

## 2️⃣ Phase 1 구현 시작 (Role 시스템)

### A. 데이터베이스 마이그레이션 생성
```bash
# Role 테이블 마이그레이션 생성
cd backend
npm run typeorm:migration:generate -- CreateRolesTable

# Organization 테이블 마이그레이션 생성
npm run typeorm:migration:generate -- CreateOrganizationsTable

# Membership 테이블 마이그레이션 생성
npm run typeorm:migration:generate -- CreateMembershipsTable

# User 엔티티 수정 마이그레이션
npm run typeorm:migration:generate -- UpdateUserForOrganization

# 마이그레이션 실행
npm run typeorm:migration:run
```

### B. 엔티티 파일 생성 순서
1. **roles/entities/role.entity.ts**
2. **organizations/entities/organization.entity.ts**
3. **organizations/entities/organization-membership.entity.ts**
4. **users/entities/user.entity.ts** (수정)

### C. 초기 데이터 시딩
```typescript
// backend/src/database/seeds/seed.service.ts
@Injectable()
export class SeedService {
  async seedRoles() {
    const roles = [
      // 구독 플랜 Roles
      { code: 'SUBSCRIPTION_FREE', category: 'subscription', displayName: '무료 플랜' },
      { code: 'SUBSCRIPTION_STARTER', category: 'subscription', displayName: '스타터 플랜' },
      { code: 'SUBSCRIPTION_PRO', category: 'subscription', displayName: '프로 플랜' },
      { code: 'SUBSCRIPTION_BUSINESS', category: 'subscription', displayName: '비즈니스 플랜' },
      { code: 'SUBSCRIPTION_ENTERPRISE', category: 'subscription', displayName: '엔터프라이즈 플랜' },

      // 시스템 권한 Roles
      { code: 'SYSTEM_ADMIN', category: 'system', displayName: '시스템 관리자' },
      { code: 'SYSTEM_MODERATOR', category: 'system', displayName: '모더레이터' },
      { code: 'SYSTEM_SUPPORT', category: 'system', displayName: '고객 지원' },

      // 조직 역할 Roles
      { code: 'ORG_OWNER', category: 'organization', displayName: '조직 소유자' },
      { code: 'ORG_ADMIN', category: 'organization', displayName: '조직 관리자' },
      { code: 'ORG_EDITOR', category: 'organization', displayName: '에디터' },
      { code: 'ORG_VIEWER', category: 'organization', displayName: '뷰어' },
      { code: 'ORG_GUEST', category: 'organization', displayName: '게스트' },
    ];

    // 벌크 삽입
    await this.roleRepository.upsert(roles, ['code']);
  }
}
```

## 3️⃣ 구현 우선순위 및 일정

### Day 11: 기초 구조 구축
#### 오전 (4시간)
- [ ] Role 엔티티 및 서비스 구현
- [ ] Organization 도메인 모델 구축
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 초기 시드 데이터 투입

#### 오후 (4시간)
- [ ] Organization 서비스 구현
- [ ] Membership 관리 로직 구현
- [ ] Guard & Interceptor 구현
- [ ] 기본 API 엔드포인트 테스트

### Day 12: 기존 시스템 통합
#### 오전 (4시간)
- [ ] User 엔티티 마이그레이션
- [ ] 기존 사용자 데이터 변환
- [ ] 개인 Organization 자동 생성
- [ ] 기존 블로그 연결 처리

#### 오후 (4시간)
- [ ] 통합 테스트 작성
- [ ] API 문서 업데이트
- [ ] 프론트엔드 연동 테스트
- [ ] Phase 1 완료 검증

## 4️⃣ 코드 품질 체크포인트

### A. 테스트 커버리지 목표
```bash
# 단위 테스트 실행
npm run test

# 커버리지 확인 (목표: 80% 이상)
npm run test:cov

# E2E 테스트
npm run test:e2e
```

### B. 코드 품질 검사
```bash
# ESLint 실행
npm run lint

# Prettier 포맷팅
npm run format

# TypeScript 타입 체크
npm run type-check
```

### C. 보안 취약점 검사
```bash
# 의존성 취약점 검사
npm audit

# 보안 스캐닝
pnpm audit

# OWASP 의존성 체크
npm run security:check
```

## 5️⃣ 실제 구현 시작 명령어 시퀀스

### Step 1: 브랜치 생성
```bash
git checkout -b feature/multi-tenant-phase-1
```

### Step 2: Role 시스템 구현
```bash
# Role 모듈 생성
nest g module roles
nest g service roles
nest g controller roles

# 엔티티 생성 후 수동 편집
touch src/roles/entities/role.entity.ts
```

### Step 3: Organization 시스템 구현
```bash
# Organization 모듈 생성
nest g module organizations
nest g service organizations
nest g controller organizations

# 도메인 모델 생성
mkdir -p src/core/domain/organization
touch src/core/domain/organization/organization.aggregate.ts
```

### Step 4: 테스트 작성
```bash
# 테스트 파일 생성
touch src/roles/roles.service.spec.ts
touch src/organizations/organizations.service.spec.ts

# 테스트 실행
npm run test:watch
```

## 6️⃣ 트러블슈팅 가이드

### 일반적인 문제 해결

#### A. TypeORM 마이그레이션 오류
```bash
# 마이그레이션 롤백
npm run typeorm:migration:revert

# 데이터베이스 초기화 (주의!)
npm run typeorm:schema:drop
npm run typeorm:migration:run
```

#### B. Redis 연결 실패
```bash
# Redis 서버 시작
redis-server

# Redis CLI로 연결 테스트
redis-cli ping
```

#### C. 의존성 충돌
```bash
# node_modules 삭제 및 재설치
rm -rf node_modules package-lock.json
pnpm install
```

## 7️⃣ 성공 기준 체크리스트

### Phase 6 완료 조건
- [ ] 모든 개발 환경 도구 설치 완료
- [ ] 환경 변수 설정 완료
- [ ] Role 시스템 구현 및 테스트 통과
- [ ] Organization 도메인 모델 구현
- [ ] 데이터베이스 마이그레이션 성공
- [ ] 초기 시드 데이터 투입 완료
- [ ] 기본 API 엔드포인트 동작 확인
- [ ] 테스트 커버리지 80% 이상
- [ ] ESLint/Prettier 검사 통과
- [ ] 보안 취약점 0개

## 8️⃣ 다음 단계 예고

### Phase 7: 구독 시스템 실제 구현
- Stripe 통합 구현
- 구독 플랜 관리 API
- 사용량 추적 시스템
- 결제 웹훅 처리
- 인보이스 생성

### Phase 8: 성능 최적화 실제 구현
- Redis 캐싱 레이어 구축
- Circuit Breaker 구현
- Rate Limiting 적용
- 모니터링 대시보드 구축

## 📚 참고 자료

### 필수 문서
1. [NestJS 공식 문서](https://docs.nestjs.com)
2. [TypeORM 공식 문서](https://typeorm.io)
3. [Stripe API 문서](https://stripe.com/docs/api)
4. [Redis 공식 문서](https://redis.io/documentation)

### 코드 레퍼런스
- [NestJS Boilerplate](https://github.com/nestjs/nest)
- [TypeORM Migrations](https://typeorm.io/migrations)
- [Stripe Node.js SDK](https://github.com/stripe/stripe-node)

## 🔄 지속적 개선

### 일일 체크인
- 매일 오전: 구현 목표 확인
- 매일 오후: 진행 상황 검토
- 매일 저녁: 코드 리뷰 및 커밋

### 주간 마일스톤
- Week 1: Phase 1-3 완료 (기초 구조)
- Week 2: Phase 4-6 완료 (구현 시작)
- Week 3: Phase 7-9 완료 (고급 기능)
- Week 4: 최종 테스트 및 배포

## ⚡ 빠른 시작 명령어

```bash
# 전체 프로젝트 셋업 (한 번에 실행)
git checkout -b feature/multi-tenant-implementation
cd backend && pnpm install && cp .env.example .env
cd ../frontend && pnpm install && cp .env.example .env.local
docker-compose up -d postgres redis
cd ../backend && npm run typeorm:migration:run
npm run seed
npm run start:dev
# 새 터미널에서
cd frontend && pnpm dev
```

---

**준비 완료!** 이제 실제 코드 구현을 시작할 수 있습니다. 🚀