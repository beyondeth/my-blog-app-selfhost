import { Exclude, Expose, Type } from "class-transformer";
import { UserResponseDto } from "../../users/dto/user-response.dto";

/**
 * 커뮤니티 댓글 응답 DTO
 *
 * @description
 * 커뮤니티 댓글 정보 전달용 DTO
 * 대댓글은 replies 배열로 중첩 포함 가능
 */
@Exclude()
export class CommunityCommentResponseDto {
  @Expose()
  id: string;

  @Expose()
  postId: string;

  @Expose()
  content: string;

  @Expose()
  parentCommentId: string;

  @Expose()
  likeCount: number;

  @Expose()
  replyCount: number;

  @Expose()
  isDeleted: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // 작성자 정보
  @Expose()
  authorId: string;

  @Expose()
  @Type(() => UserResponseDto)
  author?: UserResponseDto;

  // 현재 사용자의 좋아요 여부
  @Expose()
  userLiked?: boolean;

  // 대댓글 목록 (중첩)
  @Expose()
  @Type(() => CommunityCommentResponseDto)
  replies?: CommunityCommentResponseDto[];

  // 관계 필드 제외
  @Exclude()
  post: any;

  @Exclude()
  parentComment: any;

  @Exclude()
  childComments: any;

  @Exclude()
  likes: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}

/**
 * 페이지네이션 포함 댓글 목록 응답
 */
export class PaginatedCommunityCommentsDto {
  @Type(() => CommunityCommentResponseDto)
  items: CommunityCommentResponseDto[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
