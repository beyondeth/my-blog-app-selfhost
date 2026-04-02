import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MarketplaceRefundService } from "../services/marketplace-refund.service";
import { RequestRefundDto } from "../dto/request-refund.dto";

/**
 * 마켓플레이스 환불 컨트롤러
 *
 * 환불 워크플로:
 * 구매자 요청 → 자격 자동 검증 → 판매자 승인/거부 → 토스 환불 처리
 */
@ApiTags("Marketplace Refund")
@Controller("marketplace/refund")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceRefundController {
  constructor(
    private readonly refundService: MarketplaceRefundService,
  ) {}

  /** 환불 요청 (구매자) */
  @Post("request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "환불 요청" })
  async requestRefund(
    @Request() req,
    @Body() body: RequestRefundDto,
  ) {
    const result = await this.refundService.requestRefund(
      req.user.id,
      body.orderId,
      body.reason,
      body.reasonCategory,
    );
    return { success: true, data: result };
  }

  /** 환불 자격 확인 (구매자 — 요청 전 미리 확인) */
  @Get("eligibility/:orderId")
  @ApiOperation({ summary: "환불 자격 확인" })
  async checkEligibility(
    @Request() req,
    @Param("orderId") orderId: string,
  ) {
    const result = await this.refundService.validateRefundEligibility(
      orderId,
      req.user.id,
    );
    return { success: true, data: result };
  }

  /** 환불 승인 (판매자) */
  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "환불 승인 (판매자)" })
  async approveRefund(
    @Request() req,
    @Param("id") id: string,
  ) {
    const result = await this.refundService.approveRefund(id, req.user.id);
    return { success: true, data: result };
  }

  /** 환불 거부 (판매자) */
  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "환불 거부 (판매자)" })
  async rejectRefund(
    @Request() req,
    @Param("id") id: string,
    @Body() body: { response: string },
  ) {
    const result = await this.refundService.rejectRefund(
      id,
      req.user.id,
      body.response,
    );
    return { success: true, data: result };
  }

  /** 내 환불 요청 목록 (구매자) */
  @Get("my-requests")
  @ApiOperation({ summary: "내 환불 요청 목록" })
  async getMyRequests(@Request() req) {
    const result = await this.refundService.getBuyerRefundRequests(req.user.id);
    return { success: true, data: result };
  }

  /** 받은 환불 요청 목록 (판매자) */
  @Get("seller-requests")
  @ApiOperation({ summary: "받은 환불 요청 목록" })
  async getSellerRequests(@Request() req) {
    const result = await this.refundService.getSellerRefundRequests(req.user.id);
    return { success: true, data: result };
  }
}
