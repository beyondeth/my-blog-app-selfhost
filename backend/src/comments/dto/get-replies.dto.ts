import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 답글 페이지네이션 조회 DTO
 *
 * @설명
 * - 특정 부모 댓글의 답글만 조회
 * - 최신순 정렬 (답글은 오래된 순서대로 표시)
 * - 커서 기반 무한 스크롤
 *
 * @정렬
 * - 답글은 항상 createdAt ASC (오래된 것부터)
 * - 대댓글도 동일 (스레드 형태 유지)
 */
export class GetRepliesDto {
  @ApiPropertyOptional({
    description: 'Base64 인코딩된 커서',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI1LTEwLTIwVDEyOjAwOjAwWiIsImlkIjoidXVpZCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: '페이지당 답글 개수',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
