# 📝 멀티테넌트 SaaS 플랫폼 - Phase 2 구현 계획

## 🎯 Phase 2: 구독 및 결제 시스템 구축 (Day 3-4)

### 1️⃣ Subscription 도메인 모델

#### A. Subscription Aggregate
**파일**: `backend/src/core/domain/subscription/subscription.aggregate.ts`
```typescript
// 구현할 내용:
export class SubscriptionAggregate {
  // 속성
  private id: SubscriptionId;
  private organizationId: OrganizationId;
  private planRoleId: number;
  private status: SubscriptionStatus;
  private billingCycle: BillingCycle;
  private currentPeriodEnd: Date;

  // 비즈니스 메서드
  canUpgrade(newPlan: PlanRole): boolean
  canDowngrade(newPlan: PlanRole): boolean
  calculateProration(newPlan: PlanRole): number
  renew(): Result<void>
  cancel(immediately: boolean): Result<void>
  pause(): Result<void>
  resume(): Result<void>

  // 도메인 이벤트
  private emitUpgradeEvent(oldPlan, newPlan)
  private emitCancellationEvent()
  private emitRenewalEvent()
}
```

#### B. Subscription Value Objects
**파일**: `backend/src/core/domain/subscription/subscription.types.ts`
```typescript
// 정의할 타입:
export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  PAUSED = 'paused'
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
  CUSTOM = 'custom'
}

export interface PlanFeatures {
  maxBlogs: number;
  maxPostsPerMonth: number;
  maxStorage: number; // MB
  maxTeamMembers: number;
  hasCustomDomain: boolean;
  hasApiAccess: boolean;
  hasAnalytics: boolean;
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  customFeatures?: Record<string, any>;
}
```

### 2️⃣ Subscription 엔티티

#### A. Subscription Entity
**파일**: `backend/src/subscriptions/entities/subscription.entity.ts`
```typescript
@Entity('subscriptions')
@Index(['organizationId', 'status'])
@Index(['currentPeriodEnd'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  organizationId: string;

  @Column()
  planRoleId: number;

  @ManyToOne(() => RoleEntity)
  @JoinColumn({ name: 'planRoleId' })
  planRole: RoleEntity;

  @Column({ length: 20 })
  status: string;

  @Column({ length: 20 })
  billingCycle: string;

  @Column('decimal', { precision: 10, scale: 2 })
  currentPrice: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  originalPrice: number; // 할인 전 가격

  @Column({ nullable: true })
  discountPercentage: number;

  @Column()
  currentPeriodStart: Date;

  @Column()
  currentPeriodEnd: Date;

  @Column({ nullable: true })
  trialEnd: Date;

  @Column({ nullable: true })
  canceledAt: Date;

  @Column({ nullable: true })
  cancelReason: string;

  // Stripe 연동
  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  stripePaymentMethodId: string;

  // 사용량 관계
  @OneToMany(() => UsageRecordEntity, usage => usage.subscription)
  usageRecords: UsageRecordEntity[];

  // 송장 관계
  @OneToMany(() => InvoiceEntity, invoice => invoice.subscription)
  invoices: InvoiceEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### B. Usage Record Entity
**파일**: `backend/src/subscriptions/entities/usage-record.entity.ts`
```typescript
@Entity('usage_records')
@Index(['subscriptionId', 'resourceType', 'periodStart'])
export class UsageRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: SubscriptionEntity;

  @Column({ length: 50 })
  resourceType: string; // 'blog_posts', 'storage_mb', 'api_calls', 'team_members'

  @Column('int')
  usedAmount: number;

  @Column('int')
  limitAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  overageAmount: number; // 초과 사용량

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  overagePrice: number; // 초과 요금

  @Column()
  periodStart: Date;

  @Column()
  periodEnd: Date;

  @Column('int', { default: 0 })
  incrementalCount: number; // 실시간 카운터

  @UpdateDateColumn()
  lastUpdated: Date;

  // 사용량 알림 추적
  @Column({ default: false })
  alert50Sent: boolean;

  @Column({ default: false })
  alert80Sent: boolean;

  @Column({ default: false })
  alert100Sent: boolean;
}
```

#### C. Invoice Entity
**파일**: `backend/src/subscriptions/entities/invoice.entity.ts`
```typescript
@Entity('invoices')
@Index(['subscriptionId', 'status'])
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: SubscriptionEntity;

  @Column({ unique: true })
  invoiceNumber: string; // INV-2024-0001

  @Column({ length: 20 })
  status: string; // 'draft', 'open', 'paid', 'void', 'uncollectible'

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2 })
  tax: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column('jsonb')
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;

  @Column()
  billingPeriodStart: Date;

  @Column()
  billingPeriodEnd: Date;

  @Column()
  dueDate: Date;

  @Column({ nullable: true })
  paidAt: Date;

  // Stripe 연동
  @Column({ nullable: true })
  stripeInvoiceId: string;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### 3️⃣ Subscription Service Layer

