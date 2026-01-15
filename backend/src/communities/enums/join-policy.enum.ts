/**
 * 커뮤니티 가입 정책
 *
 * @description 커뮤니티의 가입 방식을 정의합니다.
 *
 * - OPEN: 공개 가입. 누구나 즉시 가입 가능
 * - RESTRICTED: 승인 필요. 가입 요청 후 모더레이터 승인 필요
 * - PRIVATE: 초대 전용. 기존 멤버의 초대로만 가입 가능
 */
export enum JoinPolicy {
  OPEN = "open",
  RESTRICTED = "restricted",
  PRIVATE = "private",
}

/**
 * 즉시 가입 가능 여부 확인
 * @param policy 가입 정책
 * @returns 즉시 가입 가능하면 true
 */
export function canJoinImmediately(policy: JoinPolicy): boolean {
  return policy === JoinPolicy.OPEN;
}

/**
 * 승인 필요 여부 확인
 * @param policy 가입 정책
 * @returns 승인이 필요하면 true
 */
export function requiresApproval(policy: JoinPolicy): boolean {
  return policy === JoinPolicy.RESTRICTED;
}

/**
 * 초대 필요 여부 확인
 * @param policy 가입 정책
 * @returns 초대가 필요하면 true
 */
export function requiresInvitation(policy: JoinPolicy): boolean {
  return policy === JoinPolicy.PRIVATE;
}
