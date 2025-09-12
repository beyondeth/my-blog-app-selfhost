import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({
    description: 'Page number',
    minimum: 1,
    default: 1,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 20,
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20) // 최대 20개로 제한 - 보안 및 성능 최적화
  @IsOptional()
  limit: number = 20;
}

// 특수한 경우를 위한 확장 DTO (관리자 전용 등)
export class AdminPaginationDto extends PaginationDto {
  @ApiProperty({
    description: 'Number of items per page (admin can request up to 50)',
    minimum: 1,
    maximum: 50,
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50) // 관리자는 최대 50개까지
  @IsOptional()
  limit: number = 20;
}

// Helper class for consistent pagination validation
export class PaginationHelper {
  /**
   * 안전한 limit 값 반환 (최대 20개)
   */
  static getSafeLimit(limit?: number | string, maxLimit: number = 20): number {
    const parsed = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const value = parsed || 20;
    return Math.min(Math.max(value, 1), maxLimit);
  }

  /**
   * 안전한 page 값 반환 (최소 1)
   */
  static getSafePage(page?: number | string): number {
    const parsed = typeof page === 'string' ? parseInt(page, 10) : page;
    const value = parsed || 1;
    return Math.max(value, 1);
  }

  /**
   * offset 계산
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * 총 페이지 수 계산
   */
  static getTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }
}