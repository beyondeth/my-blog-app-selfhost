import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../users/entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      // Google OAuth 2.0 공식 문서 권장 설정
      accessType: 'offline',  // refresh token 받기 위해 필요
      prompt: 'consent',       // 항상 동의 화면 표시 (refresh token 보장)
      state: false,           // Guard에서 직접 처리하므로 false
      includeGrantedScopes: true, // 점진적 권한 부여
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const result = await this.authService.validateOAuthUser(profile, AuthProvider.GOOGLE);
    done(null, result);
  }
} 