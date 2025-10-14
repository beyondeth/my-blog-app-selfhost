/**
 * 입력 검증 스키마
 *
 * Zod를 사용한 타입 안정성 및 보안 강화
 * - XSS 공격 방어
 * - SQL Injection 방어
 * - 입력 크기 제한
 */

import { z } from 'zod';

/**
 * 공통 검증 패턴
 */
const XSS_PATTERN = /[<>]/;  // HTML 태그 차단
const SAFE_STRING = z.string().refine(
  (val) => !XSS_PATTERN.test(val),
  { message: 'HTML tags are not allowed' }
);

/**
 * 세션 ID 검증
 * - 64자 hexadecimal (32바이트)
 */
export const SessionIdSchema = z.string()
  .length(64, 'Session ID must be 64 characters')
  .regex(/^[0-9a-f]{64}$/, 'Invalid session ID format');

/**
 * create_post 도구 파라미터 검증
 */
export const CreatePostSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .refine(
      (val) => !XSS_PATTERN.test(val),
      { message: '제목에 HTML 태그는 허용되지 않습니다' }
    ),

  content_markdown: z.string()
    .min(100, '콘텐츠는 최소 100자 이상이어야 합니다')
    .max(100000, '콘텐츠는 100KB를 초과할 수 없습니다'),

  tags: z.array(
    z.string()
      .max(50, '태그는 50자를 초과할 수 없습니다')
      .refine(
        (val) => !XSS_PATTERN.test(val),
        { message: '태그에 HTML 태그는 허용되지 않습니다' }
      )
  )
    .max(10, '태그는 최대 10개까지 허용됩니다')
    .optional(),

  category: z.string()
    .max(100, '카테고리는 100자를 초과할 수 없습니다')
    .refine(
      (val) => !XSS_PATTERN.test(val),
      { message: '카테고리에 HTML 태그는 허용되지 않습니다' }
    )
    .optional(),

  // Phase 1: 스타일 가이드 검증 토큰 (LLM이 스타일 파일을 읽었는지 확인)
  validationToken: z.string()
    .min(10, '검증 토큰이 너무 짧습니다')
    .max(100, '검증 토큰이 너무 깁니다')
    .regex(/^[a-zA-Z0-9-]+$/, '검증 토큰 형식이 올바르지 않습니다')
    .optional(),

  // Phase 2: 동적 챌린지 답변 (스타일 가이드 이해도 확인)
  challengeAnswer: z.string()
    .max(200, '챌린지 답변이 너무 깁니다')
    .refine(
      (val) => !XSS_PATTERN.test(val),
      { message: '챌린지 답변에 HTML 태그는 허용되지 않습니다' }
    )
    .optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

/**
 * URL 검증 (SSRF 방어)
 */
export const SafeUrlSchema = z.string()
  .url('유효한 URL이 아닙니다')
  .refine(
    (val) => {
      const url = new URL(val);
      // 외부 URL만 허용 (내부 네트워크 차단)
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.', // AWS 메타데이터
        '10.',      // Private network
        '172.16.',  // Private network
        '192.168.', // Private network
      ];

      return !blockedHosts.some(host => url.hostname.includes(host));
    },
    { message: '내부 네트워크 URL은 허용되지 않습니다' }
  );

/**
 * OAuth 파라미터 검증
 */
export const OAuthCallbackSchema = z.object({
  code: z.string()
    .min(1, 'Authorization code is required')
    .max(500, 'Authorization code too long'),

  state: SessionIdSchema,

  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackInput = z.infer<typeof OAuthCallbackSchema>;

/**
 * PKCE 검증
 */
export const PkceSchema = z.object({
  code_verifier: z.string()
    .min(43, 'Code verifier must be at least 43 characters')
    .max(128, 'Code verifier must not exceed 128 characters')
    .regex(/^[A-Za-z0-9\-._~]+$/, 'Invalid code verifier format'),

  code_challenge: z.string()
    .length(43, 'Code challenge must be 43 characters')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Invalid code challenge format'),
});

/**
 * User-Agent 검증
 */
export const UserAgentSchema = z.string()
  .max(500, 'User-Agent too long')
  .optional();

/**
 * IP 주소 검증
 */
export const IpAddressSchema = z.string()
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
    'Invalid IP address format'
  )
  .optional();

/**
 * 페이지네이션 검증
 */
export const PaginationSchema = z.object({
  page: z.number()
    .int()
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page too large')
    .default(1),

  limit: z.number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * 검증 에러 포매터
 */
export function formatValidationError(error: z.ZodError): string {
  const errors = error.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return errors.join(', ');
}

/**
 * 안전한 검증 헬퍼
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatValidationError(error) };
    }
    return { success: false, error: 'Validation failed' };
  }
}
