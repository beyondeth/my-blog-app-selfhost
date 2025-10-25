import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Public 데코레이터가 적용된 경우 JWT 인증 우회
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      console.log('[JwtAuthGuard] Public route detected, bypassing JWT auth');
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // 🔍 디버그: JWT에서 추출한 user 정보 확인
    if (user) {
      console.log(`[JwtAuthGuard] JWT decoded - email: ${user.email}, role: "${user.role}" (type: ${typeof user.role})`);
    }

    if (err || !user) {
      // 중요한 OAuth 요청인 경우만 로그
      if (request.url?.includes('oauth')) {
        console.error('[JwtAuthGuard] OAuth Authentication failed:', {
          url: request.url,
          error: err?.message || 'No user found',
          info: info?.message
        });
      }

      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
} 