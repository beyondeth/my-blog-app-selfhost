import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * OAuth 에러 처리
   * Strategy에서 UnauthorizedException 발생 시 프론트엔드로 에러 정보 전달
   */
  handleRequest(err, user, info, context: ExecutionContext) {
    const response = context.switchToHttp().getResponse();

    if (err || !user) {
      // 에러 코드 및 메시지 추출
      const errorCode = err?.response?.code || 'oauth_error';
      const errorMessage = encodeURIComponent(err?.response?.message || err?.message || '로그인 실패');
      const remainingDays = err?.response?.remainingDays || 0;
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';

      // 프론트엔드 콜백 페이지로 에러 정보와 함께 리다이렉트
      return response.redirect(
        `${frontendUrl}/auth/callback?error=${errorCode}&message=${errorMessage}&remainingDays=${remainingDays}`
      );
    }

    return user;
  }
} 