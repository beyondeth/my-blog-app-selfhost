import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SubscriptionService } from "./subscription.service";
import { SubscriptionFacadeService } from "../shared/subscription-facade.service";
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from "../common/enums/subscription.enum";

/**
 * 구독 관리 컨트롤러
 * 구독 플랜 조회, 결제, 관리 등의 API 엔드포인트 제공
 */
@ApiTags("Subscription")
@Controller("subscription")
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly facadeService: SubscriptionFacadeService,
  ) {}

  /**
   * 사용 가능한 모든 구독 플랜 조회
   * 로그인하지 않은 사용자도 접근 가능
   */
  @Get("plans")
  @ApiOperation({ summary: "구독 플랜 목록 조회" })
  @ApiResponse({ status: 200, description: "플랜 목록 반환" })
  async getPlans() {
    const plans = await this.subscriptionService.getAvailablePlans();
    return {
      success: true,
      data: plans,
    };
  }

  /**
   * 특정 구독 플랜 상세 정보 조회
   */
  @Get("plans/:tier")
  @ApiOperation({ summary: "구독 플랜 상세 조회" })
  @ApiResponse({ status: 200, description: "플랜 상세 정보" })
  async getPlan(@Param("tier") tier: SubscriptionTier) {
    const plan = await this.subscriptionService.getPlanByTier(tier);
    if (!plan) {
      throw new BadRequestException("플랜을 찾을 수 없습니다");
    }
    return {
      success: true,
      data: plan,
    };
  }

  /**
   * 현재 사용자의 구독 정보 조회
   * 구독 상태, 만료일, 사용량 등 포함
   */
  @Get("my-subscription")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "내 구독 정보 조회" })
  async getMySubscription(@Request() req) {
    // SubscriptionFacadeService를 통해 구독 정보와 사용량을 한 번에 조회
    const result = await this.facadeService.getMySubscriptionWithUsage(
      req.user.id,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 구독 플랜 업그레이드/다운그레이드를 위한 체크아웃 세션 생성
   * 결제 페이지로 리다이렉트할 URL 반환
   */
  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "결제 체크아웃 세션 생성" })
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @Request() req,
    @Body()
    body: {
      tier: SubscriptionTier;
      billingCycle: BillingCycle;
      provider?: string; // 'stripe', 'toss', 'mock' 등
    },
  ) {
    try {
      // SubscriptionFacadeService를 통해 체크아웃 세션 생성
      // Facade가 내부적으로 구독 상태 확인, 다운그레이드 체크 등을 처리
      const session = await this.facadeService.createCheckoutSession({
        userId: req.user.id,
        tier: body.tier,
        billingCycle: body.billingCycle,
        provider: body.provider,
      });

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      // Facade에서 발생한 에러를 BadRequestException으로 변환
      throw new BadRequestException(error.message);
    }
  }

  /**
   * 구독 취소
   * 기간이 끝날 때까지 사용 가능, 즉시 취소 옵션 제공
   */
  @Post("cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구독 취소" })
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Request() req,
    @Body() body: { immediately?: boolean; reason?: string },
  ) {
    await this.subscriptionService.cancelSubscription(
      req.user.id,
      body.reason ||
        (body.immediately ? "Immediate cancellation" : "End of billing period"),
    );

    return {
      success: true,
      message: body.immediately
        ? "구독이 즉시 취소되었습니다"
        : "구독이 현재 결제 기간 종료 후 취소됩니다",
    };
  }

  /**
   * 취소된 구독 재활성화
   * 아직 만료되지 않은 경우에만 가능
   */
  @Post("resume")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구독 재활성화" })
  @HttpCode(HttpStatus.OK)
  async resumeSubscription(@Request() req) {
    await this.subscriptionService.resumeSubscription(req.user.id);

    return {
      success: true,
      message: "구독이 재활성화되었습니다",
    };
  }

  /**
   * 플랜 다운그레이드 예약
   * 현재 결제 기간 종료 후 다음 주기부터 낮은 플랜 적용
   * 결제 없이 예약만 — 다음 정기결제 시 새 플랜 가격으로 청구
   */
  @Post("schedule-downgrade")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "플랜 다운그레이드 예약" })
  @HttpCode(HttpStatus.OK)
  async scheduleDowngrade(
    @Request() req,
    @Body() body: { tier: string; billingCycle?: string },
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptionService.getUserSubscription(userId);

    if (!subscription) {
      throw new BadRequestException("활성 구독이 없습니다");
    }

    // 다운그레이드 검증
    const tierOrder: Record<string, number> = { free: 0, starter: 1, pro: 2 };
    const currentLevel = tierOrder[subscription.tier?.toLowerCase()] ?? 0;
    const targetLevel = tierOrder[body.tier?.toLowerCase()] ?? 0;

    // 이미 FREE면 다운그레이드 불가
    if (currentLevel === 0) {
      throw new BadRequestException("이미 Free 플랜입니다. 다운그레이드할 수 없습니다.");
    }

    if (targetLevel >= currentLevel) {
      throw new BadRequestException("다운그레이드는 현재 플랜보다 낮은 플랜만 가능합니다");
    }

    // 이미 취소된 구독은 다운그레이드 불가
    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException("이미 취소된 구독입니다. 구독을 재활성화한 후 다운그레이드해주세요.");
    }

    // FREE로 다운그레이드 = 구독 취소와 동일
    if (body.tier?.toLowerCase() === "free") {
      await this.subscriptionService.cancelSubscription(userId, "다운그레이드: Free 플랜으로 전환");
      return {
        success: true,
        message: `현재 결제 기간 종료 후 Free 플랜으로 전환됩니다`,
        effectiveDate: subscription.endDate || subscription.nextBillingDate,
      };
    }

    // 유료 플랜 간 다운그레이드: metadata에 예약 정보 저장
    // 다음 정기결제 시 BillingProcessor가 새 플랜 가격으로 청구
    subscription.metadata = {
      ...subscription.metadata,
      scheduledDowngrade: {
        targetTier: body.tier,
        targetBillingCycle: body.billingCycle || subscription.billingCycle,
        scheduledAt: new Date().toISOString(),
      },
    };

    await this.subscriptionService.saveSubscription(subscription);

    return {
      success: true,
      message: `현재 결제 기간 종료 후 ${body.tier} 플랜으로 변경됩니다`,
      effectiveDate: subscription.endDate || subscription.nextBillingDate,
    };
  }

  /**
   * 플랜 다운그레이드 예약 취소
   */
  @Post("cancel-downgrade")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "다운그레이드 예약 취소" })
  @HttpCode(HttpStatus.OK)
  async cancelDowngrade(@Request() req) {
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);

    if (!subscription?.metadata?.scheduledDowngrade) {
      throw new BadRequestException("예약된 다운그레이드가 없습니다");
    }

    // metadata에서 예약 정보 제거
    const { scheduledDowngrade, ...restMetadata } = subscription.metadata as any;
    subscription.metadata = restMetadata;
    await this.subscriptionService.saveSubscription(subscription);

    return {
      success: true,
      message: "다운그레이드 예약이 취소되었습니다. 현재 플랜이 유지됩니다.",
    };
  }

  /**
   * 사용량 통계 조회
   * 현재 월의 사용량과 제한 정보
   */
  @Get("usage")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용량 통계 조회" })
  async getUsage(@Request() req) {
    // SubscriptionFacadeService를 통해 사용량 정보 조회
    const result = await this.facadeService.getMySubscriptionWithUsage(
      req.user.id,
    );

    return {
      success: true,
      data: result.usage,
    };
  }

  /**
   * 사용량 히스토리 조회
   * 과거 월별 사용량 기록
   */
  @Get("usage/history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용량 히스토리 조회" })
  async getUsageHistory(@Request() req, @Query("months") months: number = 6) {
    // 날짜 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // SubscriptionFacadeService를 통해 사용량 히스토리 조회
    const history = await this.facadeService.getUsageHistory(
      req.user.id,
      undefined, // resourceType - 모든 타입
      startDate,
      endDate,
    );

    return {
      success: true,
      data: history,
    };
  }

  /**
   * 결제 히스토리 조회
   * 과거 결제 내역 및 인보이스
   */
  @Get("payment-history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "결제 히스토리 조회" })
  async getPaymentHistory(@Request() req, @Query("limit") limit: number = 10) {
    // SubscriptionFacadeService를 통해 결제 히스토리 조회
    const history = await this.facadeService.getPaymentHistory(
      req.user.id,
      limit,
    );

    return {
      success: true,
      data: history,
    };
  }

  /**
   * 결제 수단 목록 조회
   */
  @Get("payment-methods")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "등록된 결제 수단 조회" })
  async getPaymentMethods(@Request() req) {
    // SubscriptionFacadeService를 통해 결제 수단 조회
    const methods = await this.facadeService.getPaymentMethods(req.user.id);

    return {
      success: true,
      data: methods,
    };
  }

  /**
   * 기본 결제 수단 변경
   */
  @Put("payment-methods/default")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "기본 결제 수단 변경" })
  async setDefaultPaymentMethod(
    @Request() req,
    @Body() body: { paymentMethodId: string },
  ) {
    // SubscriptionFacadeService를 통해 기본 결제 수단 변경
    await this.facadeService.setDefaultPaymentMethod(
      req.user.id,
      body.paymentMethodId,
    );

    return {
      success: true,
      message: "기본 결제 수단이 변경되었습니다",
    };
  }

  /**
   * 환불 요청
   * 관리자 승인이 필요할 수 있음
   */
  @Post("refund")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "환불 요청" })
  @HttpCode(HttpStatus.OK)
  async requestRefund(
    @Request() req,
    @Body()
    body: {
      paymentId: string;
      reason: string;
      amount?: number; // 부분 환불 금액
    },
  ) {
    // SubscriptionFacadeService를 통해 환불 요청
    const refund = await this.facadeService.createRefund(
      req.user.id,
      body.paymentId,
      body.reason,
      body.amount,
    );

    return {
      success: true,
      data: refund,
    };
  }

  /**
   * 플랜 업그레이드 시뮬레이션 (비례배분 미리보기)
   * 실제 결제 없이 차액, 잔여일수 등 계산 결과 반환
   */
  @Post("simulate-upgrade")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "업그레이드 비례배분 시뮬레이션" })
  async simulateUpgrade(
    @Request() req,
    @Body()
    body: {
      tier: SubscriptionTier;
      billingCycle: BillingCycle;
    },
  ) {
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);
    const proration = await this.subscriptionService.calculateProration(
      subscription,
      body.tier,
      body.billingCycle,
    );

    return {
      success: true,
      data: proration,
    };
  }

  /**
   * 즉시 업그레이드 (비례배분 차액 결제)
   * 기존 빌링키로 차액만 결제하고 플랜 즉시 변경
   */
  @Post("upgrade")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구독 업그레이드 (비례배분)" })
  @HttpCode(HttpStatus.OK)
  async upgradeSubscription(
    @Request() req,
    @Body()
    body: {
      tier: SubscriptionTier;
      billingCycle: BillingCycle;
    },
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptionService.getUserSubscription(userId);

    // 업그레이드 검증
    const tierOrder: Record<string, number> = { free: 0, starter: 1, pro: 2 };
    const currentLevel = tierOrder[subscription.tier?.toLowerCase()] ?? 0;
    const targetLevel = tierOrder[body.tier?.toLowerCase()] ?? 0;

    if (targetLevel <= currentLevel) {
      throw new BadRequestException("업그레이드는 현재 플랜보다 높은 플랜만 가능합니다");
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException("활성 구독만 업그레이드할 수 있습니다");
    }

    // 비례배분 계산
    const proration = await this.subscriptionService.calculateProration(
      subscription,
      body.tier,
      body.billingCycle,
    );

    // 차액이 있으면 기존 빌링키로 결제
    if (proration.proratedAmount > 0) {
      const result = await this.facadeService.chargeUpgradeProration(
        userId,
        subscription,
        proration,
        body.tier,
        body.billingCycle,
      );

      return {
        success: true,
        data: {
          subscription: result.subscription,
          chargedAmount: proration.proratedAmount,
          proration,
          message: `${proration.newPlan.displayName} 플랜으로 업그레이드되었습니다`,
        },
      };
    }

    // 차액이 0이면 (무료→유료 등) 플랜만 변경
    const updated = await this.subscriptionService.updateUserSubscription(
      userId,
      body.tier,
      body.billingCycle,
    );

    return {
      success: true,
      data: {
        subscription: updated,
        chargedAmount: 0,
        proration,
        message: `${proration.newPlan.displayName} 플랜으로 업그레이드되었습니다`,
      },
    };
  }

  /**
   * 웹훅 엔드포인트 - 결제 서비스에서 호출
   * Stripe, Toss 등에서 결제 이벤트 발생 시 호출
   */
  @Post("webhook/:provider")
  @ApiOperation({ summary: "결제 웹훅 처리" })
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param("provider") provider: string,
    @Body() payload: any,
    @Request() req,
  ) {
    // 서명 검증 (실제 구현 시 필수)
    const signature =
      req.headers["stripe-signature"] || req.headers["x-webhook-signature"];

    // SubscriptionFacadeService를 통해 웹훅 처리
    await this.facadeService.handleWebhook(provider, payload, signature);

    return {
      success: true,
      message: "Webhook processed",
    };
  }
}
