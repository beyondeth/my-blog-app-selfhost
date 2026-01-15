/**
 * 성인 인증 API 서비스
 *
 * @description 생년월일 기반 성인 인증 (NSFW 커뮤니티 접근용)
 *
 * **엔드포인트:**
 * - POST /users/adult-verification - 성인 인증 요청
 * - GET /users/adult-verification/status - 성인 인증 상태 조회
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 성인 인증 요청 파라미터
 */
export interface VerifyAdultRequest {
  /** 생년월일 (YYYY-MM-DD 형식) */
  birthdate: string;
}

/**
 * 성인 인증 응답
 */
export interface VerifyAdultResponse {
  /** 인증 성공 여부 */
  verified: boolean;
  /** 인증 완료 시각 (인증 성공 시) */
  verifiedAt?: string;
  /** 결과 메시지 */
  message: string;
}

/**
 * 성인 인증 상태 응답
 */
export interface AdultVerificationStatus {
  /** 성인 인증 여부 */
  isAdultVerified: boolean;
  /** 인증 완료 시각 */
  verifiedAt?: string;
}

/**
 * 성인 인증 요청
 *
 * @param request 생년월일 정보
 * @returns 인증 결과
 *
 * @example
 * const result = await verifyAdult({ birthdate: '1990-01-15' });
 * if (result.verified) {
 *   console.log('성인 인증 완료:', result.verifiedAt);
 * }
 */
export async function verifyAdult(
  request: VerifyAdultRequest,
): Promise<VerifyAdultResponse> {
  const response = await fetch(`${API_URL}/users/adult-verification`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `성인 인증 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * 성인 인증 상태 조회
 *
 * @returns 현재 사용자의 성인 인증 상태
 *
 * @example
 * const status = await getAdultVerificationStatus();
 * if (status.isAdultVerified) {
 *   // NSFW 콘텐츠 접근 허용
 * }
 */
export async function getAdultVerificationStatus(): Promise<AdultVerificationStatus> {
  const response = await fetch(`${API_URL}/users/adult-verification/status`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // 인증되지 않은 경우 기본값 반환
    if (response.status === 401) {
      return { isAdultVerified: false };
    }
    throw new Error(`성인 인증 상태 조회 실패: ${response.status}`);
  }

  return response.json();
}
