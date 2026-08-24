import { Exclude, Expose, Type } from "class-transformer";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { FlairSummaryDto } from "./community-response.dto";
import { CommunityPostStatus } from "../enums";
import { File } from "../../files/entities/file.entity";

/**
 * 커뮤니티 게시물 응답 DTO
 *
 * @description
 * 커뮤니티 게시물 정보 전달용 DTO
 *
 * @성능최적화
 * - Entity의 spread 연산자 사용 금지
 * - 필요한 필드만 명시적으로 노출
 */
@Exclude()
export class CommunityPostResponseDto {
  @Expose()
  id: string;

  @Expose()
  communityId: string;

  @Expose()
  title: string;

  @Expose()
  slug: string;

  @Expose()
  content: string;

  @Expose()
  contentMarkdown: string;

  @Expose()
  thumbnailImageUrl: string;

  @Expose()
  thumbnailImageId: string;

  @Expose()
  @Type(() => File)
  attachedFiles: File[];

  @Expose()
  status: CommunityPostStatus;

  @Expose()
  isPinned: boolean;

  @Expose()
  viewCount: number;

  @Expose()
  likeCount: number;

  @Expose()
  commentCount: number;

  @Expose()
  qualityScore: number;

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

  // 플레어 정보
  @Expose()
  flairId: string;

  @Expose()
  @Type(() => FlairSummaryDto)
  flair?: FlairSummaryDto;

  // 커뮤니티 정보 (간략)
  @Expose()
  community?: {
    id: string;
    name: string;
    slug: string;
    iconImageUrl?: string;
  };

  // 현재 사용자의 좋아요 여부
  @Expose()
  userLiked?: boolean;

  // 관계 필드 제외
  @Exclude()
  comments: any;

  @Exclude()
  likes: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}

/**
 * 커뮤니티 게시물 목록 아이템 DTO (간략 버전)
 */
@Exclude()
export class CommunityPostListItemDto {
  @Expose()
  id: string;

  @Expose()
  communityId: string;

  @Expose()
  title: string;

  @Expose()
  slug: string;

  // 내용 미리보기 (최대 200자)
  @Expose()
  contentPreview?: string;

  @Expose()
  thumbnailImageUrl: string;

  @Expose()
  isPinned: boolean;

  @Expose()
  viewCount: number;

  @Expose()
  likeCount: number;

  @Expose()
  commentCount: number;

  @Expose()
  createdAt: Date;

  // 작성자 정보 (간략)
  @Expose()
  @Type(() => UserResponseDto)
  author?: UserResponseDto;

  // 플레어 정보
  @Expose()
  @Type(() => FlairSummaryDto)
  flair?: FlairSummaryDto;

  // 현재 사용자의 좋아요 여부
  @Expose()
  userLiked?: boolean;
}

/**
 * 페이지네이션 포함 커뮤니티 게시물 목록 응답
 */
export class PaginatedCommunityPostsDto {
  @Type(() => CommunityPostListItemDto)
  items: CommunityPostListItemDto[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

  // 고정 게시물 (페이지 1에만 포함)
  @Type(() => CommunityPostListItemDto)
  pinnedPosts?: CommunityPostListItemDto[];
}
