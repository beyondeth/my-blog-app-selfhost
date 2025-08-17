import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // 간단하게 기본 Guard만 사용 (state는 OAuth2 Strategy가 처리)
} 