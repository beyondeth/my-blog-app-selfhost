import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cursor Pagination용 포스트 조회 DTO
 *
 * @description
 * 기존 오프셋 기반 페이지네이션의 성능 문제를 해결하기 위한 커서 기반 페이지네이션 DTO
 *
 * @성능차이
 * - OFFSET 방식: 10만번째 레코드 조회 시 앞의 99,999개를 모두 스캔 (O(n))
 * - CURSOR 방식: 마지막 레코드의 값을 기준으로 직접 조회 (O(1))
 *
 * @사용예시
 * ```typescript
 * // 첫 페이지 조회
 * GET /api/v1/posts/cursor?limit=20&sort=recent
 *
 * // 다음 페이지 조회 (nextCursor 사용)
 * GET /api/v1/posts/cursor?cursor=MjAyNS0wMS0yMFQxMjowMDowMC4wMDBafGFiYzEyMw==&limit=20&sort=recent
 * ```
 *
 * @Cursor_형식
 * Base64 인코딩된 문자열: `publishedAt|id`
 * 예: "2025-01-20T12:00:00.000Z|abc123" → Base64 → "MjAyNS0wMS0yMFQxMjowMDowMC4wMDBafGFiYzEyMw=="
 */
export class GetPostsCursorDto {
  @ApiPropertyOptional({
    description: 'Cursor (Base64 인코딩된 문자열, 첫 페이지는 생략)',
    example: 'MjAyNS0wMS0yMFQxMjowMDowMC4wMDBafGFiYzEyMw==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: '페이지당 항목 수 (기본: 20, 최대: 50)',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '정렬 방식 (recent: 최신순, popular: 인기순, trending: 트렌딩)',
    enum: ['recent', 'popular', 'trending'],
    default: 'recent',
  })
  @IsOptional()
  @IsIn(['recent', 'popular', 'trending'])
  sort?: 'recent' | 'popular' | 'trending' = 'recent';

  @ApiPropertyOptional({
    description: '카테고리 필터 (예: JavaScript, JavaScript/React)',
    example: 'JavaScript/React',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: '블로그 슬러그 (특정 블로그의 포스트만 조회)',
    example: 'john-blog',
  })
  @IsOptional()
  @IsString()
  blogSlug?: string;

  @ApiPropertyOptional({
    description: '검색 키워드 (제목, 내용, 태그 검색)',
    example: 'React Hooks',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
