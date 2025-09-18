import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
}

@Injectable()
export class McpRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(McpRateLimitGuard.name);
  private readonly attempts = new Map<string, RateLimitEntry>();

  // Configuration
  private readonly MAX_ATTEMPTS = 10; // Max requests per window
  private readonly WINDOW_MS = 60000; // 1 minute window
  private readonly BLOCK_DURATION_MS: number;

  constructor(private readonly configService: ConfigService) {
    // constructor에서 환경 변수 로드
    this.BLOCK_DURATION_MS = this.configService.get<number>('MCP_RATE_LIMIT_BLOCK_DURATION', 300000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const identifier = this.getIdentifier(request);
    
    const now = new Date();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      // First attempt
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Check if blocked due to previous violations
    const timeSinceFirst = now.getTime() - entry.firstAttempt.getTime();
    
    if (entry.count >= this.MAX_ATTEMPTS && timeSinceFirst < this.BLOCK_DURATION_MS) {
      const remainingBlock = Math.ceil(
        (this.BLOCK_DURATION_MS - timeSinceFirst) / 1000,
      );
      
      this.logger.warn(
        `Rate limit exceeded for ${identifier}. Blocked for ${remainingBlock}s`,
      );
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `너무 많은 요청입니다. ${remainingBlock}초 후에 다시 시도하세요.`,
          retryAfter: remainingBlock,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reset counter if window has passed
    if (timeSinceFirst > this.WINDOW_MS) {
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Increment counter
    entry.count++;
    entry.lastAttempt = now;

    if (entry.count > this.MAX_ATTEMPTS) {
      this.logger.warn(
        `Rate limit exceeded for ${identifier}. Starting block period.`,
      );
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.',
          retryAfter: this.BLOCK_DURATION_MS / 1000,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getIdentifier(request: any): string {
    // Use API key if available, otherwise use IP
    const apiKey = request.headers['x-api-key'] || 
                   request.headers['authorization']?.replace('Bearer ', '');
    
    if (apiKey) {
      return `api:${apiKey.substring(0, 20)}`;
    }

    // Fallback to IP address
    const ip = request.ip || 
               request.connection?.remoteAddress || 
               request.headers['x-forwarded-for'] || 
               'unknown';
    
    return `ip:${ip}`;
  }

  // Cleanup old entries periodically (should be called by a scheduled job)
  cleanupOldEntries(): void {
    const now = new Date();
    const cutoff = now.getTime() - this.BLOCK_DURATION_MS;

    for (const [key, entry] of this.attempts.entries()) {
      if (entry.lastAttempt.getTime() < cutoff) {
        this.attempts.delete(key);
      }
    }

    this.logger.log(`Cleaned up rate limit entries. Current size: ${this.attempts.size}`);
  }
}