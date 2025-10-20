/**
 * MCP JSON-RPC 2.0 에러 코드 정의
 *
 * 표준 JSON-RPC 2.0 에러 코드 + 커스텀 에러 코드
 * https://www.jsonrpc.org/specification#error_object
 */

/**
 * JSON-RPC 2.0 표준 에러 코드
 */
export enum JsonRpcErrorCode {
  /** 잘못된 JSON (파싱 에러) */
  PARSE_ERROR = -32700,

  /** 잘못된 요청 구조 (jsonrpc 버전, id 등) */
  INVALID_REQUEST = -32600,

  /** 메서드를 찾을 수 없음 (존재하지 않는 도구) */
  METHOD_NOT_FOUND = -32601,

  /** 잘못된 파라미터 (타입, 필수 파라미터 누락 등) */
  INVALID_PARAMS = -32602,

  /** 내부 서버 오류 (예상치 못한 에러) */
  INTERNAL_ERROR = -32603,
}

/**
 * MCP 서버 커스텀 에러 코드 (-32000 ~ -32099)
 */
export enum McpErrorCode {
  /** Rate limit 초과 */
  RATE_LIMIT_EXCEEDED = -32000,

  /** 세션을 찾을 수 없음 */
  SESSION_NOT_FOUND = -32001,

  /** 세션 만료됨 */
  SESSION_EXPIRED = -32002,

  /** 최대 동시 세션 수 초과 */
  MAX_SESSIONS_REACHED = -32003,

  /** 인증 실패 */
  AUTHENTICATION_FAILED = -32004,

  /** 권한 없음 */
  UNAUTHORIZED = -32005,

  /** 요청 페이로드가 너무 큼 */
  PAYLOAD_TOO_LARGE = -32006,

  /** 타임아웃 */
  TIMEOUT = -32007,

  /** Backend API 연결 실패 */
  BACKEND_CONNECTION_FAILED = -32008,

  /** Backend API 에러 */
  BACKEND_ERROR = -32009,
}

/**
 * JSON-RPC 2.0 에러 응답 인터페이스
 */
export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: JsonRpcErrorCode | McpErrorCode | number;
    message: string;
    data?: any;
  };
}

/**
 * 에러 응답 생성 헬퍼
 */
export function createJsonRpcError(
  code: JsonRpcErrorCode | McpErrorCode | number,
  message: string,
  id: string | number | null = null,
  data?: any
): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data && { data }),
    },
  };
}

/**
 * 에러 코드별 기본 메시지
 */
export const ERROR_MESSAGES: Record<JsonRpcErrorCode | McpErrorCode, string> = {
  [JsonRpcErrorCode.PARSE_ERROR]: 'Invalid JSON was received by the server',
  [JsonRpcErrorCode.INVALID_REQUEST]: 'The JSON sent is not a valid Request object',
  [JsonRpcErrorCode.METHOD_NOT_FOUND]: 'The method does not exist / is not available',
  [JsonRpcErrorCode.INVALID_PARAMS]: 'Invalid method parameter(s)',
  [JsonRpcErrorCode.INTERNAL_ERROR]: 'Internal JSON-RPC error',
  [McpErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please try again later',
  [McpErrorCode.SESSION_NOT_FOUND]: 'Session not found',
  [McpErrorCode.SESSION_EXPIRED]: 'Session has expired',
  [McpErrorCode.MAX_SESSIONS_REACHED]: 'Maximum concurrent sessions limit reached',
  [McpErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed',
  [McpErrorCode.UNAUTHORIZED]: 'Unauthorized access',
  [McpErrorCode.PAYLOAD_TOO_LARGE]: 'Request payload too large',
  [McpErrorCode.TIMEOUT]: 'Request timeout',
  [McpErrorCode.BACKEND_CONNECTION_FAILED]: 'Failed to connect to backend API',
  [McpErrorCode.BACKEND_ERROR]: 'Backend API error',
};

/**
 * 에러 코드 가져오기 (기본 메시지 포함)
 */
export function getErrorMessage(code: JsonRpcErrorCode | McpErrorCode): string {
  return ERROR_MESSAGES[code] || 'Unknown error';
}
