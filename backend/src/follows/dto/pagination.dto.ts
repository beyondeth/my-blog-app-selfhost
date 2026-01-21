import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsInt, Min, Max, IsString, IsUUID } from "class-validator";

export class PaginationQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 커서 기반 페이지네이션 쿼리 DTO
 * - OFFSET 미사용으로 대규모 데이터 효율적 처리
 */
export class CursorPaginationQueryDto {
  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({
    required: false,
    description: "커서 (마지막 아이템의 createdAt)",
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiProperty({ required: false, description: "커서 ID (마지막 아이템의 id)" })
  @IsUUID()
  @IsOptional()
  cursorId?: string;
}

/**
 * 커서 기반 페이지네이션 응답 DTO
 */
export class CursorPaginatedResponseDto<T> {
  data: T[];
  total: number;
  hasNext: boolean;
  nextCursor: string | null;
  nextCursorId: string | null;
}
