# 📝 멀티테넌트 SaaS 플랫폼 - Phase 1 구현 계획

## 🎯 Phase 1: 기초 인프라 구축 (Day 1-2)

### 1️⃣ Role 테이블 시스템 구현

#### A. Role Entity 생성
**파일**: `backend/src/roles/entities/role.entity.ts`
```typescript
// 구현할 내용:
- Role 엔티티 정의 (id, code, category, displayName, metadata, isActive)
- 인덱스 설정 (code, isActive)
- JSONB 타입으로 metadata 저장
- 타임스탬프 (createdAt, updatedAt)
```

#### B. Role Constants 정의
**파일**: `backend/src/core/constants/roles.constants.ts`
```typescript
// 구현할 내용:
- ROLE_CODES 상수 정의
- TypeScript 타입 안전성 보장
- 각 역할별 메타데이터 구조 정의
```

#### C. Role Service 구현
**파일**: `backend/src/roles/services/roles.service.ts`
```typescript
// 구현할 메서드:
- findByCode(code: string): Role 조회
- createRole(dto: CreateRoleDto): Role 생성
- getRolesByCategory(category: string): 카테고리별 조회
- validateRolePermissions(roleId: number, permission: string): 권한 검증
```

#### D. 초기 Role 데이터 시딩
**파일**: `backend/src/infrastructure/database/seeds/001-seed-roles.ts`
```sql
-- 삽입할 데이터:
-- 구독 플랜 Roles (5개)
-- 시스템 권한 Roles (3개)
-- 조직 역할 Roles (5개)
```

### 2️⃣ 도메인 모델 구축

#### A. Organization Domain Aggregate
**파일**: `backend/src/core/domain/organization/organization.aggregate.ts`
```typescript
// 구현할 내용:
- OrganizationAggregate 클래스
- 비즈니스 로직 메서드 (canAddMember, canCreateBlog, etc.)
- 도메인 이벤트 발행
- 불변성 보장
```

#### B. Domain Types 정의
**파일**: `backend/src/core/domain/organization/organization.types.ts`
```typescript
// 정의할 타입:
- OrganizationId (value object)
- OrganizationType enum
- SubscriptionValueObject
- OrganizationStatus enum
```

#### C. Domain Exceptions
**파일**: `backend/src/core/exceptions/domain.exceptions.ts`
```typescript
// 구현할 예외 클래스:
- DomainException (base)
- OrganizationQuotaExceededException
- InvalidOrganizationStateException
- UnauthorizedOrganizationAccessException
```

### 3️⃣ Organization 엔티티 구현

#### A. Organization Entity
**파일**: `backend/src/organizations/entities/organization.entity.ts`
```typescript
// 구현할 내용:
- Organization 엔티티 (id, slug, type, ownerId, isActive, etc.)
- 소프트 삭제 지원 (DeleteDateColumn)
- 낙관적 락킹 (VersionColumn)
- 복합 인덱스 설정
```

#### B. OrganizationMembership Entity
**파일**: `backend/src/organizations/entities/organization-membership.entity.ts`
```typescript
// 구현할 내용:
- Membership 관계 테이블
- User-Organization-Role 연결
- 초대 추적 필드
- 추가 권한 배열
```

### 4️⃣ Repository Pattern 구현

#### A. Organization Repository
**파일**: `backend/src/organizations/repositories/organization.repository.ts`
```typescript
// 구현할 메서드:
- findBySlugWithCache(slug: string): 캐시 적용 조회
- createOrganization(data): 트랜잭션 처리
- addMember(orgId, userId, roleId): 멤버 추가
- updateQuota(orgId, quotaType, value): 할당량 업데이트
```

### 5️⃣ 데이터베이스 마이그레이션

#### A. Create Roles Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateRolesTable.ts`
```typescript
// SQL 생성:
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(20) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roles_code_active ON roles(code, is_active);
```

#### B. Create Organizations Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateOrganizationsTable.ts`
```typescript
// SQL 생성:
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  owner_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_personal_default BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_org_slug_active ON organizations(slug, is_active);
CREATE INDEX idx_org_owner_type ON organizations(owner_id, type);
```

#### C. Create Memberships Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateMembershipsTable.ts`
```typescript
// SQL 생성:
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  invited_by_id UUID,
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  inherits_org_permissions BOOLEAN DEFAULT true,
  additional_permissions TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_membership_org_role ON organization_memberships(organization_id, role_id);
```

### 6️⃣ Service Layer 구현

