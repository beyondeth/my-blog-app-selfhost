/**
 * 보안 강화된 로거 유틸리티
 * 프로덕션 환경에서는 민감한 정보를 로깅하지 않음
 */

// 환경 변수로 로깅 레벨 제어
const LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'error';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// 민감한 필드 목록 (로깅에서 제외)
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'secret',
  'credentials',
  'x-api-key',
  'x-session-token',
];

// 민감한 URL 패턴 (상세 로깅 제외)
const SENSITIVE_URLS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/api/v1/auth',
  '/users/profile',
];

/**
 * 객체에서 민감한 정보 제거
 */
function sanitizeData(data: any): any {
  if (!data) return data;
  
  if (typeof data === 'string') {
    // URL에서 민감한 파라미터 제거
    if (data.includes('token=') || data.includes('key=')) {
      return '[REDACTED_URL]';
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    
    for (const key in data) {
      const lowerKey = key.toLowerCase();
      
      // 민감한 필드는 제거
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (key === 'headers' || key === 'config') {
        // 헤더와 설정은 최소 정보만
        sanitized[key] = '[HEADERS_HIDDEN]';
      } else {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * URL이 민감한지 확인
 */
function isSensitiveUrl(url: string): boolean {
  return SENSITIVE_URLS.some(pattern => url.includes(pattern));
}

/**
 * 로그 레벨 확인
 */
function shouldLog(level: string): boolean {
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(LOG_LEVEL);
  const requestedLevelIndex = levels.indexOf(level);
  
  return requestedLevelIndex <= currentLevelIndex;
}

/**
 * 보안 강화된 로거 클래스
 */
class SecureLogger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  private formatMessage(level: string, message: string, ...args: any[]): void {
    // 프로덕션에서는 디버그 로그 완전 차단
    if (IS_PRODUCTION && level === 'debug') {
      return;
    }

    // 로그 레벨 체크
    if (!shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level.toUpperCase()}]`;
    
    // 민감한 데이터 제거
    const sanitizedArgs = args.map(arg => sanitizeData(arg));
    
    // 콘솔 출력 (프로덕션에서는 최소화)
    if (IS_PRODUCTION) {
      // 프로덕션: 에러만 로깅, 상세 정보 제거
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
        // 상세 정보는 로깅하지 않음
      }
    } else if (IS_DEVELOPMENT) {
      // 개발 환경: 상세 로깅 (민감 정보는 제거된 상태)
      switch (level) {
        case 'error':
          console.error(`${prefix} ${message}`, ...sanitizedArgs);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}`, ...sanitizedArgs);
          break;
        case 'info':
          console.info(`${prefix} ${message}`, ...sanitizedArgs);
          break;
        case 'debug':
          console.log(`${prefix} ${message}`, ...sanitizedArgs);
          break;
      }
    }
  }

  error(message: string, ...args: any[]): void {
    this.formatMessage('error', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.formatMessage('warn', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.formatMessage('info', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.formatMessage('debug', message, ...args);
  }

  /**
   * API 요청 로깅 (보안 강화)
   */
  apiRequest(method: string, url: string, data?: any): void {
    if (IS_PRODUCTION) {
      // 프로덕션: API 요청 로깅 안 함
      return;
    }

    if (isSensitiveUrl(url)) {
      // 민감한 URL은 최소 정보만
      this.debug(`API Request: ${method} [SENSITIVE_ENDPOINT]`);
    } else {
      // 일반 URL은 sanitized 데이터와 함께
      this.debug(`API Request: ${method} ${url}`, sanitizeData(data));
    }
  }

  /**
   * API 응답 로깅 (보안 강화)
   */
  apiResponse(status: number, url: string, data?: any): void {
    if (IS_PRODUCTION) {
      // 프로덕션: 에러 응답만 로깅
      if (status >= 400) {
        this.error(`API Error: ${status} ${url}`);
      }
      return;
    }

    if (isSensitiveUrl(url)) {
      // 민감한 URL은 상태 코드만
      this.debug(`API Response: ${status} [SENSITIVE_ENDPOINT]`);
    } else {
      // 일반 URL은 sanitized 데이터와 함께
      this.debug(`API Response: ${status} ${url}`, sanitizeData(data));
    }
  }
}

// 로거 인스턴스 생성 헬퍼
export function createLogger(context: string): SecureLogger {
  return new SecureLogger(context);
}

// 기본 로거 인스턴스
export const logger = new SecureLogger('Default');

// 특정 컨텍스트용 로거
export const apiLogger = new SecureLogger('API');
export const authLogger = new SecureLogger('Auth');
export const blogLogger = new SecureLogger('Blog');

export default SecureLogger;