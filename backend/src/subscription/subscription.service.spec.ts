import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { Subscription } from "./entities/subscription.entity";
import { SubscriptionPlan } from "./entities/subscription-plan.entity";
import { PaymentHistory } from "./entities/payment-history.entity";
import { User } from "../users/entities/user.entity";
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from "../common/enums/subscription.enum";
import { SubscriptionPlanSeeder } from "./seeders/subscription-plan.seeder";

/**
 * SubscriptionService 유닛 테스트
 *
 * 테스트 대상:
 * 1. 비례배분(Proration) 계산 — 업그레이드 시 차액 계산 정확성
 * 2. 구독 취소 — 상태 변경, autoRenew, 이벤트 발행
 * 3. 구독 업데이트 — tier 변경, endDate 계산
 * 4. 엣지 케이스 — 잔여일수 0, 같은 플랜, 무료 플랜 등
 */
describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let subscriptionRepository: any;
  let planRepository: any;
  let paymentHistoryRepository: any;
  let userRepository: any;
  let eventEmitter: any;

  // ── Mock 데이터 ──
  const mockStarterPlan = {
    id: "plan-starter",
    name: "Starter",
    displayName: "Starter",
    tier: SubscriptionTier.STARTER,
    pricing: { monthly: 5900, yearly: 59000, currency: "KRW" },
    getMonthlyPrice: () => 5900,
    getYearlyPrice: () => 59000,
  };

  const mockProPlan = {
    id: "plan-pro",
    name: "Pro",
    displayName: "Pro",
    tier: SubscriptionTier.PRO,
    pricing: { monthly: 12900, yearly: 129000, currency: "KRW" },
    getMonthlyPrice: () => 12900,
    getYearlyPrice: () => 129000,
  };

  const mockFreePlan = {
    id: "plan-free",
    name: "Free",
    displayName: "Free",
    tier: SubscriptionTier.FREE,
    pricing: { monthly: 0, yearly: 0, currency: "KRW" },
    getMonthlyPrice: () => 0,
    getYearlyPrice: () => 0,
  };

  /** 30일 구독 Mock 생성 (startDate 기준 daysUsed일 경과) */
  function createMockSubscription(
    tier: SubscriptionTier,
    daysUsed: number,
    overrides?: Partial<Subscription>,
  ): Subscription {
    const start = new Date();
    start.setDate(start.getDate() - daysUsed);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    const plan = tier === SubscriptionTier.STARTER ? mockStarterPlan : mockProPlan;

    return {
      id: "sub-1",
      userId: "user-1",
      planId: plan.id,
      plan: plan as any,
      tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      autoRenew: true,
      startDate: start,
      endDate: end,
      nextBillingDate: end,
      price: plan.pricing.monthly,
      currency: "KRW",
      canceledAt: null,
      cancelReason: null,
      canCancel: () => true,
      ...overrides,
    } as any;
  }

  beforeEach(async () => {
    subscriptionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((sub) => Promise.resolve(sub)),
      create: jest.fn().mockImplementation((data) => data),
      update: jest.fn(),
    };

    planRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    paymentHistoryRepository = {
      save: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      find: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepository,
        },
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: planRepository,
        },
        {
          provide: getRepositoryToken(PaymentHistory),
          useValue: paymentHistoryRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
        {
          provide: SubscriptionPlanSeeder,
          useValue: { seed: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════════════
  // 비례배분(Proration) 계산 테스트
  // ════════════════════════════════════════════════════
  describe("calculateProration", () => {
    it("Starter→Pro 업그레이드, 15일 사용 시 정확한 차액 계산", async () => {
      // Arrange: 30일 중 15일 사용 → 15일 남음
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 15);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.PRO,
        BillingCycle.MONTHLY,
      );

      // Assert: 잔여 비율 = 15/30 = 0.5
      // Starter 잔여가치 = 5900 × 0.5 = 2950
      // Pro 잔여가치 = 12900 × 0.5 = 6450
      // 차액 = 6450 - 2950 = 3500
      expect(result.proratedAmount).toBe(3500);
      expect(result.currentPlan.tier).toBe(SubscriptionTier.STARTER);
      expect(result.newPlan.tier).toBe(SubscriptionTier.PRO);
      expect(result.remainingDays).toBe(15);
      expect(result.totalDays).toBe(30);
    });

    it("구독 시작 직후 (1일 사용) 업그레이드 시 거의 전액 차액", async () => {
      // Arrange: 30일 중 1일 사용 → 29일 남음
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 1);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.PRO,
        BillingCycle.MONTHLY,
      );

      // Assert: 잔여 비율 ≈ 29/30
      // 차액 ≈ (12900 - 5900) × 29/30 ≈ 6767
      expect(result.proratedAmount).toBeGreaterThan(6500);
      expect(result.proratedAmount).toBeLessThan(7000);
      expect(result.remainingDays).toBe(29);
    });

    it("구독 마지막 날 (29일 사용) 업그레이드 시 최소 차액", async () => {
      // Arrange: 30일 중 29일 사용 → 1일 남음
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 29);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.PRO,
        BillingCycle.MONTHLY,
      );

      // Assert: 잔여 비율 = 1/30
      // 차액 ≈ (12900 - 5900) × 1/30 ≈ 233
      expect(result.proratedAmount).toBeGreaterThan(200);
      expect(result.proratedAmount).toBeLessThan(300);
      expect(result.remainingDays).toBe(1);
    });

    it("잔여일수 0일이면 차액 0", async () => {
      // Arrange: 30일 모두 사용 → 0일 남음
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 30);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.PRO,
        BillingCycle.MONTHLY,
      );

      // Assert
      expect(result.proratedAmount).toBe(0);
      expect(result.remainingDays).toBe(0);
    });

    it("연간 플랜에서도 비례배분 정확히 계산", async () => {
      // Arrange: 연간 구독, 180일 사용 (절반)
      const start = new Date();
      start.setDate(start.getDate() - 180);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);

      const subscription = createMockSubscription(SubscriptionTier.STARTER, 180, {
        billingCycle: BillingCycle.YEARLY,
        price: 59000,
        startDate: start,
        endDate: end,
      });
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.PRO,
        BillingCycle.YEARLY,
      );

      // Assert: 잔여 약 185일/365일
      // 차액 ≈ (129000 - 59000) × 185/365 ≈ 35479
      expect(result.proratedAmount).toBeGreaterThan(30000);
      expect(result.proratedAmount).toBeLessThan(40000);
      expect(result.billingCycle).toBe(BillingCycle.YEARLY);
    });

    it("다운그레이드 시 차액이 음수면 0 반환", async () => {
      // Arrange: Pro에서 Starter로 (차액이 음수)
      const subscription = createMockSubscription(SubscriptionTier.PRO, 15, {
        price: 12900,
      });
      planRepository.findOne.mockResolvedValue(mockStarterPlan);

      // Act
      const result = await service.calculateProration(
        subscription,
        SubscriptionTier.STARTER,
        BillingCycle.MONTHLY,
      );

      // Assert: max(음수, 0) = 0
      expect(result.proratedAmount).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════
  // 구독 취소 테스트
  // ════════════════════════════════════════════════════
  describe("cancelSubscription", () => {
    it("활성 구독 취소 시 상태 변경 + autoRenew 해제 + 이벤트 발행", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 10);
      subscriptionRepository.findOne.mockResolvedValue(subscription);

      // Act
      const result = await service.cancelSubscription("user-1", "테스트 취소");

      // Assert
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.autoRenew).toBe(false);
      expect(result.canceledAt).toBeDefined();
      expect(result.cancelReason).toBe("테스트 취소");
      expect(subscriptionRepository.save).toHaveBeenCalled();
      // 결제 스케줄 취소 이벤트 발행 확인
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "subscription.cancelled",
        expect.objectContaining({
          userId: "user-1",
          subscriptionId: "sub-1",
        }),
      );
    });

    it("이미 취소된 구독은 다시 취소 불가", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 10, {
        status: SubscriptionStatus.CANCELED,
        canCancel: () => false,
      });
      subscriptionRepository.findOne.mockResolvedValue(subscription);

      // Act & Assert
      await expect(
        service.cancelSubscription("user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("만료된 구독은 취소 불가", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 10, {
        status: SubscriptionStatus.EXPIRED,
        canCancel: () => false,
      });
      subscriptionRepository.findOne.mockResolvedValue(subscription);

      // Act & Assert
      await expect(
        service.cancelSubscription("user-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════
  // 구독 tier 즉시 변경 테스트 (업그레이드 비례배분용)
  // ════════════════════════════════════════════════════
  describe("updateSubscriptionTier", () => {
    it("tier만 변경하고 endDate는 유지", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 15);
      const originalEndDate = subscription.endDate;
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.updateSubscriptionTier(
        "user-1",
        SubscriptionTier.PRO,
        BillingCycle.MONTHLY,
      );

      // Assert
      expect(result.tier).toBe(SubscriptionTier.PRO);
      expect(result.planId).toBe("plan-pro");
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.autoRenew).toBe(true);
      // endDate 유지 확인
      expect(result.endDate).toEqual(originalEndDate);
      // 취소 상태 초기화 확인
      expect(result.canceledAt).toBeNull();
      expect(result.cancelReason).toBeNull();
    });

    it("취소된 구독도 업그레이드 시 ACTIVE로 복구", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 15, {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: "이전 취소",
      });
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      planRepository.findOne.mockResolvedValue(mockProPlan);

      // Act
      const result = await service.updateSubscriptionTier(
        "user-1",
        SubscriptionTier.PRO,
      );

      // Assert
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.canceledAt).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════
  // updateUserSubscription 테스트
  // ════════════════════════════════════════════════════
  describe("updateUserSubscription", () => {
    it("기존 구독이 있으면 업데이트", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.FREE, 0);
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      planRepository.findOne.mockResolvedValue(mockStarterPlan);

      // Act
      const result = await service.updateUserSubscription(
        "user-1",
        SubscriptionTier.STARTER,
        BillingCycle.MONTHLY,
      );

      // Assert
      expect(result.tier).toBe(SubscriptionTier.STARTER);
      expect(result.billingCycle).toBe(BillingCycle.MONTHLY);
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it("기존 구독이 없으면 새로 생성", async () => {
      // Arrange
      subscriptionRepository.findOne.mockResolvedValue(null);
      planRepository.findOne.mockResolvedValue(mockStarterPlan);

      // Act
      const result = await service.updateUserSubscription(
        "user-1",
        SubscriptionTier.STARTER,
        BillingCycle.MONTHLY,
      );

      // Assert
      expect(subscriptionRepository.create).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it("월간 구독은 endDate가 30일 후", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.FREE, 0);
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      planRepository.findOne.mockResolvedValue(mockStarterPlan);

      // Act
      const result = await service.updateUserSubscription(
        "user-1",
        SubscriptionTier.STARTER,
        BillingCycle.MONTHLY,
      );

      // Assert: endDate가 약 30일 후인지 확인 (±1일 허용)
      const diffMs = new Date(result.endDate).getTime() - Date.now();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(27);
      expect(diffDays).toBeLessThan(32);
    });
  });

  // ════════════════════════════════════════════════════
  // getUserSubscription 테스트
  // ════════════════════════════════════════════════════
  describe("getUserSubscription", () => {
    it("구독이 있으면 반환", async () => {
      // Arrange
      const subscription = createMockSubscription(SubscriptionTier.STARTER, 10);
      subscriptionRepository.findOne.mockResolvedValue(subscription);

      // Act
      const result = await service.getUserSubscription("user-1");

      // Assert
      expect(result.tier).toBe(SubscriptionTier.STARTER);
      expect(subscriptionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          order: { createdAt: "DESC" },
        }),
      );
    });

    it("구독이 없으면 FREE 구독 자동 생성", async () => {
      // Arrange
      subscriptionRepository.findOne.mockResolvedValue(null);
      planRepository.findOne.mockResolvedValue(mockFreePlan);

      // Act
      const result = await service.getUserSubscription("user-1");

      // Assert
      expect(subscriptionRepository.create).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });
  });
});
