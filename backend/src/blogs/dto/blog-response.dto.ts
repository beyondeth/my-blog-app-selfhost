import { Exclude, Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Blog 응답 DTO
 *
 * @description
 * 블로그 공개 정보만 노출하고 관계 필드는 제외
 * OneToOne, OneToMany 관계는 lazy loading 방지를 위해 제외
 *
 * @클린아키텍처
 * - Entity와 Response 계층 완전 분리
 * - 필요한 정보만 선택적 노출
 */
@Exclude() // 기본적으로 모든 필드 제외
export class BlogResponseDto {
  @Expose()
  id: string;

  @Expose()
  slug: string;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  thumbnailUrl: string;

  @Expose()
  isPublic: boolean;

  @Expose()
  allowComments: boolean;

  // userId는 권한 체크용으로 필요 (프론트엔드에서 blog.userId === user.id 비교)
  @Expose()
  userId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  alias: string; // Alias 필드 추가

  // 블로그 소유자 정보 (UserResponseDto로 자동 변환)
  @Expose()
  @Type(() => UserResponseDto)
  owner?: UserResponseDto;

  // 팔로우 정보 (동적으로 추가되는 필드)
  @Expose()
  followInfo?: {
    followersCount: number;
    followingCount: number;
    isFollowedByUser: boolean;
  };

  // 리다이렉트 정보 (alias 시스템용)
  @Expose()
  shouldRedirect?: boolean;

  @Expose()
  redirectTo?: string;

  @Expose()
  redirectType?: string;

  // 비공개 블로그 메시지
  @Expose()
  isPrivate?: boolean;

  @Expose()
  message?: string;

  // OneToOne, OneToMany 관계 제외 (lazy loading 방지)
  @Exclude()
  user: any;

  @Exclude()
  posts: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}