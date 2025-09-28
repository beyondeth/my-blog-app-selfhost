# 🏛️ Enterprise급 멀티테넌트 SaaS 아키텍처 설계

## 📌 프로젝트 개요

기존 단일 사용자 블로그 시스템을 **Enterprise급 멀티테넌트 SaaS 플랫폼**으로 전환하기 위한 포괄적인 아키텍처 설계입니다. 20년차 시니어 개발자의 관점에서 확장성, 유지보수성, 성능을 모두 고려한 설계를 제시합니다.

## 🎯 핵심 설계 원칙

- **Domain-Driven Design (DDD)**: 비즈니스 로직의 명확한 캡슐화
- **Clean Architecture**: 계층 간 의존성 관리 및 관심사의 분리
- **SOLID Principles**: 객체지향 설계 원칙 준수
- **Performance First**: 멀티레이어 캐싱 및 최적화
- **Type Safety**: TypeScript를 활용한 컴파일 타임 안정성

## 1️⃣ 통일된 Organization 아키텍처

### 왜 모든 사용자가 Organization을 가져야 하는가?

- **일관성**: 개인/팀/기업 간 전환이 자유로움
- **확장성**: 개인 사용자가 팀으로 성장 가능
- **유지보수**: 단일 코드 경로로 복잡도 감소

### Organization Domain Model

```typescript
// src/core/domain/organization/organization.aggregate.ts
export class OrganizationAggregate {
  private readonly id: OrganizationId;
  private readonly type: OrganizationType; // PERSONAL | TEAM | ENTERPRISE
  private readonly ownerId: UserId;
  private readonly subscription: SubscriptionValueObject;

  // 도메인 로직 캡슐화
  canAddMember(currentCount: number): boolean {
    return currentCount < this.subscription.memberLimit;
  }

  canCreateBlog(currentCount: number): boolean {
    return currentCount < this.subscription.blogLimit;
  }

  upgradeSubscription(newPlan: SubscriptionPlan): Result<void> {
    // 비즈니스 규칙 검증
    if (this.type === OrganizationType.PERSONAL && newPlan.requiresTeam) {
      return Result.fail('Personal organization cannot use team plans');
    }
    // ... 더 많은 비즈니스 로직
  }
}
```

### Organization Entity (Infrastructure Layer)

```typescript
@Entity('organizations')
@Index(['slug', 'isActive'])
@Index(['ownerId', 'type'])
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // URL 식별자

  @Column({ length: 20 })
  type: string; // 'personal' | 'team' | 'enterprise'

  @Column('uuid')
  ownerId: string;

  @Column({ default: true })
  isActive: boolean;

  // 자동 생성되는 개인 조직 식별
  @Column({ default: false })
  isPersonalDefault: boolean;

  // 소프트 델리트 지원
  @DeleteDateColumn()
  deletedAt: Date | null;

  // 낙관적 락킹
  @VersionColumn()
  version: number;
}
```

## 2️⃣ Enum 대체: Lookup Table Pattern

### PostgreSQL Enum의 문제점

- 새로운 값 추가 시 ALTER TYPE 필요
- 롤백이 어려움
- TypeORM과의 호환성 이슈

### 해결책: Role Lookup Table

```typescript
@Entity('roles')
@Index(['code', 'isActive'])
export class RoleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  code: string; // 'SUBSCRIPTION_FREE', 'PERMISSION_ADMIN'

  @Column({ length: 20 })
  category: string; // 'subscription' | 'permission' | 'organization'

  @Column()
  displayName: string;

  @Column('jsonb')
  metadata: {
    level?: number;
    features?: SubscriptionFeatures;
    permissions?: string[];
  };

  @Column({ default: true })
  isActive: boolean;
}
```

### Type-Safe Constants

