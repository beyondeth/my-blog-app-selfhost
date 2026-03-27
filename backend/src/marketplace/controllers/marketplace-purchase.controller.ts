import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MarketplacePurchaseService } from "../services/marketplace-purchase.service";
import { MarketplaceDownloadService } from "../services/marketplace-download.service";
import { PreparePurchaseDto } from "../dto/prepare-purchase.dto";
import { ConfirmPurchaseDto } from "../dto/confirm-purchase.dto";

/**
 * 마켓플레이스 구매 컨트롤러
 *
 * 구매 플로우:
 * 1. POST /marketplace/purchase/prepare → 주문 생성 + 토스 결제 파라미터
 * 2. 프론트: 토스 결제창 → 결제 완료 → successUrl 리다이렉트
 * 3. POST /marketplace/purchase/confirm → 결제 승인 + 주문 완료
 */
@ApiTags("Marketplace Purchase")
@Controller("marketplace/purchase")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplacePurchaseController {
  constructor(
    private readonly purchaseService: MarketplacePurchaseService,
    private readonly downloadService: MarketplaceDownloadService,
  ) {}

  /**
   * 구매 준비 — 주문 생성 + 토스 결제 파라미터 반환
   */
  @Post("prepare")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "구매 준비 (주문 생성)" })
  async preparePurchase(
    @Request() req,
    @Body() dto: PreparePurchaseDto,
  ) {
    const result = await this.purchaseService.preparePurchase(
      req.user.id,
      dto.productPostId,
    );

    return { success: true, data: result };
  }

  /**
   * 구매 확인 — 토스 결제 승인 + 주문 완료
   */
  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "구매 확인 (결제 승인)" })
  async confirmPurchase(
    @Request() req,
    @Body() dto: ConfirmPurchaseDto,
  ) {
    const result = await this.purchaseService.confirmPurchase(
      req.user.id,
      dto.paymentKey,
      dto.orderId,
      dto.amount,
    );

    return { success: true, data: result };
  }

  /**
   * 내 구매 내역
   */
  @Get()
  @ApiOperation({ summary: "내 구매 내역" })
  async getMyPurchases(
    @Request() req,
    @Query("limit") limit?: number,
  ) {
    const purchases = await this.purchaseService.getMyPurchases(
      req.user.id,
      limit || 20,
    );

    return { success: true, data: purchases };
  }

  /**
   * 보안 다운로드 URL 발급
   * S3 presigned URL (1시간 만료) + 다운로드 횟수 제한 (최대 5회)
   */
  @Get("download/:orderId")
  @ApiOperation({ summary: "구매 상품 다운로드 URL 발급" })
  async getDownloadUrl(
    @Request() req,
    @Param("orderId") orderId: string,
  ) {
    const result = await this.downloadService.getSecureDownloadUrl(
      req.user.id,
      orderId,
    );

    return { success: true, data: result };
  }
}
