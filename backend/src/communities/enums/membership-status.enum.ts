/**
 * 커뮤니티 멤버십 상태
 *
 * @description 사용자의 커뮤니티 가입 상태를 정의합니다.
 *
 * - ACTIVE: 활성 멤버. 정상적으로 커뮤니티 활동 가능
 * - PENDING: 승인 대기 중. restricted 커뮤니티에서 모더레이터 승인 대기
 * - BANNED: 차단됨. 커뮤니티에서 활동 금지
 */
export enum MembershipStatus {
  ACTIVE = "active",
  PENDING = "pending",
  BANNED = "banned",
}

/**
 * 활성 멤버 여부 확인
 * @param status 확인할 상태
 * @returns 활성 멤버면 true
 */
export function isActiveMember(status: MembershipStatus): boolean {
  return status === MembershipStatus.ACTIVE;
}

/**
 * 승인 대기 여부 확인
 * @param status 확인할 상태
 * @returns 승인 대기 중이면 true
 */
export function isPendingMember(status: MembershipStatus): boolean {
  return status === MembershipStatus.PENDING;
}

/**
 * 차단 여부 확인
 * @param status 확인할 상태
 * @returns 차단된 상태면 true
 */
export function isBannedMember(status: MembershipStatus): boolean {
  return status === MembershipStatus.BANNED;
}
