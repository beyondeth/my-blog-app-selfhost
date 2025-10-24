import { Exclude, Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Comment 응답 DTO
 *
 * @description
 * 댓글 정보 전달용 DTO - Entity spread 연산자로 인한 lazy loading 방지
 *
 * @성능최적화
 * - Entity의 spread 연산자 사용 금지
 * - 필요한 필드만 명시적으로 노출
 * - 관계 필드는 lazy loading 방지를 위해 Type 데코레이터 사용
 */
@Exclude() // 기본적으로 모든 필드 제외
export class CommentResponseDto {
  @Expose()
  id: string;

  @Expose()
  content: string;

  @Expose()
  postId: string;

  @Expose()
  authorId: string;

  @Expose()
  parentCommentId: string;

  @Expose()
  likesCount: number;

  @Expose()
  dislikesCount: number;

  @Expose()
  repliesCount: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // 관계 필드 - Type 데코레이터로 중첩 DTO 적용
  @Expose()
  @Type(() => UserResponseDto)
  author?: UserResponseDto;

  // 프론트엔드 호환성을 위한 추가 필드
  @Expose()
  userLiked?: boolean;

  @Expose()
  userDisliked?: boolean;

  @Expose()
  @Type(() => CommentResponseDto)
  replies?: CommentResponseDto[];

  // 관계 필드 제외 (lazy loading 방지)
  @Exclude()
  post: any;

  @Exclude()
  likes: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}