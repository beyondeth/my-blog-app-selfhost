import { Exclude, Expose, Type } from "class-transformer";
import { UserResponseDto } from "../../users/dto/user-response.dto";

/**
 * 커뮤니티 차단 응답 DTO
 *
 * @description
 * 차단된 멤버 정보 조회용 DTO
 * 모더레이터/OWNER만 조회 가능
 */
@Exclude()
export class BanResponseDto {
  @Expose()
  id: string;

  @Expose()
  communityId: string;

  @Expose()
  reason: string;

  @Expose()
  expiresAt: Date;

  @Expose()
  isPermanent: boolean;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  // 차단된 사용자 정보
  @Expose()
  userId: string;

  @Expose()
  @Type(() => UserResponseDto)
  user?: UserResponseDto;

  // 차단한 모더레이터 정보
  @Expose()
  bannedById: string;

  @Expose()
  @Type(() => UserResponseDto)
  bannedBy?: UserResponseDto;

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
 * 페이지네이션 포함 차단 목록 응답
 */
export class PaginatedBansDto {
  @Type(() => BanResponseDto)
  items: BanResponseDto[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
