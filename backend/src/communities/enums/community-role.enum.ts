/**
 * 커뮤니티 멤버 역할 (4단계 시스템)
 *
 * @description 커뮤니티 내 사용자의 권한 레벨을 정의합니다.
 *
 * - OWNER: 커뮤니티 생성자. 최고 권한 (삭제, 소유권 이전, ADMIN 임명)
 * - ADMIN: 부방장. 설정 변경 권한 (설정 변경, 모더레이터 관리)
 * - MODERATOR: 모더레이터. 콘텐츠 관리 권한 (게시물 삭제, 사용자 밴, 규칙 관리)
 * - MEMBER: 일반 멤버. 읽기/쓰기 권한 (게시물 작성, 댓글, 좋아요)
 */
export enum CommunityRole {
  OWNER = "owner",
  ADMIN = "admin",
  MODERATOR = "moderator",
  MEMBER = "member",
}

/**
 * 역할별 권한 레벨 (숫자가 높을수록 상위 권한)
 * - 권한 비교 시 사용
 */
export const CommunityRoleLevel: Record<CommunityRole, number> = {
  [CommunityRole.OWNER]: 100,
  [CommunityRole.ADMIN]: 75,
  [CommunityRole.MODERATOR]: 50,
  [CommunityRole.MEMBER]: 10,
};

/**
 * 역할 우선순위 비교
 * @param role1 비교 대상 역할 1
 * @param role2 비교 대상 역할 2
 * @returns role1이 role2보다 상위 권한이면 true
 */
export function hasHigherOrEqualRole(
  role1: CommunityRole,
  role2: CommunityRole,
): boolean {
  return CommunityRoleLevel[role1] >= CommunityRoleLevel[role2];
}

/**
 * 모더레이터 이상 권한 확인
 * @param role 확인할 역할
 * @returns 모더레이터 이상이면 true
 */
export function isModeratorOrAbove(role: CommunityRole): boolean {
  return (
    CommunityRoleLevel[role] >= CommunityRoleLevel[CommunityRole.MODERATOR]
  );
}

/**
 * ADMIN 이상 권한 확인
 * @param role 확인할 역할
 * @returns ADMIN 이상이면 true (ADMIN 또는 OWNER)
 */
export function isAdminOrAbove(role: CommunityRole): boolean {
  return CommunityRoleLevel[role] >= CommunityRoleLevel[CommunityRole.ADMIN];
}

/**
 * ADMIN 권한 확인
 * @param role 확인할 역할
 * @returns ADMIN이면 true
 */
export function isAdmin(role: CommunityRole): boolean {
  return role === CommunityRole.ADMIN;
}

/**
 * 오너 권한 확인
 * @param role 확인할 역할
 * @returns 오너면 true
 */
export function isOwner(role: CommunityRole): boolean {
  return role === CommunityRole.OWNER;
}
