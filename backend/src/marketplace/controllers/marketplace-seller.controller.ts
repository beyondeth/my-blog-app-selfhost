import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MarketplaceSellerService } from "../services/marketplace-seller.service";

/**
 * 판매자 대시보드 컨트롤러
 */
@ApiTags("Marketplace Seller")
@Controller("marketplace/seller")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceSellerController {
  constructor(
    private readonly sellerService: MarketplaceSellerService,
  ) {}

  /** 판매자 대시보드 요약 */
  @Get("dashboard")
  @ApiOperation({ summary: "판매자 대시보드" })
  async getDashboard(@Request() req: any) {
    const data = await this.sellerService.getDashboard(req.user.id);
    return { success: true, data };
  }

  /** 판매자 주문 목록 */
  @Get("orders")
  @ApiOperation({ summary: "판매자 주문 목록" })
  async getOrders(
    @Request() req: any,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
  ) {
    const data = await this.sellerService.getSellerOrders(
      req.user.id,
      limit || 20,
      cursor,
    );
    return { success: true, data };
  }

  /** 판매자 상품 목록 */
  @Get("products")
  @ApiOperation({ summary: "판매자 상품 목록" })
  async getProducts(@Request() req: any) {
    const data = await this.sellerService.getSellerProducts(req.user.id);
    return { success: true, data };
  }

  /** 상품 판매 중지/재개 */
  @Patch("products/:postId/toggle")
  @ApiOperation({ summary: "상품 판매 중지/재개" })
  async toggleProduct(
    @Request() req: any,
    @Param("postId") postId: string,
  ) {
    const data = await this.sellerService.toggleProductActive(
      req.user.id,
      postId,
    );
    return { success: true, data };
  }
}
