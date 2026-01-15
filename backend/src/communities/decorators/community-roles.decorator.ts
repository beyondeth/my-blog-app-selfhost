import { SetMetadata } from "@nestjs/common";
import { CommunityRole } from "../enums";

/**
 * 커뮤니티 역할 메타데이터 키
 */
export const COMMUNITY_ROLES_KEY = "communityRoles";

/**
 * 커뮤니티 역할 기반 접근 제어 데코레이터
 *
 * @description
 * 특정 커뮤니티 역할이 필요한 엔드포인트에 적용
 * CommunityRolesGuard와 함께 사용
 *
 * @param roles 허용할 커뮤니티 역할 목록
 *
 * @example
 * // OWNER만 접근 가능
 * @CommunityRoles(CommunityRole.OWNER)
 *
 * // OWNER 또는 MODERATOR 접근 가능
 * @CommunityRoles(CommunityRole.OWNER, CommunityRole.MODERATOR)
 *
 * // 모든 멤버 접근 가능 (가입 필수)
 * @CommunityRoles(CommunityRole.OWNER, CommunityRole.MODERATOR, CommunityRole.MEMBER)
 */
export const CommunityRoles = (...roles: CommunityRole[]) =>
  SetMetadata(COMMUNITY_ROLES_KEY, roles);

/**
 * 모더레이터 이상 권한 필요 (편의 데코레이터)
 *
 * @description OWNER, ADMIN 또는 MODERATOR 역할 필요
 */
export const ModeratorOnly = () =>
  CommunityRoles(
    CommunityRole.OWNER,
    CommunityRole.ADMIN,
    CommunityRole.MODERATOR,
  );

/**
 * ADMIN 이상 권한 필요 (편의 데코레이터)
 *
 * @description OWNER 또는 ADMIN 역할 필요
 */
export const AdminOnly = () =>
  CommunityRoles(CommunityRole.OWNER, CommunityRole.ADMIN);

/**
 * 커뮤니티 소유자만 접근 가능 (편의 데코레이터)
 *
 * @description OWNER 역할만 허용
 */
export const OwnerOnly = () => CommunityRoles(CommunityRole.OWNER);

/**
 * 커뮤니티 멤버 이상 권한 필요 (편의 데코레이터)
 *
 * @description 가입된 멤버면 모두 접근 가능
 */
export const MemberOnly = () =>
  CommunityRoles(
    CommunityRole.OWNER,
    CommunityRole.ADMIN,
    CommunityRole.MODERATOR,
    CommunityRole.MEMBER,
  );
