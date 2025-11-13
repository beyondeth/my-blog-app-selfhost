import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * 전역 예외 필터
 * - 모든 예외를 일관된 형식으로 처리
 * - 보안: 민감 정보 누출 방지
 * - 모니터링: 에러 로깅 및 메트릭
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let details: any = null;

    // HttpException 처리
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details || null;
      } else {
        message = exception.message;
      }
    } else {
      // 예상치 못은 에러 처리
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';

      // 개발 환경에서만 상세 에러 노출
      if (this.configService.get('NODE_ENV') === 'development') {
        details = {
          error: exception instanceof Error ? exception.message : 'Unknown error',
          stack: exception instanceof Error ? exception.stack : undefined,
        };
      }
    }

    // 에러 로깅 (민감정보 제거)
    this.logError(exception, request);

    // UUID 파싱 에러 특별 처리
    if (message && message.includes('invalid input syntax for type uuid')) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid ID format';
      details = null;
    }

    // 데이터베이스 연결 에러 처리
    if (exception instanceof Error &&
        (exception.message.includes('ECONNREFUSED') ||
         exception.message.includes('connection'))) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Service temporarily unavailable';
      details = null;
    }

    // 일관된 에러 응답
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.sanitizeMessage(message),
      ...(details && { details }), // 개발 환경에서만 포함
      ...(this.configService.get('NODE_ENV') === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    // 헤더가 이미 전송되었는지 확인 (OAuth 콜백 등에서 중요)
    if (response.headersSent) {
      this.logger.warn(`Response headers already sent for ${request.method} ${request.url}. Cannot send error response.`);
      return;
    }

    // CORS 헤더는 main.ts에서만 관리 (credentials: true와 충돌 방지)
    // Exception Filter에서는 CORS 헤더를 설정하지 않음

    response.status(status).json(errorResponse);
  }

  /**
   * 에러 로깅 (민감정보 제거)
   */
  private logError(exception: unknown, request: Request): void {
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = (request as any).user?.id || 'anonymous';

    // 민감정보 마스킹
    const sanitizedUrl = this.sanitizeUrl(url);
    const sanitizedUserAgent = this.sanitizeUserAgent(userAgent);

    // 에러 메시지
    let errorMessage = 'Unknown error';
    if (exception instanceof Error) {
      errorMessage = exception.message;
    } else if (typeof exception === 'string') {
      errorMessage = exception;
    }

    // 민감정보가 포함된 메시지는 로깅하지 않음
    const sanitizedMessage = this.containsSensitiveInfo(errorMessage)
      ? 'Sensitive operation failed'
      : errorMessage;

    // 구조화된 로깅
    this.logger.error(
      `[${method}] ${sanitizedUrl} - ${sanitizedMessage}`,
      {
        userId: this.maskUserId(userId),
        ip: this.maskIp(ip),
        userAgent: sanitizedUserAgent,
        timestamp: new Date().toISOString(),
        exception: exception instanceof Error ? {
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        } : exception,
      }
    );
  }

  /**
   * 메시지에서 민감정보 제거
   */
  private sanitizeMessage(message: string | object | any): string {
    if (!message) return '';

    // 메시지가 객체인 경우 문자열로 변환
    let messageStr: string;
    if (typeof message === 'string') {
      messageStr = message;
    } else if (typeof message === 'object') {
      // ValidationPipe 에러 등 객체 메시지 처리
      if (message.message && typeof message.message === 'string') {
        messageStr = message.message;
      } else {
        // 객체를 JSON 문자열로 변환
        try {
          messageStr = JSON.stringify(message);
        } catch {
          messageStr = 'Validation error';
        }
      }
    } else {
      messageStr = String(message);
    }

    // 이메일, 비밀번호, 토큰 등 민감정보 마스킹
    return messageStr
      .replace(/email["\s]*[:=]["\s]*([^\s"'}]+)/gi, 'email: "***@***.***"')
      .replace(/password["\s]*[:=]["\s]*([^\s"'}]+)/gi, 'password: "***"')
      .replace(/token["\s]*[:=]["\s]*([^\s"'}]+)/gi, 'token: "***"')
      .replace(/Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi, 'Bearer ***')
      .replace(/([A-Za-z0-9]{32,})/g, '***'); // 32자 이상의 문자열 (可能是토큰)
  }

  /**
   * URL에서 민감정보 제거
   */
  private sanitizeUrl(url: string): string {
    if (!url) return url;

    // 쿼리 파라미터에서 민감정보 제거
    return url
      .replace(/([?&])(token|password|key|secret)=([^&]*)/gi, '$1$2=***')
      .replace(/\/api\/v1\/users\/[^\/\s]+/g, '/api/v1/users/***') // 사용자 ID 마스킹
      .replace(/\/api\/v1\/posts\/[^\/\s]+/g, '/api/v1/posts/***'); // 포스트 ID 마스킹
  }

  /**
   * User-Agent에서 민감정보 제거
   */
  private sanitizeUserAgent(userAgent: string): string {
    if (!userAgent) return userAgent;

    // 너무 긴 User-Agent는 자르기
    return userAgent.length > 200 ? userAgent.substring(0, 200) + '...' : userAgent;
  }

  /**
   * 사용자 ID 마스킹
   */
  private maskUserId(userId: string): string {
    if (!userId || userId === 'anonymous') return userId;

    // 앞 4자만 표시
    return userId.length > 4 ? userId.substring(0, 4) + '***' : '***';
  }

  /**
   * IP 주소 마스킹
   */
  private maskIp(ip: string): string {
    if (!ip) return ip;

    // IPv4 마스킹
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.***.***`;
    }

    // IPv6 마스킹
    return ip.substring(0, 6) + '***';
  }

  /**
   * 민감정보 포함 여부 확인
   */
  private containsSensitiveInfo(message: string): boolean {
    if (!message) return false;

    const sensitiveKeywords = [
      'password', 'token', 'secret', 'key', 'auth',
      'credential', 'private', 'confidential',
      'jwt', 'bearer', 'session', 'cookie',
    ];

    const lowerMessage = message.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}