#### A. Subscription Service
**파일**: `backend/src/subscriptions/services/subscriptions.service.ts`
```typescript
@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(UsageRecordEntity)
    private usageRepository: Repository<UsageRecordEntity>,
    private stripeService: StripeService,
    private emailService: EmailService,
    private eventBus: EventBus
  ) {}

  // 구독 생성
  async createSubscription(
    organizationId: string,
    planRoleId: number,
    paymentMethodId?: string
  ): Promise<SubscriptionEntity> {
    // 1. 플랜 정보 조회
    // 2. Stripe 구독 생성 (결제 방법 제공 시)
    // 3. DB 구독 생성
    // 4. 초기 사용량 레코드 생성
    // 5. 환영 이메일 발송
    // 6. SubscriptionCreatedEvent 발행
  }

  // 플랜 업그레이드
  async upgradePlan(
    subscriptionId: string,
    newPlanRoleId: number
  ): Promise<SubscriptionEntity> {
    // 1. 현재 구독 검증
    // 2. 업그레이드 가능 여부 확인
    // 3. 비용 계산 (일할 계산)
    // 4. Stripe 구독 업데이트
    // 5. DB 업데이트
    // 6. PlanUpgradedEvent 발행
  }

  // 플랜 다운그레이드
  async downgradePlan(
    subscriptionId: string,
    newPlanRoleId: number
  ): Promise<SubscriptionEntity> {
    // 1. 현재 사용량 체크
    // 2. 다운그레이드 가능 여부 확인
    // 3. 다음 주기부터 적용 예약
    // 4. DowngradeScheduledEvent 발행
  }

  // 구독 취소
  async cancelSubscription(
    subscriptionId: string,
    reason: string,
    immediately: boolean = false
  ): Promise<void> {
    // 1. Stripe 구독 취소
    // 2. 즉시/주기 끝 처리
    // 3. 데이터 백업 안내
    // 4. SubscriptionCanceledEvent 발행
  }

  // 사용량 업데이트
  async updateUsage(
    subscriptionId: string,
    resourceType: string,
    increment: number
  ): Promise<void> {
    // 1. 현재 사용량 조회
    // 2. 제한 확인
    // 3. 증분 업데이트
    // 4. 알림 임계값 체크
    // 5. 초과 시 UsageExceededEvent 발행
  }
}
```

