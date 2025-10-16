/**
 * OAuth 2.1 타입 정의
 *
 * OAuth 토큰 교환 및 에러 응답 타입
 */

/**
 * OAuth 토큰 응답 (RFC 6749)
 */
export interface TokenResponse {
  /** 액세스 토큰 (필수) */
  access_token: string;

  /** 토큰 타입 (일반적으로 "Bearer") */
  token_type: string;

  /** 토큰 만료 시간 (초 단위, 선택) */
  expires_in?: number;

  /** 리프레시 토큰 (선택) */
  refresh_token?: string;

  /** 토큰 스코프 (선택) */
  scope?: string;
}

/**
 * OAuth 에러 응답 (RFC 6749 Section 5.2)
 */
export interface OAuthErrorResponse {
  /** 에러 코드 */
  error: string;

  /** 에러 상세 설명 (선택) */
  error_description?: string;

  /** 에러 관련 URI (선택) */
  error_uri?: string;
}

/**
 * OAuth 에러 코드 (표준)
 */
export enum OAuthErrorCode {
  /** 잘못된 요청 파라미터 */
  INVALID_REQUEST = 'invalid_request',

  /** 클라이언트 인증 실패 */
  INVALID_CLIENT = 'invalid_client',

  /** 권한 부여 실패 */
  INVALID_GRANT = 'invalid_grant',

  /** 권한 없음 */
  UNAUTHORIZED_CLIENT = 'unauthorized_client',

  /** 지원하지 않는 grant type */
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',

  /** 잘못된 스코프 */
  INVALID_SCOPE = 'invalid_scope',
}

/**
 * 토큰 교환 요청 파라미터
 */
export interface TokenExchangeParams {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  client_secret: string;
  code_verifier: string;
}
