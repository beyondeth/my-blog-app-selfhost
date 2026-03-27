import {
  Controller,
  Post,
  Put,
  Delete,
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
import { MarketplaceDeliveryService } from "../services/marketplace-delivery.service";

/**
 * 마켓플레이스 배송 항목 컨트롤러
 *
 * 판매자: 배송 항목 CRUD + 순서 변경
 * 구매자: 구매한 상품의 배송 항목 조회
 */
@ApiTags("Marketplace Delivery")
@Controller("marketplace")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceDeliveryController {
  constructor(
    private readonly deliveryService: MarketplaceDeliveryService,
  ) {}

  // ── 판매자 엔드포인트 ──

  @Post("seller/products/:productDetailId/delivery-items")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "배송 항목 추가" })
  async addDeliveryItem(
    @Request() req: { user: { id: string } },
    @Param("productDetailId") productDetailId: string,
    @Body()
    body: {
      type: "content_html" | "file" | "external_link";
      label: string;
      contentHtml?: string;
      fileKey?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      externalUrl?: string;
    },
  ) {
    const item = await this.deliveryService.addDeliveryItem(
      req.user.id,
      productDetailId,
      body,
    );
    return { success: true, data: item };
  }

  @Put("seller/delivery-items/:itemId")
  @ApiOperation({ summary: "배송 항목 수정" })
  async updateDeliveryItem(
    @Request() req: { user: { id: string } },
    @Param("itemId") itemId: string,
    @Body()
    body: {
      label?: string;
      contentHtml?: string;
      fileKey?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      externalUrl?: string;
      isActive?: boolean;
    },
  ) {
    const item = await this.deliveryService.updateDeliveryItem(
      req.user.id,
      itemId,
      body,
    );
    return { success: true, data: item };
  }

  @Delete("seller/delivery-items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "배송 항목 삭제" })
  async removeDeliveryItem(
    @Request() req: { user: { id: string } },
    @Param("itemId") itemId: string,
  ) {
    await this.deliveryService.removeDeliveryItem(req.user.id, itemId);
    return { success: true };
  }

  @Put("seller/products/:productDetailId/delivery-items/reorder")
  @ApiOperation({ summary: "배송 항목 순서 변경" })
  async reorderDeliveryItems(
    @Request() req: { user: { id: string } },
    @Param("productDetailId") productDetailId: string,
    @Body() body: { itemIds: string[] },
  ) {
    await this.deliveryService.reorderDeliveryItems(
      req.user.id,
      productDetailId,
      body.itemIds,
    );
    return { success: true };
  }

  // ── 구매자 엔드포인트 ──

  @Get("purchases/:orderId/delivery-items")
  @ApiOperation({ summary: "구매한 상품의 배송 항목 조회" })
  async getDeliveryItems(
    @Request() req: { user: { id: string } },
    @Param("orderId") orderId: string,
  ) {
    const items = await this.deliveryService.getDeliveryItemsForBuyer(
      req.user.id,
      orderId,
    );
    return { success: true, data: items };
  }
}
