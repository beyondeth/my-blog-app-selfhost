import { Exclude, Expose, Type } from "class-transformer";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { ModAction } from "../enums";

/**
 * 모더레이션 로그 응답 DTO
 *
 * @description
 * 모더레이터 활동 로그 조회용 DTO
 * 모더레이터/OWNER만 조회 가능
 */
@Exclude()
export class ModLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  communityId: string;

  @Expose()
  action: ModAction;

  @Expose()
  actionDescription: string;

  @Expose()
  targetUserId: string;

  @Expose()
  targetPostId: string;

  @Expose()
  reason: string;

  @Expose()
  metadata: Record<string, any>;

  @Expose()
  createdAt: Date;

  // 모더레이터 정보
  @Expose()
  moderatorId: string;

  @Expose()
  @Type(() => UserResponseDto)
  moderator?: UserResponseDto;

  // 대상 사용자 정보 (있는 경우)
  @Expose()
  @Type(() => UserResponseDto)
  targetUser?: UserResponseDto;

  // 관계 필드 제외
  @Exclude()
  community: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}

/**
 * 페이지네이션 포함 모더레이션 로그 목록 응답
 */
export class PaginatedModLogsDto {
  @Type(() => ModLogResponseDto)
  items: ModLogResponseDto[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
