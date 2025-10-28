/**
 * 캐릭터 이미지 유틸리티
 *
 * /frontend/public/character 폴더의 정적 캐릭터 이미지를 관리합니다.
 * OAuth 로그인 시 외부 제공자의 프로필 이미지 대신 플랫폼 고유 캐릭터를 사용하여
 * 일관된 사용자 경험을 제공합니다.
 */

/**
 * 사용 가능한 캐릭터 이미지 목록
 * /frontend/public/character 폴더에 실제로 존재하는 파일들
 */
export const AVAILABLE_CHARACTERS = [
  'Bimmo',
  'Bubo',
  'Dopi',
  'Flynko',
  'Jooli',
  'Kappi',
  'KuruPie',
  'LumoPop',
  'Meloon',
  'Mippy',
  'NibbiJoy',
  'Paffi',
  'Roroa',
  'Tinko',
  'TokaBun',
  'Wibbo',
  'Yuniq',
  'Zimzo',
  'Zupin',
] as const;

/**
 * 캐릭터 타입 정의
 */
export type CharacterName = typeof AVAILABLE_CHARACTERS[number];

/**
 * 랜덤 캐릭터 선택
 *
 * 새 사용자 가입 시 호출되어 19개 캐릭터 중 하나를 랜덤으로 반환합니다.
 *
 * @returns {string} 캐릭터 이미지 경로 (예: "/character/Bimmo.jpeg")
 */
export function getRandomCharacter(): string {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_CHARACTERS.length);
  const characterName = AVAILABLE_CHARACTERS[randomIndex];
  return `/character/${characterName}.jpeg`;
}

/**
 * 캐릭터 이름으로 이미지 경로 생성
 *
 * @param {CharacterName} name - 캐릭터 이름
 * @returns {string} 캐릭터 이미지 경로
 */
export function getCharacterPath(name: CharacterName): string {
  return `/character/${name}.jpeg`;
}

/**
 * 주어진 경로가 캐릭터 이미지인지 확인
 *
 * S3 업로드 이미지와 캐릭터 이미지를 구분하기 위해 사용됩니다.
 *
 * @param {string} imagePath - 확인할 이미지 경로
 * @returns {boolean} 캐릭터 이미지 여부
 */
export function isCharacterImage(imagePath: string | null | undefined): boolean {
  if (!imagePath) return false;
  return imagePath.startsWith('/character/') && imagePath.endsWith('.jpeg');
}

/**
 * 주어진 경로가 외부 OAuth 제공자 이미지인지 확인
 *
 * OAuth 제공자(Google, GitHub, Kakao)의 프로필 이미지 URL을 감지합니다.
 * 기존 사용자를 캐릭터 이미지로 마이그레이션할 때 사용됩니다.
 *
 * @param {string} imagePath - 확인할 이미지 경로
 * @returns {boolean} OAuth 제공자 이미지 여부
 */
export function isOAuthProviderImage(imagePath: string | null | undefined): boolean {
  if (!imagePath) return false;

  // 외부 URL 감지 (http:// 또는 https://)
  if (!imagePath.includes('://')) return false;

  // OAuth 제공자 도메인 확인
  const oauthDomains = [
    'googleapis.com',      // Google
    'googleusercontent.com', // Google
    'githubusercontent.com', // GitHub
    'github.com',          // GitHub
    'kakaocdn.net',        // Kakao
    'kakao.com',           // Kakao
  ];

  return oauthDomains.some(domain => imagePath.includes(domain));
}

/**
 * 캐릭터 이름이 유효한지 검증
 *
 * @param {string} name - 검증할 캐릭터 이름
 * @returns {boolean} 유효한 캐릭터 이름 여부
 */
export function isValidCharacterName(name: string): name is CharacterName {
  return AVAILABLE_CHARACTERS.includes(name as CharacterName);
}

/**
 * 모든 캐릭터 목록 반환 (API 응답용)
 *
 * 프론트엔드 캐릭터 선택 UI에서 사용할 캐릭터 목록을 반환합니다.
 *
 * @returns {Array<{name: string, path: string}>} 캐릭터 이름과 경로 배열
 */
export function getAllCharacters(): Array<{ name: CharacterName; path: string }> {
  return AVAILABLE_CHARACTERS.map(name => ({
    name,
    path: `/character/${name}.jpeg`,
  }));
}