#### B. Usage Tracking Service
**파일**: `backend/src/subscriptions/services/usage-tracking.service.ts`
```typescript
@Injectable()
export class UsageTrackingService {
  constructor(
    @InjectRepository(UsageRecordEntity)
    private usageRepository: Repository<UsageRecordEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private notificationService: NotificationService
  ) {}

  // 실시간 사용량 추적
  async trackUsage(
    subscriptionId: string,
    resourceType: string,
    amount: number = 1
  ): Promise<void> {
    // Redis 카운터 증가 (빠른 응답)
    const cacheKey = `usage:${subscriptionId}:${resourceType}`;
    await this.cacheManager.increment(cacheKey, amount);

    // 배치로 DB 업데이트 (비동기)
    this.scheduleDbUpdate(subscriptionId, resourceType);
  }

  // 사용량 체크
  async checkUsageLimit(
    subscriptionId: string,
    resourceType: string
  ): Promise<{
    used: number;
    limit: number;
    percentage: number;
    canUse: boolean;
  }> {
    // 캐시에서 먼저 확인
    // DB 조회 폴백
    // 퍼센티지 계산
    // 사용 가능 여부 반환
  }

  // 사용량 알림
  async checkAndNotify(
    subscriptionId: string,
    resourceType: string
  ): Promise<void> {
    const usage = await this.checkUsageLimit(subscriptionId, resourceType);

    if (usage.percentage >= 100 && !record.alert100Sent) {
      // 100% 도달 알림
    } else if (usage.percentage >= 80 && !record.alert80Sent) {
      // 80% 경고
    } else if (usage.percentage >= 50 && !record.alert50Sent) {
      // 50% 안내
    }
  }
}
```

### 4️⃣ Stripe 연동

#### A. Stripe Service
**파일**: `backend/src/subscriptions/services/stripe.service.ts`
```typescript
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    @Inject(ConfigService) private config: ConfigService
  ) {
    this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16'
    });
  }

  // 고객 생성
  async createCustomer(
    email: string,
    metadata: Record<string, string>
  ): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email,
      metadata
    });
  }

  // 구독 생성
  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays?: number
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
  }

  // 결제 방법 연결
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await this.stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    );

    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return paymentMethod;
  }

  // 구독 업데이트
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
    proration: boolean = true
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: proration ? 'create_prorations' : 'none'
    });
  }
}
```

#### B. Stripe Webhook Handler
**파일**: `backend/src/subscriptions/controllers/stripe-webhook.controller.ts`
```typescript
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private stripeService: StripeService,
    private subscriptionsService: SubscriptionsService,
    private eventBus: EventBus
  ) {}

  @Post()
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string
  ): Promise<void> {
    const event = this.stripeService.constructWebhookEvent(
      rawBody,
      signature
    );

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialEnding(event.data.object);
        break;
    }
  }
}
```

### 5️⃣ 결제 관련 DTO

#### A. Create Subscription DTO
**파일**: `backend/src/subscriptions/dto/create-subscription.dto.ts`
```typescript
export class CreateSubscriptionDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @IsIn(['SUBSCRIPTION_FREE', 'SUBSCRIPTION_BASIC', 'SUBSCRIPTION_PRO', 'SUBSCRIPTION_BUSINESS'])
  planCode: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
```

### 6️⃣ 데이터베이스 마이그레이션

#### A. Create Subscriptions Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateSubscriptionsTable.ts`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id),
  plan_role_id INTEGER NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  discount_percentage INTEGER,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  trial_end TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_reason TEXT,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscription_org_status ON subscriptions(organization_id, status);
CREATE INDEX idx_subscription_period_end ON subscriptions(current_period_end);
```

#### B. Create Usage Records Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateUsageRecordsTable.ts`
```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  resource_type VARCHAR(50) NOT NULL,
  used_amount INTEGER NOT NULL DEFAULT 0,
  limit_amount INTEGER NOT NULL,
  overage_amount DECIMAL(10, 2) DEFAULT 0,
  overage_price DECIMAL(10, 2) DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  incremental_count INTEGER DEFAULT 0,
  alert_50_sent BOOLEAN DEFAULT false,
  alert_80_sent BOOLEAN DEFAULT false,
  alert_100_sent BOOLEAN DEFAULT false,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_subscription_resource_period
ON usage_records(subscription_id, resource_type, period_start);
```

