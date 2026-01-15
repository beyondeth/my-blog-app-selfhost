/**
 * 커뮤니티 권한 유틸리티 (Reddit 스타일)
 *
 * @description 모더레이터 권한 체크 및 관리 기능을 제공합니다.
 */
import { CommunityMember } from "../entities/community-member.entity";
import { ModeratorPermission } from "../enums";

/**
 * 특정 권한 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @param permission 확인할 권한
 * @returns 해당 권한이 있으면 true
 *
 * @example
 * // 게시물 관리 권한 확인
 * if (hasPermission(member, ModeratorPermission.POSTS)) {
 *   // 게시물 삭제 가능
 * }
 */
export function hasPermission(
  member: CommunityMember | null | undefined,
  permission: ModeratorPermission,
): boolean {
  if (!member) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  // ALL 권한이 있으면 모든 권한 보유
  if (member.permissions.includes(ModeratorPermission.ALL)) return true;

  return member.permissions.includes(permission);
}

/**
 * 전체 관리 권한(ALL) 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns ALL 권한이 있으면 true
 */
export function hasAllPermission(
  member: CommunityMember | null | undefined,
): boolean {
  if (!member) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  return member.permissions.includes(ModeratorPermission.ALL);
}

/**
 * 운영진(Staff) 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns 운영진이면 true (moderatorOrder가 설정된 경우)
 */
export function isStaff(member: CommunityMember | null | undefined): boolean {
  if (!member) return false;
  return member.moderatorOrder !== null && member.moderatorOrder > 0;
}

/**
 * Top-Mod 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns Top-Mod이면 true (moderatorOrder === 1)
 */
export function isTopMod(member: CommunityMember | null | undefined): boolean {
  if (!member) return false;
  return member.moderatorOrder === 1;
}

/**
 * 다른 운영진 관리 가능 여부 확인 (Reddit 스타일 순서 기반)
 *
 * @param actor 행위자 (관리하려는 운영진)
 * @param target 대상 (관리 대상 멤버)
 * @returns 관리 가능하면 true
 *
 * 규칙:
 * 1. ALL 권한이 없으면 다른 운영진 관리 불가
 * 2. 대상이 운영진이 아니면 관리 가능
 * 3. 대상이 운영진이면 자신보다 아래 순서만 관리 가능
 *
 * @example
 * // moderatorOrder: 1 (Top-Mod) → 2, 3, 4... 관리 가능
 * // moderatorOrder: 2 → 3, 4, 5... 관리 가능, 1 관리 불가
 */
export function canManageModerator(
  actor: CommunityMember | null | undefined,
  target: CommunityMember | null | undefined,
): boolean {
  if (!actor || !target) return false;

  // ALL 권한이 없으면 운영진 관리 불가
  if (!hasAllPermission(actor)) return false;

  // 대상이 운영진이 아니면 관리 가능
  if (!isStaff(target)) return true;

  // 자신보다 아래 순서의 운영진만 관리 가능
  return (
    actor.moderatorOrder !== null &&
    target.moderatorOrder !== null &&
    actor.moderatorOrder < target.moderatorOrder
  );
}

/**
 * 권한 레벨 비교 (숫자가 낮을수록 상위 권한)
 *
 * @param member1 비교 대상 1
 * @param member2 비교 대상 2
 * @returns member1이 더 상위 권한이면 양수, 같으면 0, 하위면 음수
 */
export function compareModeratorLevel(
  member1: CommunityMember | null | undefined,
  member2: CommunityMember | null | undefined,
): number {
  // null 처리: 운영진이 아닌 경우 Infinity로 취급 (가장 낮은 권한)
  const order1 =
    member1?.moderatorOrder !== null && member1?.moderatorOrder !== undefined
      ? member1.moderatorOrder
      : Infinity;
  const order2 =
    member2?.moderatorOrder !== null && member2?.moderatorOrder !== undefined
      ? member2.moderatorOrder
      : Infinity;

  // 낮은 숫자가 상위 권한이므로, order1 < order2면 member1이 상위
  return order2 - order1;
}

/**
 * 특정 권한 목록 중 하나라도 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @param permissions 확인할 권한 목록
 * @returns 하나라도 보유하면 true
 */
export function hasAnyPermission(
  member: CommunityMember | null | undefined,
  permissions: ModeratorPermission[],
): boolean {
  if (!member) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  // ALL 권한이 있으면 모든 권한 보유
  if (member.permissions.includes(ModeratorPermission.ALL)) return true;

  return permissions.some((p) => member.permissions?.includes(p));
}

/**
 * 모든 권한 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @param permissions 확인할 권한 목록
 * @returns 모두 보유하면 true
 */
export function hasAllPermissions(
  member: CommunityMember | null | undefined,
  permissions: ModeratorPermission[],
): boolean {
  if (!member) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  // ALL 권한이 있으면 모든 권한 보유
  if (member.permissions.includes(ModeratorPermission.ALL)) return true;

  return permissions.every((p) => member.permissions?.includes(p));
}

/**
 * 권한 목록을 사람이 읽을 수 있는 문자열로 변환
 *
 * @param permissions 권한 목록
 * @returns 한국어 권한 목록 문자열
 */
export function formatPermissions(
  permissions: ModeratorPermission[] | null | undefined,
): string {
  if (!permissions || permissions.length === 0) return "권한 없음";

  // ALL 권한이 있으면 전체 관리자
  if (permissions.includes(ModeratorPermission.ALL)) return "전체 관리";

  const labels: Record<ModeratorPermission, string> = {
    [ModeratorPermission.ALL]: "전체 관리",
    [ModeratorPermission.MEMBERS]: "멤버 관리",
    [ModeratorPermission.SETTINGS]: "설정",
    [ModeratorPermission.POSTS]: "게시물 관리",
    [ModeratorPermission.TAGS]: "태그 관리",
    [ModeratorPermission.MESSAGES]: "문의 관리",
  };

  return permissions.map((p) => labels[p] || p).join(", ");
}

/**
 * 다음 moderatorOrder 값 계산
 *
 * @param existingOrders 기존 운영진의 moderatorOrder 배열
 * @returns 다음 순서 값
 */
export function getNextModeratorOrder(existingOrders: number[]): number {
  if (existingOrders.length === 0) return 1;
  return Math.max(...existingOrders) + 1;
}
