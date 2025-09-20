import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // 로그 제거 - 매 요청마다 출력되어 너무 많음
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      // 실패한 경우만 로그 (중요 이벤트)
      console.error('[JwtAuthGuard] Authentication failed:', {
        url: request.url,
        error: err?.message || 'No user found',
        info: info?.message
      });
      throw err || new UnauthorizedException('Authentication required');
    }

    // 성공 로그 제거 - 너무 빈번함
    return user;
  }
} 