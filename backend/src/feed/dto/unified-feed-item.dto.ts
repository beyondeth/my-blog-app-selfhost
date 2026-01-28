import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 피드 소스 타입
 */
export type FeedSourceType = "blog" | "community";

/**
 * 통합 피드 아이템 작성자 정보
 */
export class FeedAuthorDto {
  @ApiProperty({ description: "작성자 ID" })
  id: string;

  @ApiProperty({ description: "사용자명" })
  username: string;

  @ApiPropertyOptional({ description: "프로필 이미지 URL" })
  profileImage?: string;
}

/**
 * 블로그 정보 (블로그 포스트인 경우)
 */
export class FeedBlogDto {
  @ApiProperty({ description: "블로그 ID" })
  id: string;

  @ApiProperty({ description: "블로그 슬러그" })
  slug: string;

  @ApiPropertyOptional({ description: "블로그 별칭 (alias)" })
  alias?: string;

  @ApiProperty({ description: "블로그 이름" })
  name: string;
}

/**
 * 커뮤니티 정보 (커뮤니티 포스트인 경우)
 */
export class FeedCommunityDto {
  @ApiProperty({ description: "커뮤니티 ID" })
  id: string;

  @ApiProperty({ description: "커뮤니티 슬러그" })
  slug: string;

  @ApiProperty({ description: "커뮤니티 이름" })
  name: string;

  @ApiPropertyOptional({ description: "커뮤니티 아이콘 URL" })
  iconUrl?: string;

  @ApiPropertyOptional({
    description: "커뮤니티 아이콘 표시 방식 (cover 또는 contain)",
  })
  iconImageFit?: "cover" | "contain";
}

/**
 * 통합 피드 아이템 DTO
 *
 * @description 블로그 포스트와 커뮤니티 포스트를 통합한 단일 아이템 형식
 */
export class UnifiedFeedItemDto {
  @ApiProperty({ description: "포스트 ID" })
  id: string;

  @ApiProperty({ description: "포스트 제목" })
  title: string;

  @ApiProperty({ description: "포스트 슬러그 (URL 식별자)" })
  slug: string;

  @ApiPropertyOptional({ description: "포스트 요약 (excerpt)" })
  excerpt?: string;

  @ApiPropertyOptional({
    description: "첨부 이미지 URL 목록",
    type: [String],
  })
  images?: string[];

  @ApiPropertyOptional({ description: "포스트 태그 목록" })
  tags?: string[];

  @ApiPropertyOptional({ description: "썸네일 URL" })
  thumbnail?: string;

  @ApiPropertyOptional({ description: "YouTube 비디오 ID (피드용)" })
  youtubeVideoId?: string;

  @ApiProperty({
    description: "소스 타입 (blog 또는 community)",
    enum: ["blog", "community"],
  })
  sourceType: FeedSourceType;

  @ApiPropertyOptional({
    description: "블로그 정보 (블로그 포스트인 경우)",
    type: FeedBlogDto,
  })
  blog?: FeedBlogDto;

  @ApiPropertyOptional({
    description: "커뮤니티 정보 (커뮤니티 포스트인 경우)",
    type: FeedCommunityDto,
  })
  community?: FeedCommunityDto;

  @ApiProperty({ description: "작성자 정보", type: FeedAuthorDto })
  author: FeedAuthorDto;

  @ApiProperty({ description: "좋아요 수 (레거시, upvoteCount와 동일)" })
  likeCount: number;

  @ApiPropertyOptional({ description: "업보트 수" })
  upvoteCount?: number;

  @ApiPropertyOptional({ description: "다운보트 수" })
  downvoteCount?: number;

  @ApiPropertyOptional({
    description: "투표 점수 (upvoteCount - downvoteCount)",
  })
  score?: number;

  @ApiProperty({ description: "댓글 수" })
  commentCount: number;

  @ApiProperty({ description: "조회수" })
  viewCount: number;

  @ApiPropertyOptional({ description: "사용자 업보트 여부 (하위 호환)" })
  liked?: boolean;

  @ApiPropertyOptional({
    description: "사용자 투표 상태 (upvote/downvote/null)",
  })
  userVote?: "upvote" | "downvote" | null;

  @ApiProperty({ description: "생성 시간" })
  createdAt: string;

  @ApiProperty({ description: "수정 시간" })
  updatedAt: string;

  // 커뮤니티 포스트 전용 필드
  @ApiPropertyOptional({ description: "NSFW 여부 (커뮤니티 포스트)" })
  isNsfw?: boolean;

  @ApiPropertyOptional({ description: "스포일러 여부 (커뮤니티 포스트)" })
  isSpoiler?: boolean;

  @ApiPropertyOptional({ description: "고정 여부 (커뮤니티 포스트)" })
  isPinned?: boolean;
}

/**
 * 통합 피드 응답 DTO
 */
export class UnifiedFeedResponseDto {
  @ApiProperty({
    description: "피드 아이템 목록",
    type: [UnifiedFeedItemDto],
  })
  items: UnifiedFeedItemDto[];

  @ApiPropertyOptional({
    description: "다음 페이지 커서 (null이면 마지막 페이지)",
  })
  nextCursor: string | null;

  @ApiProperty({ description: "다음 페이지 존재 여부" })
  hasMore: boolean;

  @ApiProperty({ description: "현재 페이지 아이템 수" })
  count: number;
}
