/**
 * 비밀번호 강도 검증 유틸리티
 * KISA 및 NIST 보안 권장사항 기반
 */

import type { AppLocale } from './i18n/config';

// 비밀번호 강도 체크 결과 타입
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasForbiddenChars: boolean;
  strength: 'weak' | 'fair' | 'good' | 'strong';
  message: string;
}

// 금지된 문자 패턴
const FORBIDDEN_CHARS_PATTERN = /["'\\<>`\s]/;

// 허용되는 특수문자 패턴
const SPECIAL_CHARS_PATTERN = /[!@#$%^&*()_+\-=\[\]{};:,.?/]/;

// 대문자 패턴
const UPPERCASE_PATTERN = /[A-Z]/;

// 소문자 패턴
const LOWERCASE_PATTERN = /[a-z]/;

// 숫자 패턴
const NUMBER_PATTERN = /[0-9]/;

const PASSWORD_COPY: Record<
  AppLocale,
  {
    empty: string;
    forbiddenChars: string;
    minLength: string;
    weak: string;
    fair: string;
    good: string;
    strong: string;
    minTypeCount: string;
    checklist: {
      minLength: string;
      upperCase: string;
      lowerCase: string;
      number: string;
      specialChar: string;
      noForbiddenChars: string;
    };
  }
> = {
  ko: {
    empty: '비밀번호를 입력해주세요',
    forbiddenChars: '사용할 수 없는 문자가 포함되어 있습니다: " \' \\ < > ` 공백',
    minLength: '비밀번호는 최소 8자 이상이어야 합니다',
    weak: '비밀번호가 너무 약합니다',
    fair: '비밀번호 강도가 보통입니다',
    good: '안전한 비밀번호입니다',
    strong: '매우 강력한 비밀번호입니다',
    minTypeCount: '대문자, 소문자, 숫자, 특수문자 중 3종류 이상을 포함해야 합니다',
    checklist: {
      minLength: '최소 8자 이상',
      upperCase: '대문자 포함',
      lowerCase: '소문자 포함',
      number: '숫자 포함',
      specialChar: '특수문자 포함',
      noForbiddenChars: '금지 문자 없음',
    },
  },
  en: {
    empty: 'Enter a password.',
    forbiddenChars: 'Your password contains unsupported characters: " \' \\ < > ` or whitespace.',
    minLength: 'Your password must be at least 8 characters long.',
    weak: 'Your password is too weak.',
    fair: 'Your password strength is fair.',
    good: 'Your password is secure.',
    strong: 'Your password is very strong.',
    minTypeCount:
      'Use at least three of the following: uppercase letters, lowercase letters, numbers, and special characters.',
    checklist: {
      minLength: 'At least 8 characters',
      upperCase: 'Uppercase letter',
      lowerCase: 'Lowercase letter',
      number: 'Number',
      specialChar: 'Special character',
      noForbiddenChars: 'No unsupported characters',
    },
  },
};

export function getPasswordRequirementLabels(locale: AppLocale = 'en') {
  return PASSWORD_COPY[locale].checklist;
}

/**
 * 비밀번호 강도 검증
 * @param password 검증할 비밀번호
 * @returns 비밀번호 강도 정보
 */
export function validatePasswordStrength(password: string, locale: AppLocale = 'en'): PasswordStrength {
  const copy = PASSWORD_COPY[locale];
  const result: PasswordStrength = {
    isValid: false,
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasForbiddenChars: false,
    strength: 'weak',
    message: ''
  };

  // 빈 문자열 체크
  if (!password) {
    result.message = copy.empty;
    return result;
  }

  // 금지된 문자 체크
  if (FORBIDDEN_CHARS_PATTERN.test(password)) {
    result.hasForbiddenChars = true;
    result.message = copy.forbiddenChars;
    return result;
  }

  // 최소 길이 체크 (8자)
  result.hasMinLength = password.length >= 8;
  if (!result.hasMinLength) {
    result.message = copy.minLength;
    return result;
  }

  // 각 문자 유형 체크
  result.hasUpperCase = UPPERCASE_PATTERN.test(password);
  result.hasLowerCase = LOWERCASE_PATTERN.test(password);
  result.hasNumber = NUMBER_PATTERN.test(password);
  result.hasSpecialChar = SPECIAL_CHARS_PATTERN.test(password);

  // 점수 계산 (각 조건당 1점)
  if (result.hasUpperCase) result.score++;
  if (result.hasLowerCase) result.score++;
  if (result.hasNumber) result.score++;
  if (result.hasSpecialChar) result.score++;

  // 추가 점수: 12자 이상이면 보너스
  if (password.length >= 12) {
    result.score = Math.min(result.score + 1, 4);
  }

  // 강도 판정
  if (result.score <= 1) {
    result.strength = 'weak';
    result.message = copy.weak;
  } else if (result.score === 2) {
    result.strength = 'fair';
    result.message = copy.fair;
  } else if (result.score === 3) {
    result.strength = 'good';
    result.message = copy.good;
  } else {
    result.strength = 'strong';
    result.message = copy.strong;
  }

  // 최소 3가지 문자 유형 체크 (필수 요구사항)
  const typeCount = [
    result.hasUpperCase,
    result.hasLowerCase,
    result.hasNumber,
    result.hasSpecialChar
  ].filter(Boolean).length;

  if (typeCount < 3) {
    result.isValid = false;
    result.message = copy.minTypeCount;
  } else {
    result.isValid = true;
  }

  return result;
}

/**
 * 비밀번호 강도에 따른 색상 클래스 반환
 * @param strength 비밀번호 강도
 * @returns Tailwind CSS 색상 클래스
 */
export function getPasswordStrengthColor(strength: PasswordStrength['strength']): string {
  switch (strength) {
    case 'weak':
      return 'text-red-500 border-red-500';
    case 'fair':
      return 'text-amber-500 border-amber-500';
    case 'good':
      return 'text-blue-500 border-blue-500';
    case 'strong':
      return 'text-green-500 border-green-500';
    default:
      return 'text-gray-400 border-gray-400';
  }
}

/**
 * 비밀번호 강도 프로그레스 바 너비 계산
 * @param score 비밀번호 점수 (0-4)
 * @returns 프로그레스 바 너비 (%)
 */
export function getPasswordStrengthWidth(score: number): string {
  return `${(score / 4) * 100}%`;
}

/**
 * 자주 사용되는 약한 비밀번호 체크
 * @param password 검증할 비밀번호
 * @returns 약한 비밀번호 여부
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', 'Password', 'password123', 'Password123',
    '12345678', '123456789', '1234567890',
    'qwerty123', 'abc12345', 'admin123',
    'letmein', 'welcome', 'monkey', 'dragon'
  ];

  return commonPasswords.includes(password.toLowerCase());
}

/**
 * 사용자 정보가 비밀번호에 포함되어 있는지 체크
 * @param password 검증할 비밀번호
 * @param email 사용자 이메일
 * @param username 사용자명
 * @returns 사용자 정보 포함 여부
 */
export function containsUserInfo(
  password: string,
  email?: string,
  username?: string
): boolean {
  const lowerPassword = password.toLowerCase();

  // 이메일의 로컬 부분 체크
  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase();
    if (lowerPassword.includes(emailLocal)) {
      return true;
    }
  }

  // 사용자명 체크
  if (username && lowerPassword.includes(username.toLowerCase())) {
    return true;
  }

  return false;
}
