import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

/**
 * Cursor Pagination 응답 DTO
 *
 * @description
 * 무한 스크롤(Infinite Scroll) UI를 위한 커서 기반 페이지네이션 응답 형식
 *
 * @차이점
 * - 기존 Offset 방식: { posts: [], total: 1000, page: 5, totalPages: 50 }
 * - Cursor 방식: { posts: [], nextCursor: "...", hasMore: true }
 *
 * @장점
 * 1. 성능: 대규모 데이터셋에서도 일정한 응답속도 (O(1))
 * 2. 일관성: 새 포스트 추가 시에도 중복/누락 없음
 * 3. 무한스크롤: 프론트엔드에서 React Query의 useInfiniteQuery와 완벽한 호환
 *
 * @프론트엔드_사용예시
 * ```typescript
 * const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
 *   queryKey: ['posts', 'cursor'],
 *   queryFn: ({ pageParam }) =>
 *     fetch(`/api/v1/posts/cursor?cursor=${pageParam || ''}`).then(r => r.json()),
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * });
 * ```
 */
export class CursorPaginatedPostsDto {
  @ApiProperty({
    description: '포스트 목록',
    type: [PostResponseDto],
  })
  posts: PostResponseDto[];

  @ApiProperty({
    description: '다음 페이지 커서 (Base64 인코딩, null이면 마지막 페이지)',
    example: 'MjAyNS0wMS0yMFQxMjowMDowMC4wMDBafGFiYzEyMw==',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: '현재 페이지 아이템 수',
    example: 20,
  })
  count: number;
}
