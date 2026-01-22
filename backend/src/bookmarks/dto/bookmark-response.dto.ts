import { Exclude, Expose, Type } from "class-transformer";
import { IsString, IsDate, IsNumber } from "class-validator";

/**
 * 북마크된 포스트 정보 DTO
 */
class BookmarkedPostAuthorDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  profileImage?: string;
}

class BookmarkedPostBlogDto {
  @Expose()
  id: string;

  @Expose()
  slug: string;

  @Expose()
  name: string;
}

class BookmarkedPostCommunityDto {
  @Expose()
  id: string;

  @Expose()
  slug: string;

  @Expose()
  name: string;

  @Expose()
  iconUrl?: string;
}

export class BookmarkedPostDto {
  @Expose()
  sourceType: "blog" | "community";

  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  slug: string;

  @Expose()
  excerpt?: string;

  @Expose()
  thumbnail?: string;

  @Expose()
  viewCount: number;

  @Expose()
  likeCount: number;

  @Expose()
  commentCount: number;

  @Expose()
  @Type(() => BookmarkedPostAuthorDto)
  author: BookmarkedPostAuthorDto;

  @Expose()
  @Type(() => BookmarkedPostBlogDto)
  blog?: BookmarkedPostBlogDto;

  @Expose()
  @Type(() => BookmarkedPostCommunityDto)
  community?: BookmarkedPostCommunityDto;

  @Expose()
  publishedAt: Date;

  @Expose()
  bookmarkedAt: Date; // 북마크한 시간
}

export class BookmarksResponseDto {
  @Expose()
  @Type(() => BookmarkedPostDto)
  items: BookmarkedPostDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  pageSize: number;

  @Expose()
  totalPages: number;
}

export class ToggleBookmarkResponseDto {
  @Expose()
  bookmarked: boolean; // true: 북마크 추가됨, false: 북마크 제거됨

  @Expose()
  message: string;
}
