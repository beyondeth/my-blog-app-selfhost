/**
 * Feature Flags - 기능 활성화/비활성화 관리
 *
 * 나중에 구현할 기능들을 쉽게 활성화할 수 있도록 중앙 관리
 * 활성화하려면 false를 true로 변경
 */

export const FEATURES = {
  /**
   * 알림 기능
   * - 왼쪽 사이드바 알림 버튼
   * - 프로필 드롭다운 알림 설정
   *
   * TODO: 백엔드 API 구현 후 활성화
   */
  NOTIFICATIONS: false,

  /**
   * 구독 관리 기능
   * - 프로필 드롭다운 "구독 관리"
   * - 프로필 드롭다운 "요금제"
   *
   * TODO: 유저 유입 후 오픈 예정
   */
  SUBSCRIPTION: false,
} as const;
