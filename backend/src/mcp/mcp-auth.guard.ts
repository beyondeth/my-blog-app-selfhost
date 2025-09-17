import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { McpRateLimitService } from './mcp-rate-limit.service';
import * as crypto from 'crypto';

@Injectable()
export class McpAuthGuard implements CanActivate {
  private readonly logger = new Logger(McpAuthGuard.name);
  private readonly TIMESTAMP_WINDOW = 300000; // 5분 시간 윈도우
  private readonly NONCE_TTL = 300; // 5분 TTL (초 단위)

  constructor(
    private readonly apiKeysService: ApiKeysService,
    @InjectRedis() private readonly redis: Redis,
    private readonly rateLimitService: McpRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;

    // 디버깅: 실제 받은 헤더 확인
    this.logger.log('=== MCP Auth Headers Received ===');
    this.logger.log(`x-api-key-id: ${headers['x-api-key-id']}`);
    this.logger.log(`x-timestamp: ${headers['x-timestamp']}`);
    this.logger.log(`x-nonce: ${headers['x-nonce']}`);
    this.logger.log(`x-signature: ${headers['x-signature']}`);
    this.logger.log(`x-api-key: ${headers['x-api-key'] ? 'Present' : 'Not present'}`);
    this.logger.log('=================================');

    // 클라이언트 IP 추출
    const clientIP = this.getClientIP(request);

    // HMAC 서명 검증 방식 (권장)
    const timestamp = headers['x-timestamp'];
    const nonce = headers['x-nonce'];
    const signature = headers['x-signature'];
    const keyId = headers['x-api-key-id'];

    if (timestamp && nonce && signature && keyId) {
      // 복잡한 HMAC 서명 검증 (AWS V4 스타일)
      try {
        // 1. 타임스탬프 검증
        const requestTime = parseInt(timestamp);
        const currentTime = Date.now();
        
        if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.TIMESTAMP_WINDOW) {
          this.logger.warn('Invalid or expired timestamp');
          throw new UnauthorizedException('타임스탬프가 만료되었습니다.');
        }

        // 2. 논스 중복 체크 (Redis 기반)
        if (await this.isNonceUsed(nonce)) {
          this.logger.warn('Nonce already used');
          throw new UnauthorizedException('이미 사용된 논스입니다.');
        }
        await this.markNonceAsUsed(nonce, requestTime);

        // 3. API 키 조회 및 검증
        const apiKey = await this.apiKeysService.findByKeyId(keyId);
        if (!apiKey) {
          this.logger.warn(`API key not found: ${keyId}`);
          throw new UnauthorizedException('유효하지 않은 API 키입니다.');
        }

        if (!apiKey.isActive) {
          this.logger.warn(`Inactive API key used: ${keyId}`);
          throw new UnauthorizedException('비활성화된 API 키입니다.');
        }

        // 4. 서명용 시크릿 가져오기 (keySecret 필드 직접 사용)
        // 주의: keySecret은 bcrypt 해시되어 있으므로, 원본 secret이 필요
        // signingSecret을 복호화하여 사용 (API Key ID의 UUID로 조회)
        const signingSecret = await this.apiKeysService.getApiKeySecretById(apiKey.id);
        if (!signingSecret) {
          this.logger.warn(`No signing secret for API key: ${keyId} (UUID: ${apiKey.id})`);
          throw new UnauthorizedException('API 키 시크릿을 찾을 수 없습니다.');
        }

        // 5. 복잡한 서명 검증 (method:uri:keyId:timestamp:nonce:bodyHash)
        const method = request.method;
        const uri = request.originalUrl || request.url;
        const body = request.body ? JSON.stringify(request.body) : '';
        
        // Body hash 생성
        const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
        
        // 서명 메시지 생성 (백엔드 createSecureSignature와 동일)
        const message = [
          method,
          uri,
          keyId,
          timestamp,
          nonce,
          bodyHash
        ].join(':');
        
        // 예상 서명 생성
        const expectedSignature = crypto
          .createHmac('sha256', signingSecret)
          .update(message)
          .digest('hex');

        // 타이밍 공격 방지를 위한 안전한 비교
        let sigBuffer1: Buffer;
        let sigBuffer2: Buffer;
        
        try {
          sigBuffer1 = Buffer.from(signature, 'hex');
          sigBuffer2 = Buffer.from(expectedSignature, 'hex');
        } catch (err) {
          this.logger.error('Failed to parse signatures as hex:', err);
          throw new UnauthorizedException('서명 형식이 잘못되었습니다.');
        }
        
        if (sigBuffer1.length !== sigBuffer2.length || !crypto.timingSafeEqual(sigBuffer1, sigBuffer2)) {
          this.logger.warn('Invalid HMAC signature - MISMATCH DETAILS', {
            keyId,
            receivedSignature: signature,
            expectedSignature: expectedSignature,
            receivedLength: sigBuffer1.length,
            expectedLength: sigBuffer2.length,
            secretPrefix: signingSecret.substring(0, 10) + '...',
            message,
            method,
            uri,
            timestamp,
            nonce,
            bodyHash,
          });
          throw new UnauthorizedException('유효하지 않은 서명입니다.');
        }

        // 6. 만료 시간 확인
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          this.logger.warn('API key expired');
          throw new UnauthorizedException('만료된 API 키입니다.');
        }

        // 7. Rate Limiting 체크
        const rateLimitResult = await this.rateLimitService.checkRateLimit(clientIP, keyId);
        if (!rateLimitResult.allowed) {
          // 실패 기록
          await this.rateLimitService.recordFailure(clientIP, keyId);

          const retryAfter = rateLimitResult.retryAfter || 60;
          this.logger.warn(
            `Rate limit exceeded - IP: ${clientIP}, API Key: ${keyId}, Retry after: ${retryAfter}s`
          );
          throw new UnauthorizedException(`요청 한도 초과. ${retryAfter}초 후 재시도하세요.`);
        }

        // 8. 성공 기록 및 마지막 사용 시간 업데이트
        await Promise.all([
          this.rateLimitService.recordSuccess(clientIP, keyId),
          this.apiKeysService.updateLastUsed(apiKey.id),
        ]);

        // Request에 정보 첨부
        request.apiKey = apiKey;
        request.blog = apiKey.blog;
        request.user = apiKey.user;

        this.logger.log(
          `MCP auth successful (Complex HMAC) - User: ${apiKey.user.email}, Blog: ${apiKey.blog.slug}, Remaining: ${rateLimitResult.remaining}`,
        );

        return true;

      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        this.logger.error('HMAC verification error:', error);
        throw new UnauthorizedException('인증 처리 중 오류가 발생했습니다.');
      }
    }

    // 하위 호환 방식 완전 제거 - HMAC 인증만 허용
    this.logger.warn('MCP request without HMAC signature - Access Denied');
    throw new UnauthorizedException(
      'HMAC 서명 인증이 필요합니다. x-api-key-id, x-timestamp, x-nonce, x-signature 헤더를 포함해주세요.'
    );
  }

  /**
   * Redis 기반 논스 중복 체크
   */
  private async isNonceUsed(nonce: string): Promise<boolean> {
    const key = `mcp:nonce:${nonce}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  /**
   * Redis에 논스 사용 기록 저장 (TTL 자동 만료)
   */
  private async markNonceAsUsed(nonce: string, timestamp: number): Promise<void> {
    const key = `mcp:nonce:${nonce}`;
    await this.redis.setex(key, this.NONCE_TTL, String(timestamp));

    this.logger.debug(`Nonce marked as used: ${nonce} (TTL: ${this.NONCE_TTL}s)`);
  }

  /**
   * 논스 통계 조회 (관리자용)
   */
  async getNonceStats(): Promise<{
    activeNonces: number;
    totalMemoryUsage: string;
    hitRate?: number;
  }> {
    try {
      // 현재 활성 논스 개수 조회 (Redis pattern scan)
      const keys = await this.redis.keys('mcp:nonce:*');
      const nonceCount = keys.length;

      // Redis INFO 명령으로 메모리 사용량 조회
      const info = await this.redis.info('memory');
      const memoryUsage = {
        estimatedSize: this.parseRedisInfo(info, 'used_memory_human'),
        hitRate: 0
      };

      return {
        activeNonces: nonceCount,
        totalMemoryUsage: memoryUsage.estimatedSize,
        hitRate: memoryUsage.hitRate,
      };
    } catch (error) {
      this.logger.error('Failed to get nonce stats:', error);
      return {
        activeNonces: -1,
        totalMemoryUsage: 'Unknown',
      };
    }
  }

  /**
   * Redis INFO 파싱 헬퍼
   */
  private parseRedisInfo(info: string, key: string): string {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(key + ':')) {
        return line.split(':')[1];
      }
    }
    return 'N/A';
  }

  /**
   * 클라이언트 IP 추출 (프록시, 로드번런서 고려)
   */
  private getClientIP(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return (
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}