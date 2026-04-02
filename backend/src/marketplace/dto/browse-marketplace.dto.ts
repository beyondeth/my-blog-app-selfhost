import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ProductCategory } from "../../common/enums/product-category.enum";

/**
 * 마켓플레이스 상품 목록 조회 DTO
 * cursor 기반 페이지네이션 + 필터 + 정렬
 */
export class BrowseMarketplaceDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  /** 카테고리 필터 */
  @IsOptional()
  @IsString()
  category?: ProductCategory;

  /** 검색어 (제목, 본문) */
  @IsOptional()
  @IsString()
  search?: string;

  /** 정렬 기준 */
  @IsOptional()
  @IsEnum(["recent", "popular", "price_low", "price_high"])
  sort?: "recent" | "popular" | "price_low" | "price_high" = "recent";

  /** 최소 가격 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  /** 최대 가격 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;
}
