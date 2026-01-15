import { Type } from "class-transformer";
import { IsInt, Min, Max, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 오프셋 기반 페이지네이션 DTO
 *
 * @description 일반적인 페이지네이션에 사용
 * - 장점: 임의 페이지 접근 가능
 * - 단점: 대량 데이터에서 성능 저하 (OFFSET 스캔)
 */
export class PaginationDto {
  @ApiProperty({
    description: "Page number",
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
    description: "Number of items per page",
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
    description: "Number of items per page (admin can request up to 50)",
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
    const parsed = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const value = parsed || 20;
    return Math.min(Math.max(value, 1), maxLimit);
  }

  /**
   * 안전한 page 값 반환 (최소 1)
   */
  static getSafePage(page?: number | string): number {
    const parsed = typeof page === "string" ? parseInt(page, 10) : page;
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

// =========================================================================
// 커서 기반 페이지네이션
// =========================================================================

/**
 * 커서 기반 페이지네이션 DTO
 *
 * @description 무한 스크롤, 대량 데이터에 적합
 * - 장점: 대량 데이터에서도 일정한 성능 (인덱스 활용)
 * - 단점: 임의 페이지 접근 불가
 *
 * 커서는 "마지막으로 조회한 아이템의 정렬 기준값"을 의미
 * - memberCount 정렬: cursor = memberCount 값
 * - createdAt 정렬: cursor = createdAt ISO 문자열
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: "커서 (마지막 조회 아이템의 정렬 기준값)",
    example: "100",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: "커서 아이템 ID (동일 정렬값 구분용)",
    example: "01234567-89ab-cdef-0123-456789abcdef",
  })
  @IsOptional()
  @IsString()
  cursorId?: string;

  @ApiProperty({
    description: "조회할 아이템 개수",
    minimum: 1,
    maximum: 20,
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit: number = 20;
}

/**
 * 커서 페이지네이션 응답 인터페이스
 */
export interface CursorPaginationResponse<T> {
  items: T[];
  nextCursor: string | null;
  nextCursorId: string | null;
  hasNext: boolean;
}

/**
 * 커서 페이지네이션 헬퍼
 */
export class CursorPaginationHelper {
  /**
   * 안전한 limit 값 반환
   */
  static getSafeLimit(limit?: number | string, maxLimit: number = 20): number {
    const parsed = typeof limit === "string" ? parseInt(limit, 10) : limit;
    const value = parsed || 20;
    return Math.min(Math.max(value, 1), maxLimit);
  }

  /**
   * 다음 커서 생성
   *
   * @param item - 마지막 아이템
   * @param sortField - 정렬 기준 필드명
   * @returns 커서 값 (문자열)
   */
  static generateCursor<T extends Record<string, unknown>>(
    item: T,
    sortField: keyof T,
  ): string {
    const value = item[sortField];

    // Date 객체면 ISO 문자열로 변환
    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value);
  }

  /**
   * 커서 값 파싱 (숫자)
   */
  static parseNumericCursor(cursor: string): number {
    const parsed = parseInt(cursor, 10);
    if (isNaN(parsed)) {
      throw new Error("Invalid numeric cursor");
    }
    return parsed;
  }

  /**
   * 커서 값 파싱 (날짜)
   */
  static parseDateCursor(cursor: string): Date {
    const parsed = new Date(cursor);
    if (isNaN(parsed.getTime())) {
      throw new Error("Invalid date cursor");
    }
    return parsed;
  }
}
