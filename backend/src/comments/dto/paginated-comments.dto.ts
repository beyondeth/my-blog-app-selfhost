import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentResponseDto } from './comment-response.dto';

/**
 * 페이지네이션된 댓글 응답 DTO
 *
 * @설명
 * - 커서 기반 페이지네이션 응답
 * - 다음 페이지 존재 여부 명시
 * - 전체 댓글 개수 포함 (첫 페이지만)
 *
 * @커서_처리
 * - nextCursor가 null이면 마지막 페이지
 * - nextCursor를 다음 요청의 cursor 파라미터로 전달
 */
export class PaginatedCommentsDto {
  @ApiProperty({
    description: '댓글 목록',
    type: [CommentResponseDto],
  })
  comments: CommentResponseDto[];

  @ApiPropertyOptional({
    description: '다음 페이지 커서 (Base64 인코딩)',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI1LTEwLTIwVDEyOjAwOjAwWiIsImlkIjoidXVpZCJ9',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasNextPage: boolean;

  @ApiPropertyOptional({
    description: '전체 부모 댓글 개수 (첫 페이지에만 포함)',
    example: 150,
  })
  totalCount?: number;

  @ApiPropertyOptional({
    description: '스냅샷 타임스탬프 (인기순 정렬 시 반환)',
    example: '2025-10-20T12:00:00.000Z',
  })
  snapshotTimestamp?: string;
}