#### A. Organizations Service
**파일**: `backend/src/organizations/services/organizations.service.ts`
```typescript
// 핵심 메서드:
- createOrganization(userId, dto): 조직 생성 + 소유자 멤버십
- switchOrganization(userId, orgId): 활성 조직 전환
- inviteMember(orgId, email, roleId): 멤버 초대
- validateQuota(orgId, resource): 할당량 검증
```

### 7️⃣ Guard & Interceptor 구현

#### A. Organization Guard
**파일**: `backend/src/common/guards/organization.guard.ts`
```typescript
// 구현할 내용:
- 현재 조직 컨텍스트 검증
- 멤버십 확인
- 권한 체크
```

#### B. Tenant Interceptor
**파일**: `backend/src/common/interceptors/tenant.interceptor.ts`
```typescript
// 구현할 내용:
- Request에서 organizationId 추출
- 모든 쿼리에 자동 필터 적용
- Response에 조직 컨텍스트 추가
```

### 8️⃣ User Entity 수정

#### A. User Entity 업데이트
**파일**: `backend/src/users/entities/user.entity.ts`
```typescript
// 수정 사항:
- role enum 필드 제거
- subscriptionRoleId 추가 (Role 테이블 참조)
- systemRoleId 추가 (nullable)
- defaultOrganizationId 추가
- activeOrganizationId 추가
- memberships 관계 추가
```

#### B. User Migration
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-UpdateUserEntity.ts`
```sql
-- 실행할 SQL:
ALTER TABLE users
ADD COLUMN subscription_role_id INTEGER REFERENCES roles(id),
ADD COLUMN system_role_id INTEGER REFERENCES roles(id),
ADD COLUMN default_organization_id UUID,
ADD COLUMN active_organization_id UUID;

-- 기존 enum 데이터 마이그레이션 후
ALTER TABLE users DROP COLUMN role;
```

### 9️⃣ 초기 데이터 마이그레이션

#### A. 사용자별 개인 Organization 생성
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreatePersonalOrganizations.ts`
```typescript
// 수행할 작업:
1. 모든 기존 사용자 조회
2. 각 사용자별 개인 Organization 생성
3. OWNER 역할로 멤버십 생성
4. User의 defaultOrganizationId 업데이트
5. 기존 블로그의 userId → organizationId 매핑
```

### 🔟 테스트 작성

#### A. Unit Tests
```typescript
// 테스트할 항목:
- Role Service 메서드
- Organization Aggregate 비즈니스 로직
- Repository 메서드
- Guard/Interceptor 동작
```

#### B. Integration Tests
```typescript
// 테스트 시나리오:
- 조직 생성 → 멤버 초대 → 권한 검증
- 사용자 가입 → 개인 조직 자동 생성
- 할당량 체크 → 초과 시 예외 처리
```

## 📊 예상 결과

### 구현 후 상태:
1. ✅ Role 테이블로 확장 가능한 권한 시스템
2. ✅ 모든 사용자가 Organization 소유
3. ✅ 멤버십 기반 접근 제어
4. ✅ 기존 데이터 완전 마이그레이션
5. ✅ 테스트 커버리지 80% 이상

### 검증 항목:
- [ ] 모든 마이그레이션 성공적 실행
- [ ] 기존 API 호환성 유지
- [ ] 새로운 Role 추가 시 코드 수정 불필요
- [ ] 조직 전환 기능 정상 동작
- [ ] 권한 검증 정확도 100%

## ⚠️ 주의사항

1. **마이그레이션 순서 중요**: Role → Organization → Membership → User 수정
2. **트랜잭션 처리**: 모든 생성/수정 작업은 트랜잭션 내에서
3. **캐시 무효화**: Organization 변경 시 Redis 캐시 갱신
4. **하위 호환성**: 기존 API는 v1 유지, 새 API는 v2로

## 🔄 구현 순서 체크리스트

### Day 1 (기초 구조)
- [ ] Role 엔티티 및 마이그레이션 생성
- [ ] Role 서비스 구현
- [ ] Role 데이터 시딩
- [ ] Organization 도메인 모델 구축
- [ ] Organization 엔티티 생성
- [ ] OrganizationMembership 엔티티 생성

### Day 2 (관계 설정 및 마이그레이션)
- [ ] Organization Repository 구현
- [ ] Organization Service 구현
- [ ] Guard & Interceptor 구현
- [ ] User Entity 수정
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] 테스트 작성 및 실행

## 📈 성능 목표

- API 응답 시간: < 100ms
- 캐시 적중률: > 80%
- 동시 접속: 1000+ users
- 데이터베이스 쿼리: < 5 per request