```typescript
export const ROLE_CODES = {
  SUBSCRIPTION: {
    FREE: 'SUBSCRIPTION_FREE',
    BASIC: 'SUBSCRIPTION_BASIC',
    PROFESSIONAL: 'SUBSCRIPTION_PROFESSIONAL',
    BUSINESS: 'SUBSCRIPTION_BUSINESS',
    ENTERPRISE: 'SUBSCRIPTION_ENTERPRISE'
  },
  PERMISSION: {
    SUPER_ADMIN: 'PERMISSION_SUPER_ADMIN',
    SUPPORT_STAFF: 'PERMISSION_SUPPORT_STAFF'
  },
  ORGANIZATION: {
    OWNER: 'ORG_ROLE_OWNER',
    ADMIN: 'ORG_ROLE_ADMIN',
    EDITOR: 'ORG_ROLE_EDITOR',
    WRITER: 'ORG_ROLE_WRITER',
    VIEWER: 'ORG_ROLE_VIEWER'
  }
} as const;
```

## 3️⃣ User-Organization 관계 설계

### User Entity 개선

```typescript
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 기본 개인 조직 (자동 생성)
  @Column('uuid')
  defaultOrganizationId: string;

  // 현재 활성 조직 (컨텍스트 스위칭용)
  @Column('uuid', { nullable: true })
  activeOrganizationId: string;

  @OneToMany(() => OrganizationMembershipEntity, membership => membership.user)
  memberships: OrganizationMembershipEntity[];
}
```

### Membership 관계

```typescript
@Entity('organization_memberships')
@Index(['userId', 'organizationId'], { unique: true })
export class OrganizationMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  organizationId: string;

  @Column()
  roleId: number;

  @ManyToOne(() => RoleEntity)
  role: RoleEntity;

  // 초대 추적
  @Column('uuid', { nullable: true })
  invitedById: string;

  @Column({ nullable: true })
  acceptedAt: Date;

  // 추가 권한
  @Column('simple-array', { nullable: true })
  additionalPermissions: string[];
}
```

## 4️⃣ 구독 & 결제 시스템

### Subscription Management

```typescript
@Entity('subscriptions')
@Index(['organizationId', 'status'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  organizationId: string;

  @Column()
  planRoleId: number; // Role 테이블 참조

  @Column({ length: 20 })
  status: string; // 'active' | 'trialing' | 'past_due' | 'canceled'

  @Column({ length: 20 })
  billingCycle: string; // 'monthly' | 'yearly' | 'lifetime'

  @Column('decimal', { precision: 10, scale: 2 })
  currentPrice: number;

  // Stripe 연동
  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;
}
```

### Usage Tracking

```typescript
@Entity('usage_records')
@Index(['subscriptionId', 'resourceType', 'periodStart'])
export class UsageRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscriptionId: string;

  @Column({ length: 50 })
  resourceType: string; // 'blog_posts' | 'storage_mb' | 'api_calls'

  @Column('int')
  usedAmount: number;

  @Column('int')
  limitAmount: number;

  @Column()
  periodStart: Date;

  @Column()
  periodEnd: Date;

  // 실시간 업데이트를 위한 카운터
  @Column('int', { default: 0 })
  incrementalCount: number;
}
```

## 5️⃣ 성능 최적화 전략

### Multi-Layer Caching

```typescript
@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly repository: Repository<OrganizationEntity>,
    @InjectRedis() private readonly redis: Redis,
    private readonly metricsService: MetricsService
  ) {}

  async findBySlugWithCache(slug: string): Promise<OrganizationEntity | null> {
    const cacheKey = `org:slug:${slug}`;

    // L1 Cache: Redis
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.metricsService.recordCacheHit('organization');
      return JSON.parse(cached);
    }

    // L2: Database with optimized query
    const organization = await this.repository
      .createQueryBuilder('org')
      .select(['org.id', 'org.slug', 'org.type'])
      .where('org.slug = :slug', { slug })
      .andWhere('org.isActive = true')
      .getOne();

    if (organization) {
      // Write to cache with TTL
      await this.redis.set(
        cacheKey,
        JSON.stringify(organization),
        'EX',
        300 // 5 minutes TTL
      );
    }

    return organization;
  }
}
```

### Bulk Operations

```typescript
async bulkUpdateUsageRecords(records: UpdateUsageDto[]): Promise<void> {
  await this.repository.manager.transaction(async manager => {
    const chunks = this.chunkArray(records, 100);

    for (const chunk of chunks) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(UsageRecordEntity)
        .values(chunk)
        .orUpdate(
          ['usedAmount', 'incrementalCount', 'lastUpdated'],
          ['subscriptionId', 'resourceType', 'periodStart']
        )
        .execute();
    }
  });
}
```

