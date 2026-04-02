import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MarketplacePurchaseService } from "./marketplace-purchase.service";
import { Post } from "../../posts/entities/post.entity";
import { ProductDetail } from "../entities/product-detail.entity";
import { Order } from "../entities/order.entity";
import { PaymentHistory } from "../../subscription/entities/payment-history.entity";
import { TossApiClient } from "../../payment/providers/toss-api.client";
import { OrderStatus } from "../../common/enums/order-status.enum";

/**
 * MarketplacePurchaseService 유닛 테스트
 *
 * 테스트 대상:
 * 1. 멱등성 — 이미 구매한 상품 재구매 시 기존 주문 반환
 * 2. 판매자 본인 구매 차단
 * 3. 동시 요청 방지 (인메모리 락)
 * 4. 금액 서버 검증
 * 5. salesCount 원자적 증가
 * 6. 결제 실패 시 주문 상태 FAILED
 */
describe("MarketplacePurchaseService", () => {
  let service: MarketplacePurchaseService;
  let postRepo: any;
  let productDetailRepo: any;
  let orderRepo: any;
  let paymentHistoryRepo: any;
  let tossApiClient: any;

  const mockProduct = {
    id: "post-1",
    title: "AI 프롬프트 팩",
    authorId: "seller-1",
    postType: "product",
    isPublished: true,
    isDeleted: false,
    productDetail: {
      price: 4900,
      currency: "KRW",
      commissionRate: 20,
      isActive: true,
      postId: "post-1",
    },
  };

  beforeEach(async () => {
    // QueryBuilder mock
    const createQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockProduct),
      getMany: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    postRepo = {
      createQueryBuilder: jest.fn(() => createQueryBuilder),
    };

    productDetailRepo = {
      findOne: jest.fn().mockResolvedValue(mockProduct.productDetail),
      createQueryBuilder: jest.fn(() => createQueryBuilder),
    };

    orderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => ({ id: "order-1", ...d })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => createQueryBuilder),
    };

    paymentHistoryRepo = {
      save: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
    };

    tossApiClient = {
      confirmPayment: jest.fn().mockResolvedValue({
        paymentKey: "pk_test",
        approvedAt: "2026-03-25T12:00:00Z",
        method: "card",
        receipt: { url: "https://receipt.test" },
        card: { approveNo: "12345678", issuerCode: "15", number: "****1234", cardType: "체크" },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplacePurchaseService,
        { provide: getRepositoryToken(Post), useValue: postRepo },
        { provide: getRepositoryToken(ProductDetail), useValue: productDetailRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(PaymentHistory), useValue: paymentHistoryRepo },
        { provide: TossApiClient, useValue: tossApiClient },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue("http://localhost:3001") } },
      ],
    }).compile();

    service = module.get(MarketplacePurchaseService);
  });

  afterEach(() => jest.clearAllMocks());

  // ═══ 구매 준비 (preparePurchase) ═══

  describe("preparePurchase", () => {
    it("정상 구매 준비 — 주문 생성 + 토스 파라미터 반환", async () => {
      const result = await service.preparePurchase("buyer-1", "post-1") as any;

      expect(result.alreadyPurchased).toBe(false);
      expect(result.orderId).toBeDefined();
      expect(result.amount).toBe(4900);
      expect(result.successUrl).toContain("/marketplace/purchase/success");
      expect(orderRepo.save).toHaveBeenCalled();
    });

    it("판매자 본인 구매 시 ForbiddenException", async () => {
      await expect(
        service.preparePurchase("seller-1", "post-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("이미 결제 완료된 상품 — 기존 주문 반환 (멱등성)", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-existing",
        orderId: "mkt_existing",
        status: OrderStatus.PAID,
        buyerId: "buyer-1",
        productPostId: "post-1",
      });

      const result = await service.preparePurchase("buyer-1", "post-1");

      expect(result.alreadyPurchased).toBe(true);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("결제 대기 중인 주문 — 기존 orderId 재사용", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-pending",
        orderId: "mkt_pending_123",
        status: OrderStatus.PENDING,
        amount: 4900,
        buyerId: "buyer-1",
        productPostId: "post-1",
      });

      const result = await service.preparePurchase("buyer-1", "post-1") as any;

      expect(result.alreadyPurchased).toBe(false);
      expect(result.orderId).toBe("mkt_pending_123");
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("존재하지 않는 상품 — NotFoundException", async () => {
      postRepo.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(
        service.preparePurchase("buyer-1", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══ 구매 확인 (confirmPurchase) ═══

  describe("confirmPurchase", () => {
    it("정상 결제 승인 — 주문 완료 + salesCount 증가", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-1",
        orderId: "mkt_test",
        buyerId: "buyer-1",
        productPostId: "post-1",
        amount: 4900,
        status: OrderStatus.PENDING,
      });

      const result = await service.confirmPurchase(
        "buyer-1", "pk_test", "mkt_test", 4900,
      );

      expect(result.order.status).toBe(OrderStatus.PAID);
      expect(tossApiClient.confirmPayment).toHaveBeenCalledWith("pk_test", "mkt_test", 4900);
      expect(productDetailRepo.createQueryBuilder).toHaveBeenCalled();
      expect(paymentHistoryRepo.save).toHaveBeenCalled();
    });

    it("이미 결제된 주문 — 중복 방지 (멱등성)", async () => {
      orderRepo.findOne.mockResolvedValue({
        orderId: "mkt_test",
        status: OrderStatus.PAID,
        buyerId: "buyer-1",
      });

      const result = await service.confirmPurchase(
        "buyer-1", "pk_test", "mkt_test", 4900,
      );

      expect(result.alreadyPaid).toBe(true);
      expect(tossApiClient.confirmPayment).not.toHaveBeenCalled();
    });

    it("동시 요청 시 ConflictException", async () => {
      const lockMap = (service as any).processingLock as Map<string, number>;
      lockMap.set("mkt_locked", Date.now());

      await expect(
        service.confirmPurchase("buyer-1", "pk", "mkt_locked", 4900),
      ).rejects.toThrow(ConflictException);

      lockMap.delete("mkt_locked");
    });

    it("결제 실패 시 주문 상태 FAILED", async () => {
      orderRepo.findOne.mockResolvedValue({
        orderId: "mkt_fail",
        status: OrderStatus.PENDING,
        buyerId: "buyer-1",
        productPostId: "post-1",
      });

      tossApiClient.confirmPayment.mockRejectedValue(
        new Error("결제 실패"),
      );

      await expect(
        service.confirmPurchase("buyer-1", "pk_fail", "mkt_fail", 4900),
      ).rejects.toThrow();

      expect(orderRepo.update).toHaveBeenCalledWith(
        { orderId: "mkt_fail" },
        { status: OrderStatus.FAILED },
      );
    });
  });
});
