/**
 * OAuth 2.1 타입 정의
 *
 * Claude 커스텀 커넥터를 위한 OAuth 2.1 구현
 * - RFC 8414: Authorization Server Metadata
 * - RFC 7591: Dynamic Client Registration
 * - RFC 9728: Protected Resource Metadata
 * - RFC 8707: Resource Parameter
 */

/**
 * RFC 7591 - 동적 클라이언트 등록 요청
 */
export interface ClientRegistrationRequest {
  // 필수 필드
  redirect_uris: string[];

  // 권장 필드
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;

  // 인증 관련
  token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic';
  grant_types?: string[];
  response_types?: string[];

  // 소프트웨어 정보
  software_id?: string;
  software_version?: string;
  software_statement?: string;
}

/**
 * RFC 7591 - 동적 클라이언트 등록 응답
 */
export interface ClientRegistrationResponse {
  // 필수 필드
  client_id: string;
  client_id_issued_at: number;

  // 조건부 필드 (client_secret이 발급된 경우)
  client_secret?: string;
  client_secret_expires_at?: number;

  // 등록 요청 필드 반환
  redirect_uris: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  software_id?: string;
  software_version?: string;

  // 추가 서버 메타데이터
  registration_access_token?: string;
  registration_client_uri?: string;
}

/**
 * 저장된 클라이언트 정보
 */
export interface StoredClient {
  clientId: string;
  clientSecret?: string;
  clientSecretExpiresAt?: number;
  clientIdIssuedAt: number;
  redirectUris: string[];
  clientName?: string;
  clientUri?: string;
  scope: string;
  tokenEndpointAuthMethod: string;
  grantTypes: string[];
  responseTypes: string[];
  softwareId?: string;
  softwareVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth 인증 코드 데이터
 */
export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;        // PKCE
  codeChallengeMethod: 'S256';  // PKCE (plain 미지원)
  resource: string;             // RFC 8707
  expiresAt: Date;
  createdAt: Date;
}

/**
 * OAuth 액세스 토큰 데이터
 */
export interface AccessToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  resource: string;             // RFC 8707 - 토큰 audience 바인딩
  expiresAt: Date;
  createdAt: Date;
}

/**
 * OAuth 리프레시 토큰 데이터
 */
export interface RefreshToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  resource: string;
  accessToken: string;          // 연결된 액세스 토큰
  expiresAt: Date;
  createdAt: Date;
}

/**
 * RFC 8414 - Authorization Server Metadata
 */
export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  service_documentation?: string;
  ui_locales_supported?: string[];
  op_policy_uri?: string;
  op_tos_uri?: string;
  revocation_endpoint?: string;
  revocation_endpoint_auth_methods_supported?: string[];
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
}

/**
 * RFC 9728 - Protected Resource Metadata
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[];
  resource_signing_alg_values_supported?: string[];
  resource_documentation?: string;
}

/**
 * 토큰 응답
 */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * 토큰 에러 응답
 */
export interface TokenErrorResponse {
  error: 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unauthorized_client' | 'unsupported_grant_type' | 'invalid_scope';
  error_description?: string;
  error_uri?: string;
}

/**
 * OAuth 세션 상태 (인증 흐름 중)
 */
export interface OAuthSession {
  state: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  resource: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 검증된 토큰 정보 (미들웨어에서 사용)
 */
export interface ValidatedToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  resource: string;
  expiresAt: Date;
}

/**
 * OAuth 에러 코드
 */
export const OAuthErrorCodes = {
  // RFC 6749 에러
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',

  // RFC 7591 에러 (DCR)
  INVALID_REDIRECT_URI: 'invalid_redirect_uri',
  INVALID_CLIENT_METADATA: 'invalid_client_metadata',
  INVALID_SOFTWARE_STATEMENT: 'invalid_software_statement',
  UNAPPROVED_SOFTWARE_STATEMENT: 'unapproved_software_statement',

  // 토큰 에러
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
} as const;

export type OAuthErrorCode = typeof OAuthErrorCodes[keyof typeof OAuthErrorCodes];
