import { SetMetadata } from "@nestjs/common";
import { ModeratorPermission } from "../enums";

/**
 * 커뮤니티 권한 메타데이터 키
 */
export const COMMUNITY_PERMISSIONS_KEY = "communityPermissions";

/**
 * 커뮤니티 권한 기반 접근 제어 데코레이터 (Reddit 스타일)
 *
 * @description
 * 특정 모더레이터 권한이 필요한 엔드포인트에 적용
 * CommunityPermissionsGuard와 함께 사용
 *
 * @param permissions 필요한 권한 목록 (하나라도 있으면 통과)
 *
 * @example
 * // 게시물 관리 권한 필요
 * @RequirePermission(ModeratorPermission.POSTS)
 *
 * // 멤버 관리 또는 전체 관리 권한 필요
 * @RequirePermission(ModeratorPermission.MEMBERS, ModeratorPermission.ALL)
 *
 * // 설정 변경 권한 필요
 * @RequirePermission(ModeratorPermission.SETTINGS)
 */
export const RequirePermission = (...permissions: ModeratorPermission[]) =>
  SetMetadata(COMMUNITY_PERMISSIONS_KEY, permissions);

/**
 * 전체 관리 권한 필요 (편의 데코레이터)
 *
 * @description ALL 권한이 있어야만 접근 가능
 */
export const RequireAllPermission = () =>
  RequirePermission(ModeratorPermission.ALL);

/**
 * 게시물 관리 권한 필요 (편의 데코레이터)
 *
 * @description POSTS 또는 ALL 권한 필요
 */
export const RequirePostsPermission = () =>
  RequirePermission(ModeratorPermission.POSTS);

/**
 * 멤버 관리 권한 필요 (편의 데코레이터)
 *
 * @description MEMBERS 또는 ALL 권한 필요
 */
export const RequireMembersPermission = () =>
  RequirePermission(ModeratorPermission.MEMBERS);

/**
 * 설정 변경 권한 필요 (편의 데코레이터)
 *
 * @description SETTINGS 또는 ALL 권한 필요
 */
export const RequireSettingsPermission = () =>
  RequirePermission(ModeratorPermission.SETTINGS);

/**
 * 태그 관리 권한 필요 (편의 데코레이터)
 *
 * @description TAGS 또는 ALL 권한 필요
 */
export const RequireTagsPermission = () =>
  RequirePermission(ModeratorPermission.TAGS);

/**
 * 문의 관리 권한 필요 (편의 데코레이터)
 *
 * @description MESSAGES 또는 ALL 권한 필요
 */
export const RequireMessagesPermission = () =>
  RequirePermission(ModeratorPermission.MESSAGES);
