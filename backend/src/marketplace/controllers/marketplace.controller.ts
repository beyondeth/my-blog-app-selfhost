import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { MarketplaceService } from "../services/marketplace.service";
import { BrowseMarketplaceDto } from "../dto/browse-marketplace.dto";

/**
 * 마켓플레이스 공개 컨트롤러
 *
 * 상품 브라우징, 카테고리 조회, 상품 상세
 * 인증 선택: 로그인 시 구매 여부 표시
 */
@ApiTags("Marketplace")
@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  /**
   * 마켓플레이스 상품 목록
   * cursor 기반 페이지네이션, 카테고리/검색/가격 필터, 정렬
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "마켓플레이스 상품 목록" })
  async browse(@Query() dto: BrowseMarketplaceDto) {
    const result = await this.marketplaceService.browse(dto);
    return { success: true, data: result };
  }

  /**
   * 카테고리별 상품 수
   */
  @Get("categories")
  @ApiOperation({ summary: "카테고리 목록 + 상품 수" })
  async getCategories() {
    const categories = await this.marketplaceService.getCategoryCounts();
    return { success: true, data: categories };
  }

  /**
   * 상품 상세
   * - 미로그인/미구매: 미리보기만
   * - 구매 완료: 전체 본문 + 다운로드 URL
   */
  @Get("products/:slug")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "상품 상세 조회" })
  async getProductDetail(
    @Param("slug") slug: string,
    @Request() req,
  ) {
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;
    const product = await this.marketplaceService.getProductDetail(
      slug,
      userId,
      userRole,
    );
    return { success: true, data: product };
  }
}
