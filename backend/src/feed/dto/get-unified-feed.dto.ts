import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 피드 필터 타입
 */
export enum FeedFilterType {
  ALL = "all",
  BLOG = "blog",
  COMMUNITY = "community",
}

/**
 * 피드 정렬 타입
 */
export enum FeedSortType {
  RECENT = "recent",
  HOT = "hot",
  TOP = "top",
}

/**
 * 피드 기간 필터 타입
 */
export enum FeedPeriodType {
  ALL = "all", // 전체 기간 (기본값)
  DAILY = "daily", // 24시간
  WEEKLY = "weekly", // 7일
  MONTHLY = "monthly", // 30일
}

/**
 * 통합 피드 조회 DTO
 *
 * @description 홈피드에서 블로그 포스트와 커뮤니티 포스트를 통합 조회할 때 사용
 */
export class GetUnifiedFeedDto {
  @ApiPropertyOptional({
    description: "커서 (다음 페이지 조회용)",
    example: "eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: "페이지당 항목 수",
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "필터 타입",
    enum: FeedFilterType,
    default: FeedFilterType.ALL,
  })
  @IsOptional()
  @IsEnum(FeedFilterType)
  filter?: FeedFilterType = FeedFilterType.ALL;

  @ApiPropertyOptional({
    description: "정렬 방식",
    enum: FeedSortType,
    default: FeedSortType.RECENT,
  })
  @IsOptional()
  @IsEnum(FeedSortType)
  sort?: FeedSortType = FeedSortType.RECENT;

  @ApiPropertyOptional({
    description: "기간 필터 (일일, 주간, 월간)",
    enum: FeedPeriodType,
    default: FeedPeriodType.ALL,
  })
  @IsOptional()
  @IsEnum(FeedPeriodType)
  period?: FeedPeriodType = FeedPeriodType.ALL;
}
