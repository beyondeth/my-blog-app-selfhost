/**
 * 모더레이터 권한 enum (Reddit 스타일)
 *
 * @description 모더레이터의 세부 권한을 정의합니다.
 * 각 모더레이터는 여러 권한을 조합하여 가질 수 있습니다.
 *
 * 권한 체계:
 * - ALL: 모든 권한 (전체 관리자, 다른 모더레이터 관리 가능)
 * - MEMBERS: 멤버 관리 (차단/승인)
 * - SETTINGS: 설정 변경
 * - POSTS: 게시물/댓글 관리
 * - TAGS: 태그 관리 (플레어)
 * - MESSAGES: 문의 관리 (모드메일)
 */
export enum ModeratorPermission {
  /** 전체 관리 - 모든 권한 + 다른 모더레이터 관리 */
  ALL = "all",
  /** 멤버 관리 - 사용자 차단/승인, 멤버 목록 관리 */
  MEMBERS = "members",
  /** 설정 - 커뮤니티 설정, 규칙, 외관 변경 */
  SETTINGS = "settings",
  /** 게시물 관리 - 게시물/댓글 삭제, 공지, 고정 */
  POSTS = "posts",
  /** 태그 관리 - 게시물/사용자 태그(플레어) 관리 */
  TAGS = "tags",
  /** 문의 관리 - 모드메일, 신고 처리 */
  MESSAGES = "messages",
}

/**
 * 권한 라벨 (UI 표시용, 한국어)
 */
export const ModeratorPermissionLabel: Record<ModeratorPermission, string> = {
  [ModeratorPermission.ALL]: "전체 관리",
  [ModeratorPermission.MEMBERS]: "멤버 관리",
  [ModeratorPermission.SETTINGS]: "설정",
  [ModeratorPermission.POSTS]: "게시물 관리",
  [ModeratorPermission.TAGS]: "태그 관리",
  [ModeratorPermission.MESSAGES]: "문의 관리",
};

/**
 * 권한 설명 (UI 툴팁용)
 */
export const ModeratorPermissionDescription: Record<
  ModeratorPermission,
  string
> = {
  [ModeratorPermission.ALL]:
    "모든 권한을 가지며, 다른 운영진을 관리할 수 있습니다.",
  [ModeratorPermission.MEMBERS]:
    "멤버 차단, 승인, 멤버 목록 관리가 가능합니다.",
  [ModeratorPermission.SETTINGS]:
    "커뮤니티 설정, 규칙, 외관을 변경할 수 있습니다.",
  [ModeratorPermission.POSTS]:
    "게시물과 댓글을 삭제하고, 공지를 작성할 수 있습니다.",
  [ModeratorPermission.TAGS]: "게시물 및 사용자 태그를 관리할 수 있습니다.",
  [ModeratorPermission.MESSAGES]: "커뮤니티 문의와 신고를 처리할 수 있습니다.",
};

/**
 * 특정 권한 보유 여부 확인
 * @param permissions 보유 권한 배열
 * @param permission 확인할 권한
 * @returns 해당 권한이 있으면 true
 */
export function hasPermission(
  permissions: ModeratorPermission[] | null | undefined,
  permission: ModeratorPermission,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  // ALL 권한이 있으면 모든 권한 보유
  if (permissions.includes(ModeratorPermission.ALL)) return true;
  return permissions.includes(permission);
}

/**
 * 전체 관리 권한 보유 여부 확인
 * @param permissions 보유 권한 배열
 * @returns ALL 권한이 있으면 true
 */
export function hasAllPermission(
  permissions: ModeratorPermission[] | null | undefined,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(ModeratorPermission.ALL);
}

/**
 * 기본 모더레이터 권한 (신규 운영진 기본값)
 */
export const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermission[] = [
  ModeratorPermission.POSTS,
];

/**
 * 전체 관리자 권한 (Top-Mod, Creator)
 */
export const FULL_MODERATOR_PERMISSIONS: ModeratorPermission[] = [
  ModeratorPermission.ALL,
];
