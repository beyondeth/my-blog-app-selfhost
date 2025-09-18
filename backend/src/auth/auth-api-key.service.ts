import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ApiKey } from '../api-keys/entities/api-key.entity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthApiKeyService {
  private readonly logger = new Logger(AuthApiKeyService.name);
  private readonly TIMESTAMP_WINDOW: number;
  private readonly usedNonces = new Map<string, number>(); // 논스 저장 (메모리)
  private readonly NONCE_CLEANUP_INTERVAL = 600000; // 10분마다 정리

  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly configService: ConfigService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {
    // constructor에서 환경 변수 로드
    this.TIMESTAMP_WINDOW = this.configService.get<number>('API_KEY_TIMESTAMP_WINDOW', 300000);

    // 주기적으로 오래된 논스 정리
    setInterval(() => this.cleanupNonces(), this.NONCE_CLEANUP_INTERVAL);
  }

  /**
   * HMAC 서명 검증을 통한 API 키 인증
   * API 키 자체는 전송되지 않고, 서명만 검증
   */
  async verifyApiKeySignature(
    timestamp: string,
    nonce: string,
    signature: string,
    keyId: string, // API 키 ID (평문 키가 아님)
  ): Promise<{ valid: boolean; userId?: string; blogId?: string; apiKeyId?: string }> {
    try {
      // 1. 타임스탬프 검증 (리플레이 공격 방지)
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      
      if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.TIMESTAMP_WINDOW) {
        this.logger.warn('Invalid or expired timestamp');
        return { valid: false };
      }

      // 2. 논스 중복 체크 (리플레이 공격 방지)
      if (this.usedNonces.has(nonce)) {
        this.logger.warn('Nonce already used');
        return { valid: false };
      }
      
      // 논스 저장 (타임스탬프와 함께)
      this.usedNonces.set(nonce, requestTime);

      // 3. API 키 ID로 직접 조회
      const apiKey = await this.apiKeyRepository.findOne({
        where: { keyId: keyId, isActive: true },
        relations: ['user', 'blog']
      });

      if (!apiKey) {
        this.logger.warn(`API key not found or inactive: ${keyId}`);
        return { valid: false };
      }

      // 4. 서명 시크릿 가져오기 및 HMAC 검증
      const signingSecret = await this.apiKeysService.getSigningSecret(apiKey.id);
      if (!signingSecret) {
        this.logger.warn(`No signing secret for API key: ${keyId}`);
        return { valid: false };
      }
      
      // HMAC 서명 생성 및 검증
      const message = `${timestamp}:${nonce}:${keyId}`;
      const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(message)
        .digest('hex');

      // 타이밍 공격 방지를 위한 안전한 비교
      if (!this.timingSafeEqual(signature, expectedSignature)) {
        this.logger.warn('Invalid signature');
        return { valid: false };
      }

      const matchedApiKey = apiKey;

      // 5. 만료 시간 확인
      if (matchedApiKey.expiresAt && matchedApiKey.expiresAt < new Date()) {
        this.logger.warn('API key expired');
        return { valid: false };
      }

      // 6. 마지막 사용 시간 업데이트
      matchedApiKey.lastUsedAt = new Date();
      await this.apiKeyRepository.save(matchedApiKey);

      // 7. 성공 응답
      this.logger.log(`API key verified successfully for blog: ${matchedApiKey.blog?.slug || 'unknown'}`);
      
      return { 
        valid: true,
        userId: matchedApiKey.userId,
        blogId: matchedApiKey.blogId,
        apiKeyId: matchedApiKey.id
      };

    } catch (error) {
      this.logger.error('API key verification error:', error);
      return { valid: false };
    }
  }

  /**
   * AWS V4 스타일로 API 키 검증 (Secret은 전송되지 않음)
   */
  async verifyWithIdAndSecret(
    keyId: string,
    keySecret: string | undefined,  // keySecret이 없을 수 있음 (AWS V4 스타일)
    timestamp: string,
    nonce: string,
    signature: string,
    headers?: any,
    body?: string
  ): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    try {
      // 1. 타임스탬프 검증
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      
      if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.TIMESTAMP_WINDOW) {
        this.logger.warn('Timestamp validation failed');
        return { valid: false };
      }

      // 2. 논스 중복 체크
      if (this.usedNonces.has(nonce)) {
        this.logger.warn('Nonce already used');
        return { valid: false };
      }
      this.usedNonces.set(nonce, requestTime);

      // 3. API Key ID로 데이터베이스에서 조회
      const apiKey = await this.apiKeyRepository.findOne({
        where: { 
          keyId: keyId,
          isActive: true 
        },
        relations: ['user', 'blog']
      });

      if (!apiKey) {
        this.logger.warn(`API key not found or inactive: ${keyId}`);
        return { valid: false };
      }

      // 4. AWS V4 스타일 서명 검증
      // keySecret이 제공되지 않은 경우 (AWS V4 스타일)
      if (!keySecret) {
        // 데이터베이스에서 저장된 Signing Secret 조회 (복호화된 평문)
        const signingSecret = await this.apiKeysService.getSigningSecret(apiKey.id);
        if (!signingSecret) {
          this.logger.warn(`No signing secret found for API key: ${keyId}`);
          return { valid: false };
        }

        // 보안 서명 생성 (Secret 미전송 방식)
        const method = "POST";
        const uri = "/auth/verify-api-key-id-secret";
        const expectedSignature = this.createSecureSignature(
          method,
          uri,
          timestamp,
          nonce,
          keyId,
          signingSecret,  // 복호화된 평문 시크릿 사용
          body || ""
        );

        // 서명 비교 (타이밍 공격 방지)
        if (!this.timingSafeEqual(signature, expectedSignature)) {
          this.logger.warn('Signature verification failed', {
            receivedSignature: signature.substring(0, 32),
            expectedSignature: expectedSignature.substring(0, 32),
            keyId,
            timestamp,
            nonce
          });
          return { valid: false };
        }
      } else {
        // 레거시 방식 (keySecret이 제공된 경우) - 향후 deprecated
        const validation = await this.apiKeysService.validateApiKey(keyId, keySecret);
        if (!validation.valid || !validation.apiKey) {
          return { valid: false };
        }
      }

      // 5. 마지막 사용 시간 업데이트
      apiKey.lastUsedAt = new Date();
      await this.apiKeyRepository.save(apiKey);

      return { valid: true, apiKey };

    } catch (error) {
      this.logger.error('ID/Secret verification error:', error);
      return { valid: false };
    }
  }

  /**
   * 실제 API 키로 HMAC 서명 검증 (평문 키를 가진 경우) - 레거시 지원
   */
  async verifyWithPlainKey(
    plainKey: string,
    timestamp: string,
    nonce: string,
    signature: string,
  ): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    try {
      // 1. 타임스탬프 검증
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      
      if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.TIMESTAMP_WINDOW) {
        return { valid: false };
      }

      // 2. 논스 중복 체크
      if (this.usedNonces.has(nonce)) {
        return { valid: false };
      }
      this.usedNonces.set(nonce, requestTime);

      // 3. API 키 검증 (bcrypt 해시와 비교)
      const validation = await this.apiKeysService.validateApiKey(plainKey);
      if (!validation.valid || !validation.apiKey) {
        return { valid: false };
      }

      // 4. HMAC 서명 생성 및 검증
      const message = `${timestamp}:${nonce}`;
      const expectedSignature = crypto
        .createHmac('sha256', plainKey)
        .update(message)
        .digest('hex');

      if (!this.timingSafeEqual(signature, expectedSignature)) {
        return { valid: false };
      }

      return { valid: true, apiKey: validation.apiKey };

    } catch (error) {
      this.logger.error('Plain key verification error:', error);
      return { valid: false };
    }
  }

  /**
   * API 요청 서명 검증 (각 API 호출마다)
   */
  async verifyRequestSignature(
    method: string,
    endpoint: string,
    timestamp: string,
    nonce: string,
    signature: string,
    apiKey: string,
  ): Promise<boolean> {
    try {
      // 타임스탬프 검증
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      
      if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.TIMESTAMP_WINDOW) {
        return false;
      }

      // 논스 중복 체크
      if (this.usedNonces.has(nonce)) {
        return false;
      }
      this.usedNonces.set(nonce, requestTime);

      // HMAC 서명 생성
      const message = `${method}:${endpoint}:${timestamp}:${nonce}`;
      const expectedSignature = crypto
        .createHmac('sha256', apiKey)
        .update(message)
        .digest('hex');

      // 서명 비교 (타이밍 공격 방지)
      return this.timingSafeEqual(signature, expectedSignature);

    } catch (error) {
      this.logger.error('Request signature verification error:', error);
      return false;
    }
  }

  /**
   * 보안 서명 생성 (서버측) - Secret 미전송 방식
   */
  private createSecureSignature(
    method: string,
    uri: string,
    timestamp: string,
    nonce: string,
    keyId: string,
    keySecret: string,
    body: string = ""
  ): string {
    // Create message to sign (includes all critical request elements)
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    const message = [
      method,
      uri,
      keyId,
      timestamp,
      nonce,
      bodyHash
    ].join(':');

    // Sign with secret (secret never transmitted)
    const signature = crypto
      .createHmac("sha256", keySecret)
      .update(message)
      .digest("hex");

    // Debug logging
    this.logger.warn('Secure Signature Debug:', {
      method,
      uri,
      keyId,
      timestamp,
      nonce,
      body: body.substring(0, 200),
      bodyHash: bodyHash,
      message: message,
      signature: signature,
      keySecret: keySecret.substring(0, 10) + '...'
    });

    return signature;
  }

  /**
   * 타이밍 공격 방지를 위한 안전한 문자열 비교
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a, 'hex');
    const bBuffer = Buffer.from(b, 'hex');
    
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }

  /**
   * 오래된 논스 정리 (메모리 관리)
   */
  private cleanupNonces(): void {
    const currentTime = Date.now();
    const expiredTime = currentTime - this.TIMESTAMP_WINDOW;
    
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (timestamp < expiredTime) {
        this.usedNonces.delete(nonce);
      }
    }
    
    this.logger.debug(`Cleaned up nonces. Current count: ${this.usedNonces.size}`);
  }
}