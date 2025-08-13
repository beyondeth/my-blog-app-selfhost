import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { AuthApiKeyService } from '../auth/auth-api-key.service';

@Injectable()
export class McpAuthGuard implements CanActivate {
  private readonly logger = new Logger(McpAuthGuard.name);

  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly authApiKeyService: AuthApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;

    // HMAC 서명 검증 방식 (권장)
    const timestamp = headers['x-timestamp'];
    const nonce = headers['x-nonce'];
    const signature = headers['x-signature'];
    const keyId = headers['x-api-key-id'];

    if (timestamp && nonce && signature && keyId) {
      // HMAC 서명 검증
      const verification = await this.authApiKeyService.verifyApiKeySignature(
        timestamp,
        nonce,
        signature,
        keyId,
      );

      if (!verification.valid) {
        this.logger.warn('Invalid HMAC signature');
        throw new UnauthorizedException('유효하지 않은 서명입니다.');
      }

      // API 키 정보 조회
      const apiKey = await this.apiKeysService.findById(verification.apiKeyId);
      if (!apiKey) {
        throw new UnauthorizedException('API 키를 찾을 수 없습니다.');
      }

      // Request에 정보 첨부
      request.apiKey = apiKey;
      request.blog = apiKey.blog;
      request.user = apiKey.user;

      this.logger.log(
        `MCP auth successful (HMAC) - User: ${apiKey.user.email}, Blog: ${apiKey.blog.slug}`,
      );

      return true;
    }

    // 기존 방식 (평문 API 키) - 하위 호환성을 위해 유지
    const apiKey = 
      headers['x-api-key'] || 
      headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      this.logger.warn('MCP request without API key or signature');
      throw new UnauthorizedException('API 키 또는 서명이 필요합니다.');
    }

    // Validate API key
    const validation = await this.apiKeysService.validateApiKey(apiKey);
    
    if (!validation.valid) {
      this.logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 10)}...`);
      throw new UnauthorizedException('유효하지 않은 API 키입니다.');
    }

    // Check if API key is active
    if (!validation.apiKey.isActive) {
      this.logger.warn(`Inactive API key used: ${validation.apiKey.id}`);
      throw new UnauthorizedException('비활성화된 API 키입니다.');
    }

    // Check expiration
    if (validation.apiKey.expiresAt && validation.apiKey.expiresAt < new Date()) {
      this.logger.warn(`Expired API key used: ${validation.apiKey.id}`);
      throw new UnauthorizedException('만료된 API 키입니다.');
    }

    // Attach API key data to request for use in controllers
    request.apiKey = validation.apiKey;
    request.blog = validation.apiKey.blog;
    request.user = validation.apiKey.user;

    // Log successful authentication
    this.logger.log(
      `MCP auth successful (Plain) - User: ${validation.apiKey.user.email}, Blog: ${validation.apiKey.blog.slug}`,
    );

    return true;
  }
}