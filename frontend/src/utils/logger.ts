/**
 * 보안 강화된 로거 유틸리티
 * 프로덕션 환경에서는 민감한 정보를 로깅하지 않음
 */

// 환경 변수로 로깅 레벨 제어
const LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'error';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// 프로덕션 환경에서는 console 메서드가 제거될 수 있으므로 안전한 대체 함수
const safeConsole = {
  log: IS_PRODUCTION ? () => {} : console.log,
  info: IS_PRODUCTION ? () => {} : console.info,
  warn: IS_PRODUCTION ? () => {} : console.warn,
  error: console.error, // 에러는 프로덕션에서도 유지
  debug: IS_PRODUCTION ? () => {} : console.debug,
};

// 민감한 필드 목록 (로깅에서 제외)
// 프로덕션 환경에서는 더 엄격한 필터링
const SENSITIVE_FIELDS = process.env.NODE_ENV === 'production' ? [
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
  'jwt',
  'bearer',
] : [
  'password',
  'access_token',
  'refresh_token',
  'api_key',
  'apiKey',
  'secret',
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
 * 객체에서 민감한 정보 제거 (성능 최적화)
 */
function sanitizeData(data: any): any {
  // 레벨 체크 먼저 수행하여 불필요한 처리 방지
  if (!data || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (typeof data === 'string') {
    // 간단한 문자열 체크 먼저
    if (data.length > 200) {
      return data.substring(0, 200) + '...';
    }
    // URL에서 민감한 파라미터 제거
    if (data.includes('token=') || data.includes('key=') || data.includes('password=')) {
      return '[REDACTED_URL]';
    }
    return data;
  }

  // 배열은 길이 제한
  if (Array.isArray(data)) {
    if (data.length > 10) {
      return [...data.slice(0, 10).map(item => sanitizeData(item)), '...(' + (data.length - 10) + ' more items)'];
    }
    return data.map(item => sanitizeData(item));
  }

  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const keys: string[] = [];
    for (const key of data.keys()) {
      keys.push(key);
      if (keys.length >= 10) {
        break;
      }
    }

    return {
      type: 'FormData',
      keys,
      truncated: keys.length >= 10,
    };
  }

  if (typeof File !== 'undefined' && data instanceof File) {
    return {
      type: 'File',
      name: data.name,
      size: data.size,
      mimeType: data.type,
    };
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return {
      type: 'Blob',
      size: data.size,
      mimeType: data.type,
    };
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (typeof data === 'function') {
    return `[Function${data.name ? `:${data.name}` : ''}]`;
  }

  // 객체는 깊이 제한하여 재귀 방지
  if (typeof data === 'object') {
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }
    const sanitized: any = {};
    let keyCount = 0;

    for (const key in data) {
      // 최대 10개 키까지만 처리
      if (keyCount >= 10) {
        sanitized['...'] = 'more properties';
        break;
      }
      keyCount++;

      const lowerKey = key.toLowerCase();

      // 민감한 필드는 제거
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (key === 'headers' || key === 'config') {
        // 헤더와 설정은 최소 정보만
        sanitized[key] = '[HEADERS_HIDDEN]';
      } else {
        try {
          sanitized[key] = sanitizeData((data as any)[key]);
        } catch (error) {
          sanitized[key] = `[UNREADABLE:${error instanceof Error ? error.message : 'unknown'}]`;
        }
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

    // 콘솔 출력 (safeConsole 사용)
    if (IS_PRODUCTION) {
      // 프로덕션: 에러만 로깅, 상세 정보 제거
      if (level === 'error') {
        safeConsole.error(`${prefix} ${message}`);
      }
    } else if (IS_DEVELOPMENT) {
      // 개발 환경: 상세 로깅 (민감 정보는 제거된 상태)
      // 민감한 데이터 제거 (개발 환경에서만) - 안전하게 처리
      const sanitizedArgs = args.map(arg => {
        try {
          return sanitizeData(arg);
        } catch (error) {
          return `[UNSERIALIZABLE_ARG:${error instanceof Error ? error.message : 'unknown'}]`;
        }
      });

      const prepareArgs = sanitizedArgs.map((arg) => {
        if (arg === null || arg === undefined) {
          return arg;
        }

        if (typeof arg === 'object') {
          if (typeof structuredClone === 'function') {
            try {
              return structuredClone(arg);
            } catch {
              return arg;
            }
          }

          return arg;
        }

        return arg;
      });

      const logWithFallback = (logFn: (...args: any[]) => void) => {
        try {
          logFn(`${prefix} ${message}`, ...prepareArgs);
        } catch (error) {
          const fallbackMsg =
            error instanceof Error
              ? `[LOGGER_ERROR:${error.message}]`
              : '[LOGGER_ERROR:unknown]';
          logFn(`${prefix} ${message} ${fallbackMsg}`);
        }
      };

      switch (level) {
        case 'error':
          logWithFallback(safeConsole.error);
          break;
        case 'warn':
          logWithFallback(safeConsole.warn);
          break;
        case 'info':
          logWithFallback(safeConsole.info);
          break;
        case 'debug':
          logWithFallback(safeConsole.log);
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
   * API 요청 로깅 (최소화)
   */
  apiRequest(method: string, url: string, data?: any, shouldLog: boolean = false): void {
    // 기본값을 false로 변경하여 필요한 경우에만 로깅
    if (!shouldLog) {
      return;
    }

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
   * API 응답 로깅 (에러만)
   */
  apiResponse(status: number, url: string, data?: any): void {
    // 에러 응답만 로깅
    if (status >= 400) {
      if (IS_PRODUCTION) {
        // 프로덕션: 최소 정보만
        this.error(`API Error: ${status} ${url}`);
      } else {
        // 개발: 상세 정보 포함
        this.error(`API Error: ${status} ${url}`, sanitizeData(data));
      }
    }
    // 성공 응답은 로깅하지 않음
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
