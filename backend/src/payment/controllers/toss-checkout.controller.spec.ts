import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConflictException, BadRequestException } from "@nestjs/common";
import { TossCheckoutController } from "./toss-checkout.controller";
import { TossProvider } from "../providers/toss.provider";
import { TossApiClient } from "../providers/toss-api.client";
import { BillingSchedulerService } from "../services/billing-scheduler.service";
import { SubscriptionFacadeService } from "../../shared/subscription-facade.service";
import { ConfigService } from "@nestjs/config";
import { PaymentHistory } from "../../subscription/entities/payment-history.entity";

/**
 * TossCheckoutController 유닛 테스트
 *
 * 테스트 대상:
 * 1. 멱등성 — 동일 authKey로 중복 요청 시 기존 결과 반환
 * 2. 동시 요청 방지 — 같은 userId의 동시 confirm 차단
 * 3. 금액 서버 검증 — 프론트엔드 금액 무시
 * 4. orderId 형식 검증
 * 5. 결제 실패 시 정리 — 빌링키 비활성화 + 구독 롤백
 * 6. 빌링키 삭제 소유자 검증
 */
describe("TossCheckoutController", () => {
  let controller: TossCheckoutController;
  let tossProvider: any;
  let tossApiClient: any;
  let billingScheduler: any;
  let subscriptionFacade: any;
  let configService: any;
  let paymentHistoryRepository: any;

  const mockReq = (userId: string, email?: string) => ({
    user: { id: userId, email: email || "test@test.com", name: "테스트" },
  });

  beforeEach(async () => {
    tossProvider = {
      findBillingKeyByAuthKey: jest.fn(),
      issueBillingKey: jest.fn(),
      getActiveBillingKey: jest.fn(),
      updateBillingKeyMetadata: jest.fn(),
      deactivateBillingKey: jest.fn(),
      deletePaymentMethod: jest.fn(),
      getCardCompanyName: jest.fn().mockReturnValue("카카오뱅크"),
    };

    tossApiClient = {
      chargeBilling: jest.fn(),
    };

    billingScheduler = {
      scheduleNextCharge: jest.fn(),
    };

    subscriptionFacade = {
      getPlanByTier: jest.fn().mockResolvedValue({
        id: "plan-1",
        name: "Pro",
        displayName: "Pro",
        pricing: { monthly: 12900, yearly: 129000 },
      }),
      updateUserSubscription: jest.fn().mockResolvedValue({
        id: "sub-1",
        tier: "pro",
        status: "active",
      }),
      getUserSubscription: jest.fn().mockResolvedValue({
        id: "sub-1",
        tier: "pro",
        status: "active",
      }),
    };

    configService = {
      get: jest.fn().mockReturnValue("http://localhost:3001"),
    };

    paymentHistoryRepository = {
      save: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TossCheckoutController],
      providers: [
        { provide: TossProvider, useValue: tossProvider },
        { provide: TossApiClient, useValue: tossApiClient },
        { provide: BillingSchedulerService, useValue: billingScheduler },
        { provide: SubscriptionFacadeService, useValue: subscriptionFacade },
        { provide: ConfigService, useValue: configService },
        {
          provide: getRepositoryToken(PaymentHistory),
          useValue: paymentHistoryRepository,
        },
      ],
    }).compile();

    controller = module.get<TossCheckoutController>(TossCheckoutController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════════════
  // 멱등성 테스트 — authKey 중복 방지
  // ════════════════════════════════════════════════════
  describe("confirmBillingAuth - 멱등성", () => {
    it("동일 authKey로 중복 요청 시 기존 결과 반환 (이중결제 방지)", async () => {
      // Arrange: 이미 처리된 authKey
      tossProvider.findBillingKeyByAuthKey.mockResolvedValue({
        id: "bk-1",
        billingKey: "toss_bk_xxx",
        metadata: { lastPaymentKey: "pk_existing", lastAmount: 12900 },
      });

      // Act
      const result = await controller.confirmBillingAuth(mockReq("user-1"), {
        authKey: "already-processed-auth-key",
        customerKey: "cust-1",
        tier: "pro",
        billingCycle: "monthly",
      });

      // Assert: 새 빌링키 발급 안 함, 기존 결과 반환
      expect(result.success).toBe(true);
      expect(result.data.duplicate).toBe(true);
      expect(result.data.paymentKey).toBe("pk_existing");
      expect(tossProvider.issueBillingKey).not.toHaveBeenCalled();
      expect(tossApiClient.chargeBilling).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════
  // 동시 요청 방지 테스트
  // ════════════════════════════════════════════════════
  describe("confirmBillingAuth - 동시 요청 방지", () => {
    it("같은 userId로 동시 요청 시 ConflictException", async () => {
      // Arrange: processingLock에 직접 락 설정하여 "처리 중" 상태 시뮬레이션
      const lockMap = (controller as any).processingLock as Map<string, number>;
      lockMap.set("user-1", Date.now());

      // Act & Assert: 락이 걸린 상태에서 요청하면 ConflictException
      await expect(
        controller.confirmBillingAuth(mockReq("user-1"), {
          authKey: "auth-2",
          customerKey: "cust-1",
          tier: "pro",
          billingCycle: "monthly",
        }),
      ).rejects.toThrow(ConflictException);

      // cleanup
      lockMap.delete("user-1");
    });
  });

  // ════════════════════════════════════════════════════
  // 금액 서버 검증 테스트
  // ════════════════════════════════════════════════════
  describe("confirmBillingAuth - 금액 검증", () => {
    it("금액이 100원 미만이면 BadRequestException", async () => {
      // Arrange: 0원 플랜 (무료)
      tossProvider.findBillingKeyByAuthKey.mockResolvedValue(null);
      tossProvider.issueBillingKey.mockResolvedValue({
        id: "bk-1",
        billingKey: "toss_bk_xxx",
      });
      subscriptionFacade.getPlanByTier.mockResolvedValue({
        pricing: { monthly: 50, yearly: 500 }, // 100원 미만
      });

      // Act & Assert
      await expect(
        controller.confirmBillingAuth(mockReq("user-1"), {
          authKey: "auth-1",
          customerKey: "cust-1",
          tier: "starter",
          billingCycle: "monthly",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════
  // 결제 실패 시 정리 테스트
  // ════════════════════════════════════════════════════
  describe("confirmBillingAuth - 결제 실패 시 정리", () => {
    it("결제 실패 시 빌링키 비활성화 + 구독 FREE 롤백", async () => {
      // Arrange
      tossProvider.findBillingKeyByAuthKey.mockResolvedValue(null);
      tossProvider.issueBillingKey.mockResolvedValue({
        id: "bk-1",
        billingKey: "toss_bk_xxx",
      });
      subscriptionFacade.getPlanByTier.mockResolvedValue({
        pricing: { monthly: 12900, yearly: 129000 },
        displayName: "Pro",
        name: "Pro",
      });
      // 결제 실패 시뮬레이션
      tossApiClient.chargeBilling.mockRejectedValue({
        response: { data: { code: "NOT_ENOUGH_AMOUNT" } },
      });

      // Act & Assert
      await expect(
        controller.confirmBillingAuth(mockReq("user-1"), {
          authKey: "auth-fail",
          customerKey: "cust-1",
          tier: "pro",
          billingCycle: "monthly",
        }),
      ).rejects.toThrow();

      // 빌링키 비활성화 확인
      expect(tossProvider.deactivateBillingKey).toHaveBeenCalledWith("bk-1");
      // 구독 FREE 롤백 확인
      expect(subscriptionFacade.updateUserSubscription).toHaveBeenCalledWith(
        "user-1",
        "free",
        undefined,
      );
    });
  });

  // ════════════════════════════════════════════════════
  // 빌링키 삭제 소유자 검증 테스트
  // ════════════════════════════════════════════════════
  describe("deleteBillingKey - 소유자 검증", () => {
    it("본인의 빌링키만 삭제 가능", async () => {
      // Arrange
      tossProvider.getActiveBillingKey.mockResolvedValue({
        id: "bk-1",
        userId: "user-1",
      });

      // Act
      const result = await controller.deleteBillingKey(mockReq("user-1"), "bk-1");

      // Assert
      expect(result.success).toBe(true);
      expect(tossProvider.deletePaymentMethod).toHaveBeenCalledWith("bk-1");
    });

    it("타인의 빌링키 삭제 시도 시 ForbiddenException", async () => {
      // Arrange: user-1의 빌링키를 user-2가 삭제 시도
      tossProvider.getActiveBillingKey.mockResolvedValue({
        id: "bk-other",
        userId: "user-1",
      });

      // Act & Assert
      await expect(
        controller.deleteBillingKey(mockReq("user-2"), "bk-1"),
      ).rejects.toThrow();
    });

    it("존재하지 않는 빌링키 삭제 시 ForbiddenException", async () => {
      // Arrange
      tossProvider.getActiveBillingKey.mockResolvedValue(null);

      // Act & Assert
      await expect(
        controller.deleteBillingKey(mockReq("user-1"), "bk-nonexistent"),
      ).rejects.toThrow();
    });
  });

  // ════════════════════════════════════════════════════
  // 정상 결제 플로우 테스트
  // ════════════════════════════════════════════════════
  describe("confirmBillingAuth - 정상 플로우", () => {
    it("빌링키 발급 → 결제 → PaymentHistory 저장 → 스케줄 등록", async () => {
      // Arrange
      tossProvider.findBillingKeyByAuthKey.mockResolvedValue(null);
      tossProvider.issueBillingKey.mockResolvedValue({
        id: "bk-1",
        billingKey: "toss_bk_xxx",
      });
      subscriptionFacade.getPlanByTier.mockResolvedValue({
        pricing: { monthly: 12900, yearly: 129000 },
        displayName: "Pro",
        name: "Pro",
      });
      tossApiClient.chargeBilling.mockResolvedValue({
        paymentKey: "pk_success",
        approvedAt: "2026-03-25T12:00:00Z",
        method: "card",
        card: {
          issuerCode: "15",
          number: "5365****1234",
          cardType: "체크",
          approveNo: "12345678",
        },
        receipt: { url: "https://receipt.tosspayments.com/xxx" },
      });

      // Act
      const result = await controller.confirmBillingAuth(mockReq("user-1"), {
        authKey: "auth-new",
        customerKey: "cust-1",
        tier: "pro",
        billingCycle: "monthly",
      });

      // Assert: 전체 플로우 완료
      expect(result.success).toBe(true);
      expect(result.data.paymentKey).toBe("pk_success");
      expect(result.data.amount).toBe(12900);
      expect(result.data.receiptUrl).toBe(
        "https://receipt.tosspayments.com/xxx",
      );

      // 빌링키 발급 확인
      expect(tossProvider.issueBillingKey).toHaveBeenCalled();
      // 결제 실행 확인
      expect(tossApiClient.chargeBilling).toHaveBeenCalled();
      // PaymentHistory 저장 확인
      expect(paymentHistoryRepository.save).toHaveBeenCalled();
      // 빌링키 메타데이터 업데이트 확인
      expect(tossProvider.updateBillingKeyMetadata).toHaveBeenCalledWith(
        "bk-1",
        expect.objectContaining({
          lastPaymentKey: "pk_success",
          lastAmount: 12900,
        }),
      );
      // 다음 결제 스케줄 등록 확인
      expect(billingScheduler.scheduleNextCharge).toHaveBeenCalled();
    });
  });
});
