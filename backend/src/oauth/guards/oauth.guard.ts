import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OAuthService } from '../services/oauth.service';

/**
 * OAuth2 인증 가드
 * Bearer 토큰을 검증하고 요청 객체에 인증 정보 추가
 */
@Injectable()
export class OAuthGuard implements CanActivate {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Authorization 헤더에서 Bearer 토큰 추출
    const authHeader = request.headers.authorization;
    console.log('🔐 OAuth Guard - Authorization 헤더:', authHeader);

    if (!authHeader) {
      console.log('❌ OAuth Guard - Authorization 헤더가 없습니다');
      throw new UnauthorizedException('Authorization 헤더가 없습니다');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('❌ OAuth Guard - 잘못된 헤더 형식:', authHeader);
      throw new UnauthorizedException('잘못된 Authorization 헤더 형식입니다');
    }

    const accessToken = parts[1];
    console.log('🔑 OAuth Guard - 토큰:', accessToken.substring(0, 20) + '...');

    try {
      // 토큰 검증 및 정보 조회
      const tokenInfo = await this.oauthService.validateToken(accessToken);
      console.log('✅ OAuth Guard - 토큰 검증 성공:', { userId: tokenInfo.userId, blogId: tokenInfo.blogId });

      // 요청 객체에 OAuth 정보 추가
      request.oauth = {
        userId: tokenInfo.userId,
        blogId: tokenInfo.blogId,
        clientId: tokenInfo.clientId,
        scopes: tokenInfo.scopes,
      };

      // 스코프 검증 (데코레이터로 지정된 경우)
      const requiredScopes = this.reflector.get<string[]>(
        'scopes',
        context.getHandler(),
      );

      if (requiredScopes) {
        const hasRequiredScopes = requiredScopes.every(scope =>
          tokenInfo.scopes.includes(scope),
        );

        if (!hasRequiredScopes) {
          throw new UnauthorizedException('필요한 권한이 없습니다');
        }
      }

      return true;
    } catch (error) {
      console.log('❌ OAuth Guard - 토큰 검증 실패:', error.message);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('토큰 검증 실패');
    }
  }
}

/**
 * 선택적 OAuth2 가드
 * 토큰이 있으면 검증하고, 없어도 통과
 */
@Injectable()
export class OptionalOAuthGuard implements CanActivate {
  constructor(private readonly oauthService: OAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return true; // 토큰이 없어도 통과
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return true; // 형식이 맞지 않아도 통과
    }

    const accessToken = parts[1];

    try {
      // 토큰 검증 시도
      const tokenInfo = await this.oauthService.validateToken(accessToken);

      // 성공하면 요청 객체에 정보 추가
      request.oauth = {
        userId: tokenInfo.userId,
        blogId: tokenInfo.blogId,
        clientId: tokenInfo.clientId,
        scopes: tokenInfo.scopes,
      };
    } catch {
      // 실패해도 무시하고 통과
    }

    return true;
  }
}