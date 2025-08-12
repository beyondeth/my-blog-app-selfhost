import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // API 키는 Authorization 헤더 또는 x-api-key 헤더에서 가져옴
    const apiKey = this.extractApiKey(request);
    
    if (!apiKey) {
      throw new UnauthorizedException('API 키가 필요합니다.');
    }

    const validation = await this.apiKeysService.validateApiKey(apiKey);
    
    if (!validation.valid) {
      throw new UnauthorizedException('유효하지 않은 API 키입니다.');
    }

    // request에 API 키 정보 추가
    request.apiKey = validation.apiKey;
    request.user = validation.apiKey.user;
    request.blog = validation.apiKey.blog;
    
    return true;
  }

  private extractApiKey(request: any): string | null {
    // x-api-key 헤더 확인
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }
    
    // Authorization Bearer 토큰 확인
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return null;
  }
}