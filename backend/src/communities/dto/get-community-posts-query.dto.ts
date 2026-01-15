import {
  IsOptional,
  IsEnum,
  IsString,
  IsUUID,
  IsBoolean,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { CursorPaginationDto } from "../../common/dto/pagination.dto";

/**
 * 커뮤니티 게시물 정렬 기준
 */
export enum CommunityPostSortBy {
  /** 최신순 */
  NEWEST = "newest",
  /** 인기순 (좋아요 수) */
  HOT = "hot",
  /** 조회수순 */
  TOP = "top",
  /** 댓글 많은 순 */
  CONTROVERSIAL = "controversial",
}

/**
 * 커뮤니티 게시물 목록 조회 쿼리 DTO
 *
 * @description 커뮤니티 게시물 목록 조회 시 필터링/정렬 옵션
 */
export class GetCommunityPostsQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    description: "정렬 기준",
    enum: CommunityPostSortBy,
    default: CommunityPostSortBy.NEWEST,
    example: CommunityPostSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(CommunityPostSortBy)
  sortBy?: CommunityPostSortBy;

  @ApiPropertyOptional({
    description: "플레어 ID로 필터링",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsUUID("4", { message: "플레어 ID는 유효한 UUID 형식이어야 합니다" })
  flairId?: string;

  @ApiPropertyOptional({
    description: "검색어 (제목, 내용에서 검색)",
    example: "Redis",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: "특정 작성자 ID로 필터링",
    example: "550e8400-e29b-41d4-a716-446655440001",
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsUUID("4", { message: "작성자 ID는 유효한 UUID 형식이어야 합니다" })
  authorId?: string;

  @ApiPropertyOptional({
    description: "고정 게시물만 조회",
    default: false,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pinnedOnly?: boolean;
}