#### C. Create Invoices Table
**파일**: `backend/src/infrastructure/database/migrations/[timestamp]-CreateInvoicesTable.ts`
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  line_items JSONB NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_subscription_status ON invoices(subscription_id, status);
```

### 7️⃣ 플랜 기능 매트릭스

#### A. 플랜 데이터 시딩
**파일**: `backend/src/infrastructure/database/seeds/002-seed-plans.ts`
```typescript
const plans = [
  {
    code: 'SUBSCRIPTION_FREE',
    displayName: 'Free Plan',
    category: 'subscription',
    metadata: {
      features: {
        maxBlogs: 1,
        maxPostsPerMonth: 10,
        maxStorage: 100, // MB
        maxTeamMembers: 1,
        hasCustomDomain: false,
        hasApiAccess: false,
        hasAnalytics: false,
        supportLevel: 'community'
      },
      pricing: {
        monthly: 0,
        yearly: 0
      }
    }
  },
  {
    code: 'SUBSCRIPTION_BASIC',
    displayName: 'Basic Plan',
    category: 'subscription',
    metadata: {
      features: {
        maxBlogs: 3,
        maxPostsPerMonth: 50,
        maxStorage: 1024, // 1GB
        maxTeamMembers: 3,
        hasCustomDomain: true,
        hasApiAccess: false,
        hasAnalytics: true,
        supportLevel: 'email'
      },
      pricing: {
        monthly: 9,
        yearly: 90 // 2개월 할인
      }
    }
  },
  // ... PRO, BUSINESS, ENTERPRISE 플랜
];
```

### 8️⃣ 크론 작업

#### A. Subscription Renewal Job
**파일**: `backend/src/subscriptions/jobs/subscription-renewal.job.ts`
```typescript
@Injectable()
export class SubscriptionRenewalJob {
  constructor(
    private subscriptionsService: SubscriptionsService
  ) {}

  @Cron('0 0 * * *') // 매일 자정
  async renewSubscriptions(): Promise<void> {
    // 1. 만료 예정 구독 조회
    // 2. 자동 갱신 처리
    // 3. 결제 실행
    // 4. 성공/실패 알림
  }

  @Cron('0 10 * * *') // 매일 오전 10시
  async sendRenewalReminders(): Promise<void> {
    // 1. 7일 후 만료 구독 조회
    // 2. 리마인더 이메일 발송
  }
}
```

### 9️⃣ 테스트 시나리오

#### A. 구독 생명주기 테스트
```typescript
describe('Subscription Lifecycle', () => {
  it('should create free subscription on user signup');
  it('should upgrade from free to paid plan');
  it('should handle payment failure gracefully');
  it('should downgrade at end of billing period');
  it('should cancel immediately when requested');
});
```

#### B. 사용량 추적 테스트
```typescript
describe('Usage Tracking', () => {
  it('should track blog post creation');
  it('should enforce usage limits');
  it('should send alerts at thresholds');
  it('should calculate overage charges');
  it('should reset usage at period start');
});
```

## 📊 예상 결과

### 구현 후 기능:
1. ✅ 5단계 구독 플랜 (Free → Enterprise)
2. ✅ Stripe 결제 연동
3. ✅ 실시간 사용량 추적
4. ✅ 자동 갱신 및 취소
5. ✅ 송장 생성 및 관리
6. ✅ 사용량 알림 시스템

### 성능 목표:
- 결제 처리: < 3초
- 사용량 조회: < 50ms (캐시)
- 플랜 변경: < 1초
- Webhook 처리: < 500ms

## ⚠️ 보안 고려사항

1. **PCI Compliance**: 카드 정보 직접 처리 금지
2. **Webhook 검증**: Stripe 서명 검증 필수
3. **결제 실패 처리**: 재시도 로직 구현
4. **환불 정책**: 명확한 환불 규정 수립