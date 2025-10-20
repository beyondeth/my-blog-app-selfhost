import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 댓글 페이지네이션 조회 DTO
 *
 * @설명
 * - 부모 댓글만 페이지네이션 조회
 * - 최신순/인기순 정렬 지원
 * - 스냅샷 타임스탬프 방식으로 중복/누락 방지
 *
 * @커서_구조
 * - Base64 인코딩된 JSON: { likesCount?, createdAt, id }
 * - 최신순: { createdAt, id }
 * - 인기순: { likesCount, createdAt, id }
 *
 * @스냅샷_방식
 * - 인기순 정렬 시 좋아요 수 실시간 변경으로 인한 중복/누락 방지
 * - 첫 로드 시점의 타임스탬프를 저장하여 이후 페이지는 동일 시점 기준 조회
 */
export class GetCommentsDto {
  @ApiPropertyOptional({
    description: 'Base64 인코딩된 커서 (다음 페이지 요청 시 사용)',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI1LTEwLTIwVDEyOjAwOjAwWiIsImlkIjoidXVpZCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: '페이지당 댓글 개수',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '정렬 방식',
    enum: ['recent', 'popular'],
    default: 'recent',
  })
  @IsOptional()
  @IsIn(['recent', 'popular'])
  sort?: 'recent' | 'popular' = 'recent';

  @ApiPropertyOptional({
    description: '스냅샷 타임스탬프 (인기순 정렬 시 중복/누락 방지용)',
    example: '2025-10-20T12:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  snapshotTimestamp?: string;
}