## 6️⃣ 에러 처리 & 복원력

### Domain Exceptions

```typescript
export class DomainException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, any>,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

export class OrganizationQuotaExceededException extends DomainException {
  constructor(resourceType: string, limit: number, current: number) {
    super(
      'QUOTA_EXCEEDED',
      `Organization quota exceeded for ${resourceType}`,
      { resourceType, limit, current },
      402 // Payment Required
    );
  }
}
```

### Circuit Breaker Pattern

```typescript
export function CircuitBreaker(options: CircuitBreakerOptions = {}) {
  const breaker = new CircuitBreakerImpl({
    timeout: options.timeout || 3000,
    errorThresholdPercentage: options.errorThreshold || 50,
    resetTimeout: options.resetTimeout || 30000
  });

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return breaker.fire(async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Usage
@Injectable()
export class StripePaymentService {
  @CircuitBreaker({ timeout: 5000, errorThreshold: 30 })
  async createSubscription(customerId: string, planId: string) {
    // Stripe API call with automatic circuit breaking
  }
}
```

## 7️⃣ 데이터 마이그레이션 전략

### 단계적 마이그레이션

```typescript
@Injectable()
export class UserOrganizationMigrationService {
  async migrateToOrganizationModel(): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const users = await manager.find(UserEntity);

      for (const user of users) {
        // 1. 개인 조직 생성
        const personalOrg = manager.create(OrganizationEntity, {
          slug: `${user.username}-personal`,
          type: 'personal',
          ownerId: user.id,
          isPersonalDefault: true
        });

        await manager.save(personalOrg);

        // 2. 사용자 업데이트
        user.defaultOrganizationId = personalOrg.id;
        user.activeOrganizationId = personalOrg.id;
        await manager.save(user);

        // 3. 멤버십 생성
        const ownerRole = await manager.findOne(RoleEntity, {
          where: { code: ROLE_CODES.ORGANIZATION.OWNER }
        });

        await manager.save(OrganizationMembershipEntity, {
          userId: user.id,
          organizationId: personalOrg.id,
          roleId: ownerRole.id,
          acceptedAt: new Date()
        });

        // 4. 기존 블로그 이전
        await manager.update(
          BlogEntity,
          { userId: user.id },
          { organizationId: personalOrg.id }
        );
      }
    });
  }
}
```

## 8️⃣ 구현 계획

### 📁 새로 생성할 파일 구조

```
backend/src/
├── core/                          # 도메인 계층 (새로 생성)
│   ├── domain/
│   │   ├── organization/
│   │   │   ├── organization.aggregate.ts
│   │   │   ├── organization.repository.interface.ts
│   │   │   └── organization.types.ts
│   │   ├── subscription/
│   │   │   ├── subscription.aggregate.ts
│   │   │   └── subscription.types.ts
│   │   └── access/
│   │       ├── role.types.ts
│   │       └── permission.types.ts
│   ├── constants/
│   │   └── roles.constants.ts
│   └── exceptions/
│       └── domain.exceptions.ts
│
├── organizations/                 # 조직 모듈 (새로 생성)
│   ├── entities/
│   │   ├── organization.entity.ts
│   │   └── organization-membership.entity.ts
│   ├── dto/
│   │   ├── create-organization.dto.ts
│   │   └── update-organization.dto.ts
│   ├── repositories/
│   │   └── organization.repository.ts
│   ├── services/
│   │   └── organizations.service.ts
│   ├── controllers/
│   │   └── organizations.controller.ts
│   └── organizations.module.ts
│
├── roles/                        # 역할 관리 모듈 (새로 생성)
│   ├── entities/
│   │   └── role.entity.ts
│   ├── services/
│   │   └── roles.service.ts
│   └── roles.module.ts
│
├── subscriptions/                # 구독 모듈 (새로 생성)
│   ├── entities/
│   │   ├── subscription.entity.ts
│   │   └── usage-record.entity.ts
│   ├── services/
│   │   └── subscriptions.service.ts
│   └── subscriptions.module.ts
│
├── infrastructure/               # 인프라 계층 (새로 생성)
│   ├── cache/
│   │   └── redis-cache.service.ts
│   ├── resilience/
│   │   └── circuit-breaker.decorator.ts
│   └── database/
│       └── migrations/
│           ├── 001-create-roles-table.ts
│           ├── 002-create-organizations.ts
│           └── 003-migrate-users-to-orgs.ts
│
└── common/                       # 기존 common 확장
    ├── guards/
    │   └── organization.guard.ts
    ├── decorators/
    │   └── organization.decorator.ts
    └── interceptors/
        └── tenant.interceptor.ts
```

