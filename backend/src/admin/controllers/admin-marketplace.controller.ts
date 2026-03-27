import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { AdminMarketplaceService } from "../services/admin-marketplace.service";

/**
 * 관리자 마켓플레이스 관제 컨트롤러
 * ADMIN 전용 — 플랫폼 전체 거래 관제
 */
@ApiTags("Admin Marketplace")
@Controller("admin/marketplace")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminMarketplaceController {
  constructor(
    private readonly adminMarketplaceService: AdminMarketplaceService,
  ) {}

  /** 플랫폼 전체 통계 */
  @Get("stats")
  @ApiOperation({ summary: "마켓플레이스 전체 통계" })
  async getStats() {
    const data = await this.adminMarketplaceService.getStats();
    return { success: true, data };
  }

  /** 매출 트렌드 */
  @Get("analytics")
  @ApiOperation({ summary: "매출 트렌드" })
  async getAnalytics(@Query("days") days?: number) {
    const data = await this.adminMarketplaceService.getAnalytics(days || 30);
    return { success: true, data };
  }

  /** 전체 상품 목록 */
  @Get("products")
  @ApiOperation({ summary: "전체 상품 목록" })
  async getProducts(
    @Query("category") category?: string,
    @Query("isActive") isActive?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    const data = await this.adminMarketplaceService.getProducts({
      category,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search,
      limit: limit || 20,
      offset: offset || 0,
    });
    return { success: true, data };
  }

  /** 상품 강제 활성화/비활성화 */
  @Patch("products/:id/status")
  @ApiOperation({ summary: "상품 강제 상태 변경" })
  async toggleProductStatus(
    @Param("id") id: string,
    @Body() body: { isActive: boolean; reason: string },
  ) {
    const data = await this.adminMarketplaceService.forceToggleProduct(
      id,
      body.isActive,
      body.reason,
    );
    return { success: true, data };
  }

  /** 전체 주문 목록 */
  @Get("orders")
  @ApiOperation({ summary: "전체 주문 목록" })
  async getOrders(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    const data = await this.adminMarketplaceService.getOrders({
      status,
      search,
      limit: limit || 20,
      offset: offset || 0,
    });
    return { success: true, data };
  }

  /** 환불 요청 목록 */
  @Get("refunds")
  @ApiOperation({ summary: "환불 요청 목록" })
  async getRefunds(
    @Query("status") status?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    const data = await this.adminMarketplaceService.getRefundRequests({
      status,
      limit: limit || 20,
      offset: offset || 0,
    });
    return { success: true, data };
  }

  /** 관리자 강제 환불 승인 */
  @Post("refunds/:id/force-approve")
  @ApiOperation({ summary: "관리자 강제 환불 승인" })
  async forceApproveRefund(
    @Request() req: any,
    @Param("id") id: string,
  ) {
    const data = await this.adminMarketplaceService.forceApproveRefund(
      id,
      req.user.id,
    );
    return { success: true, data };
  }

  /** 관리자 강제 환불 거부 */
  @Post("refunds/:id/force-reject")
  @ApiOperation({ summary: "관리자 강제 환불 거부" })
  async forceRejectRefund(
    @Request() req: any,
    @Param("id") id: string,
    @Body() body: { reason: string },
  ) {
    const data = await this.adminMarketplaceService.forceRejectRefund(
      id,
      req.user.id,
      body.reason,
    );
    return { success: true, data };
  }

  /** 판매자 목록 + 매출 순위 */
  @Get("sellers")
  @ApiOperation({ summary: "판매자 매출 순위" })
  async getSellers(@Query("limit") limit?: number) {
    const data = await this.adminMarketplaceService.getSellers(limit || 20);
    return { success: true, data };
  }
}
