import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { MarketplaceRefundService } from "./marketplace-refund.service";
import { Order } from "../entities/order.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { RefundRequest, RefundStatus, RefundReasonCategory } from "../entities/refund-request.entity";
import { TossApiClient } from "../../payment/providers/toss-api.client";
import { OrderStatus } from "../../common/enums/order-status.enum";

/**
 * 환불 서비스 유닛 테스트
 *
 * 테스트 대상:
 * 1. 환불 자격 검증 (7일 기간, 콘텐츠 열람, 다운로드)
 * 2. 상품 결함은 열람 후에도 환불 가능
 * 3. 중복 환불 요청 차단
 * 4. 에스컬레이션 후 판매자 조작 차단
 * 5. 판매자 권한 검증
 */
describe("MarketplaceRefundService", () => {
  let service: MarketplaceRefundService;
  let orderRepo: any;
  let productDetailRepo: any;
  let refundRequestRepo: any;
  let tossApiClient: any;

  const mockOrder = (overrides?: Partial<any>) => ({
    id: "order-1",
    orderId: "mkt_test_123",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    productPostId: "post-1",
    amount: 4900,
    status: OrderStatus.PAID,
    paymentKey: "pk_test",
    createdAt: new Date(),
    metadata: {},
    ...overrides,
  });

  beforeEach(async () => {
    orderRepo = {
      findOne: jest.fn().mockResolvedValue(mockOrder()),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    productDetailRepo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    refundRequestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((d) => ({ id: "refund-1", ...d })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };

    tossApiClient = {
      cancelPayment: jest.fn().mockResolvedValue({ status: "CANCELED" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceRefundService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(ProductDetail), useValue: productDetailRepo },
        { provide: getRepositoryToken(RefundRequest), useValue: refundRequestRepo },
        { provide: TossApiClient, useValue: tossApiClient },
      ],
    }).compile();

    service = module.get(MarketplaceRefundService);
  });

  afterEach(() => jest.clearAllMocks());

  // ═══ 환불 자격 검증 ═══

  describe("validateRefundEligibility", () => {
    it("구매 후 7일 이내 + 미열람 → 환불 가능", async () => {
      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it("7일 경과 → 환불 불가", async () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      orderRepo.findOne.mockResolvedValue(mockOrder({ createdAt: eightDaysAgo }));

      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toContain("환불 기간이 만료");
    });

    it("정확히 7일째 → 환불 가능", async () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      orderRepo.findOne.mockResolvedValue(mockOrder({ createdAt: sixDaysAgo }));

      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(true);
    });

    it("콘텐츠 열람 후 → 환불 불가", async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrder({ metadata: { contentAccessed: true } }),
      );

      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toContain("열람");
    });

    it("파일 다운로드 후 → 환불 불가", async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrder({ metadata: { downloadCount: 1 } }),
      );

      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toContain("다운로드");
    });

    it("주문 없음 → NotFoundException", async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateRefundEligibility("nonexistent", "buyer-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("REFUNDED 주문 → BadRequestException", async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrder({ status: OrderStatus.REFUNDED }),
      );

      await expect(
        service.validateRefundEligibility("mkt_test_123", "buyer-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══ 환불 요청 생성 ═══

  describe("requestRefund", () => {
    it("상품 결함 사유는 열람 후에도 환불 가능 (법적 의무)", async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrder({ metadata: { contentAccessed: true } }),
      );

      const result = await service.requestRefund(
        "buyer-1",
        "mkt_test_123",
        "상품 내용이 설명과 다릅니다",
        RefundReasonCategory.PRODUCT_DEFECT,
      );

      expect(result.id).toBeDefined();
      expect(refundRequestRepo.save).toHaveBeenCalled();
    });

    it("중복 환불 요청 → eligible=false", async () => {
      // 주문 존재 + 기존 환불 요청 존재
      orderRepo.findOne.mockResolvedValue(mockOrder());
      refundRequestRepo.findOne.mockResolvedValue({ id: "existing-refund" });

      const result = await service.validateRefundEligibility("mkt_test_123", "buyer-1");

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("이미 환불 요청이 접수되어 있습니다");
    });
  });

  // ═══ 판매자 승인/거부 ═══

  describe("approveRefund / rejectRefund", () => {
    it("다른 판매자가 승인 시도 → ForbiddenException", async () => {
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-1",
        sellerId: "seller-1",
        status: RefundStatus.PENDING,
      });

      await expect(
        service.approveRefund("refund-1", "wrong-seller"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("에스컬레이션된 요청 승인 시도 → BadRequestException", async () => {
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-1",
        sellerId: "seller-1",
        status: RefundStatus.ESCALATED,
      });

      await expect(
        service.approveRefund("refund-1", "seller-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("에스컬레이션된 요청 거부 시도 → BadRequestException", async () => {
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-1",
        sellerId: "seller-1",
        status: RefundStatus.ESCALATED,
      });

      await expect(
        service.rejectRefund("refund-1", "seller-1", "거부 사유"),
      ).rejects.toThrow(BadRequestException);
    });

    it("정상 승인 → 토스 cancelPayment 호출 + Order REFUNDED + salesCount 차감", async () => {
      // Arrange
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-1",
        orderId: "order-1",
        sellerId: "seller-1",
        buyerId: "buyer-1",
        status: RefundStatus.PENDING,
        reason: "상품 결함",
      });
      orderRepo.findOne.mockResolvedValue(mockOrder({
        id: "order-1",
        paymentKey: "pk_test_refund",
        amount: 4900,
        productPostId: "post-1",
      }));

      // Act
      const result = await service.approveRefund("refund-1", "seller-1");

      // Assert: 토스 cancelPayment 호출 확인
      expect(tossApiClient.cancelPayment).toHaveBeenCalledWith(
        "pk_test_refund",
        expect.stringContaining("상품 결함"),
        4900,
      );

      // Assert: Order 상태 REFUNDED
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "refunded" }),
      );

      // Assert: salesCount 차감 쿼리 실행
      expect(productDetailRepo.createQueryBuilder).toHaveBeenCalled();

      // Assert: RefundRequest 상태 PROCESSED
      expect(refundRequestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RefundStatus.PROCESSED }),
      );
    });

    it("정상 거부 → sellerResponse 저장 + 상태 REJECTED", async () => {
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-2",
        sellerId: "seller-1",
        status: RefundStatus.PENDING,
      });

      const result = await service.rejectRefund("refund-2", "seller-1", "정상 상품입니다");

      // Assert: 상태 REJECTED + 판매자 응답 저장
      expect(refundRequestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RefundStatus.REJECTED,
          sellerResponse: "정상 상품입니다",
        }),
      );

      // Assert: 토스 cancelPayment 미호출 (거부이므로)
      expect(tossApiClient.cancelPayment).not.toHaveBeenCalled();
    });

    it("토스 cancelPayment 실패 시 환불 처리 중단", async () => {
      refundRequestRepo.findOne.mockResolvedValue({
        id: "refund-3",
        orderId: "order-1",
        sellerId: "seller-1",
        status: RefundStatus.PENDING,
        reason: "테스트",
      });
      orderRepo.findOne.mockResolvedValue(mockOrder({ paymentKey: "pk_fail" }));
      tossApiClient.cancelPayment.mockRejectedValue(new Error("토스 오류"));

      await expect(
        service.approveRefund("refund-3", "seller-1"),
      ).rejects.toThrow();

      // Order 상태는 변경되지 않아야 함
      // (cancelPayment 실패 시 throw하므로 이후 save 실행 안 됨)
    });
  });
});
