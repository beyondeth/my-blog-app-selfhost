/**
 * UUID 유틸리티 함수
 */

/**
 * UUID v4 형식인지 검증합니다.
 * @param uuid - 검증할 문자열
 * @returns 유효한 UUID이면 true
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * 문자열이 유효한 UUID인지 확인하고, 그렇지 않으면 null을 반환합니다.
 * @param uuid - 확인할 문자열
 * @returns 유효한 UUID이면 해당 문자열, 아니면 null
 */
export const validateUUID = (uuid: string | null | undefined): string | null => {
  if (!uuid) return null;
  return isValidUUID(uuid) ? uuid : null;
};

/**
 * UUID v4를 생성합니다.
 * @returns 생성된 UUID v4 문자열
 */
export const generateUUID = (): string => {
  // 브라우저 환경에서는 crypto.randomUUID() 사용
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: 수동으로 UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};