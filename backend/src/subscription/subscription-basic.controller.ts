import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";

/**
 * 구독 기본 컨트롤러
 * 핵심 구독 기능만 포함한 최소 버전
 */
@Controller("subscription")
export class SubscriptionBasicController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * 모든 구독 플랜 조회 (공개 엔드포인트)
   */
  @Get("plans")
  @Public()
  async getPlans() {
    const plans = await this.subscriptionService.getAllPlans();
    return {
      success: true,
      data: plans.map((plan) => ({
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        pricing: plan.pricing,
        features: plan.features,
        metadata: plan.metadata, // metadata 추가 (highlights 포함)
        isActive: plan.isActive,
      })),
    };
  }

  /**
   * 현재 사용자의 구독 정보 조회
   */
  @Get("current")
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(@Request() req) {
    const subscription = await this.subscriptionService.getUserSubscription(
      req.user.id,
    );
    return {
      success: true,
      data: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.startDate,
        currentPeriodEnd: subscription.nextBillingDate,
        cancelledAt: subscription.canceledAt,
        cancelReason: subscription.cancelReason,
        autoRenew: subscription.autoRenew,
      },
    };
  }

  /**
   * 특정 티어의 플랜 상세 조회
   */
  @Get("plans/:tier")
  @Public()
  async getPlanByTier(@Param("tier") tier: string) {
    const plan = await this.subscriptionService.getPlanByTier(tier as any);
    return {
      success: true,
      data: plan,
    };
  }

  /**
   * 결제 이력 조회
   */
  @Get("payment-history")
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@Request() req) {
    const history = await this.subscriptionService.getPaymentHistory(
      req.user.id,
    );
    return {
      success: true,
      data: history,
    };
  }

  /**
   * 체크아웃 세션 생성 (결제 페이지로 이동)
   * tier와 billingCycle을 받아서 처리
   */
  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @Request() req,
    @Body()
    body: {
      tier: string;
      billingCycle: "monthly" | "yearly";
      provider?: string;
    },
  ) {
    // tier로 플랜을 찾아서 planId를 가져옴
    const plan = await this.subscriptionService.getPlanByTier(body.tier as any);
    if (!plan) {
      throw new Error("유효하지 않은 플랜입니다");
    }

    const session = await this.subscriptionService.createCheckoutSession(
      req.user.id,
      plan.id, // planId 사용
      body.billingCycle as any,
    );
    return {
      success: true,
      data: session,
    };
  }

  /**
   * 구독 취소
   */
  @Post("cancel")
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@Request() req, @Body() body: { reason?: string }) {
    const subscription = await this.subscriptionService.cancelSubscription(
      req.user.id,
      body.reason || "User requested cancellation",
    );
    return {
      success: true,
      data: subscription,
      message:
        "구독이 취소되었습니다. 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있습니다.",
    };
  }

  /**
   * 구독 재개
   */
  @Post("resume")
  @UseGuards(JwtAuthGuard)
  async resumeSubscription(@Request() req) {
    const subscription = await this.subscriptionService.resumeSubscription(
      req.user.id,
    );
    return {
      success: true,
      data: subscription,
      message: "구독이 재개되었습니다.",
    };
  }
}
