import { Exclude, Expose, Type } from "class-transformer";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { JoinPolicy } from "../enums";

/**
 * 커뮤니티 플레어 응답 DTO (간략 버전)
 */
@Exclude()
export class FlairSummaryDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  backgroundColor: string;

  @Expose()
  textColor: string;
}

/**
 * 커뮤니티 규칙 응답 DTO
 */
@Exclude()
export class CommunityRuleResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose()
  displayOrder: number;
}

/**
 * 커뮤니티 플레어 응답 DTO (전체)
 */
@Exclude()
export class CommunityFlairResponseDto {
  @Expose()
  id: string;

  @Expose()
  communityId: string;

  @Expose()
  name: string;

  @Expose()
  backgroundColor: string;

  @Expose()
  textColor: string;

  @Expose()
  type: string;

  @Expose()
  isEnabled: boolean;

  @Expose()
  isModOnly: boolean;

  @Expose()
  displayOrder: number;
}

/**
 * 커뮤니티 멤버 응답 DTO
 */
@Exclude()
export class CommunityMemberResponseDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  @Type(() => UserResponseDto)
  user?: UserResponseDto;

  @Expose()
  role: string;

  @Expose()
  status: string;

  @Expose()
  @Type(() => FlairSummaryDto)
  userFlair?: FlairSummaryDto;

  @Expose()
  joinedAt: Date;
}

/**
 * 커뮤니티 응답 DTO
 *
 * @description
 * 커뮤니티 정보 전달용 DTO - Entity spread 연산자로 인한 lazy loading 방지
 *
 * @성능최적화
 * - Entity의 spread 연산자 사용 금지
 * - 필요한 필드만 명시적으로 노출
 * - 관계 필드는 lazy loading 방지를 위해 Type 데코레이터 사용
 */
@Exclude()
export class CommunityResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description: string;

  @Expose()
  iconUrl: string;

  @Expose()
  iconImageFit: "cover" | "contain";

  @Expose()
  bannerUrl: string;

  @Expose()
  bannerImageFit: "cover" | "contain";

  @Expose()
  joinPolicy: JoinPolicy;

  @Expose()
  isNsfw: boolean;

  @Expose()
  memberCount: number;

  @Expose()
  createdAt: Date;

  // 소유자 정보 (간략)
  @Expose()
  ownerId: string;

  @Expose()
  @Type(() => UserResponseDto)
  owner?: UserResponseDto;

  // 규칙 목록 (필요시 포함)
  @Expose()
  @Type(() => CommunityRuleResponseDto)
  rules?: CommunityRuleResponseDto[];

  // 플레어 목록 (필요시 포함)
  @Expose()
  @Type(() => CommunityFlairResponseDto)
  flairs?: CommunityFlairResponseDto[];

  // 현재 사용자의 멤버십 정보 (인증된 사용자에게만)
  @Expose()
  userMembership?: {
    isMember: boolean;
    role?: string;
    status?: string;
  };

  // 관계 필드 제외 (lazy loading 방지)
  @Exclude()
  members: any;

  @Exclude()
  posts: any;

  @Exclude()
  bans: any;

  @Exclude()
  modLogs: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}

/**
 * 커뮤니티 목록 응답 DTO
 */
@Exclude()
export class CommunityListItemDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description: string;

  @Expose()
  iconUrl: string;

  @Expose()
  joinPolicy: JoinPolicy;

  @Expose()
  isNsfw: boolean;

  @Expose()
  memberCount: number;

  @Expose()
  createdAt: Date;

  // 현재 사용자의 가입 여부 (인증된 사용자에게만)
  @Expose()
  isJoined?: boolean;
}

/**
 * 페이지네이션 포함 커뮤니티 목록 응답
 */
export class PaginatedCommunitiesDto {
  @Type(() => CommunityListItemDto)
  items: CommunityListItemDto[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