### 🔄 수정할 기존 파일

1. **User Entity 수정**
   - `backend/src/users/entities/user.entity.ts`
   - enum Role 제거
   - defaultOrganizationId, activeOrganizationId 추가

2. **Blog Entity 수정**
   - `backend/src/blogs/entities/blog.entity.ts`
   - userId → organizationId 변경

3. **AppModule 수정**
   - 새로운 모듈들 import 추가
   - Redis 설정 추가

### 🛠️ 구현 단계

#### Phase 1: 기초 구조 (Day 1-2)
1. Role 테이블 생성
2. Organization 도메인 구축

#### Phase 2: 사용자 시스템 개선 (Day 3-4)
1. User Entity 마이그레이션
2. 인증/인가 수정

#### Phase 3: 구독 시스템 (Day 5-6)
1. Subscription 구현
2. 결제 준비

#### Phase 4: 성능 최적화 (Day 7)
1. 캐싱 레이어
2. 복원력 패턴

#### Phase 5: 마이그레이션 (Day 8-9)
1. 데이터 마이그레이션
2. 테스트 및 검증

### 💾 데이터베이스 마이그레이션 순서

1. roles 테이블 생성
2. organizations 테이블 생성
3. organization_memberships 테이블 생성
4. subscriptions 테이블 생성
5. usage_records 테이블 생성
6. users 테이블 수정
7. blogs 테이블 수정
8. 데이터 마이그레이션 실행
9. 기존 enum 컬럼 제거

## 🎯 요금제 구조

| 기능 | FREE | BASIC | PRO | BUSINESS | ENTERPRISE |
|-----|------|-------|-----|----------|------------|
| **가격** | $0 | $9/월 | $29/월 | $99/월 | Custom |
| **블로그 수** | 1 | 3 | 10 | 50 | 무제한 |
| **포스트/월** | 10 | 50 | 200 | 1000 | 무제한 |
| **팀 멤버** | 1 | 3 | 10 | 50 | 무제한 |
| **저장 공간** | 100MB | 1GB | 10GB | 100GB | 무제한 |
| **커스텀 도메인** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **API 접근** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **분석 기능** | 기본 | 기본 | 고급 | 고급 | 커스텀 |
| **지원** | 커뮤니티 | 이메일 | 우선 | 전담 | 엔터프라이즈 |

## ⚠️ 주의사항

1. **Zero Downtime 마이그레이션**
   - 새 컬럼 추가 → 데이터 복사 → 기존 컬럼 제거 순서
   - 롤백 가능한 구조로 설계

2. **하위 호환성 유지**
   - API 버전닝 (/api/v2)
   - 기존 API 일정 기간 유지

3. **성능 고려사항**
   - 인덱스 전략 수립
   - N+1 쿼리 방지
   - 캐싱 전략 적용

4. **보안 강화**
   - Row-level security
   - 테넌트 격리
   - 권한 검증 강화

## 📊 예상 성과

- **확장성**: 수평 확장 가능한 아키텍처
- **성능**: 99.9% uptime, <100ms API 응답
- **유지보수**: 명확한 도메인 경계와 책임 분리
- **비즈니스**: B2B/B2C 동시 지원, 다양한 수익 모델

## 🔑 핵심 포인트

1. **통일된 Organization 모델**로 일관성 확보
2. **Lookup Table Pattern**으로 확장성 해결
3. **Multi-Layer Caching**으로 성능 최적화
4. **Domain-Driven Design**으로 비즈니스 로직 캡슐화
5. **Circuit Breaker Pattern**으로 외부 서비스 장애 대응

이 아키텍처는 단순한 블로그 플랫폼을 넘어, 진정한 **Enterprise급 SaaS 플랫폼**으로 성장할 수 있는 견고한 기반을 제공합니다.