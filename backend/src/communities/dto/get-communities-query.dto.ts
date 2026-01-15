import { IsOptional, IsEnum, IsString, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { CursorPaginationDto } from "../../common/dto/pagination.dto";

/**
 * 커뮤니티 정렬 기준
 *
 * @description 커서 페이지네이션에서 각 정렬 기준에 따라 다른 커서 타입 사용
 * - NEWEST: createdAt (Date) - 최신순
 * - POPULAR: memberCount (Number) - 인기순 (멤버 수)
 * - NAME: name (String) - 이름순
 * - ACTIVE: memberCount (Number) - 활성도순 (추후 lastPostAt으로 변경)
 */
export enum CommunitySortBy {
  /** 최신순 */
  NEWEST = "newest",
  /** 인기순 (멤버 수) */
  POPULAR = "popular",
  /** 이름순 (가나다) */
  NAME = "name",
  /** 활성도순 (최근 게시물) */
  ACTIVE = "active",
}

/**
 * 커뮤니티 목록 조회 쿼리 DTO
 *
 * @description 커서 기반 페이지네이션으로 커뮤니티 목록 조회
 *
 * **커서 페이지네이션 동작 방식:**
 * - cursor: 마지막 조회 아이템의 정렬 기준값
 * - cursorId: 동일 정렬값 구분을 위한 ID (예: memberCount가 같은 커뮤니티)
 *
 * **성능 이점:**
 * - OFFSET 대신 WHERE 조건으로 조회하여 대량 데이터에서도 일정한 성능
 * - 인덱스 (memberCount, id) 활용으로 효율적인 쿼리
 */
export class GetCommunitiesQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    description: "검색어 (이름, 설명에서 검색)",
    maxLength: 100,
    example: "개발자",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: "정렬 기준",
    enum: CommunitySortBy,
    default: CommunitySortBy.POPULAR,
    example: CommunitySortBy.POPULAR,
  })
  @IsOptional()
  @IsEnum(CommunitySortBy)
  sortBy?: CommunitySortBy;

  @ApiPropertyOptional({
    description: "NSFW 커뮤니티 포함 여부",
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ obj }) => {
    // obj에서 원본 값을 가져와서 변환 (enableImplicitConversion 우회)
    const value = obj.includeNsfw;
    if (value === "true" || value === true) return true;
    return false; // "false", false, undefined, null 모두 false
  })
  includeNsfw?: boolean = false;

  @ApiPropertyOptional({
    description: "가입한 커뮤니티만 조회",
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ obj }) => {
    // obj에서 원본 값을 가져와서 변환 (enableImplicitConversion 우회)
    const value = obj.joinedOnly;
    if (value === "true" || value === true) return true;
    return false; // "false", false, undefined, null 모두 false
  })
  joinedOnly?: boolean = false;
}
