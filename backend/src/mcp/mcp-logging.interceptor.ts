import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class McpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('MCP-API');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, headers } = request;
    const startTime = Date.now();

    // Extract identifying information
    const apiKeyHeader = headers['x-api-key'] || headers['authorization'];
    const apiKeyPreview = apiKeyHeader ? 
      `${apiKeyHeader.substring(0, 10)}...` : 'no-key';
    
    // Log request details
    const requestLog = {
      timestamp: new Date().toISOString(),
      method,
      url,
      apiKey: apiKeyPreview,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: headers['user-agent'],
    };

    // Log request body for POST/PUT (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      const sanitizedBody = this.sanitizeBody(body);
      requestLog['body'] = sanitizedBody;
    }

    this.logger.log(`[REQUEST] ${JSON.stringify(requestLog)}`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const responseLog = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode: response.statusCode,
            responseTime: `${responseTime}ms`,
            apiKey: apiKeyPreview,
          };

          // Log successful responses
          this.logger.log(`[RESPONSE] ${JSON.stringify(responseLog)}`);

          // Log slow requests (> 1000ms)
          if (responseTime > 1000) {
            this.logger.warn(
              `[SLOW] Request to ${method} ${url} took ${responseTime}ms`,
            );
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const errorLog = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode: error.status || 500,
            responseTime: `${responseTime}ms`,
            apiKey: apiKeyPreview,
            error: error.message,
          };

          // Log error responses
          this.logger.error(`[ERROR] ${JSON.stringify(errorLog)}`);
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'refresh_token',
      'access_token',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeBody(sanitized[key]);
      }
    }

    return sanitized;
  }
}