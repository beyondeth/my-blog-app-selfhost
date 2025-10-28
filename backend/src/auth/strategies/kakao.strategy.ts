import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../users/entities/user.entity';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('KAKAO_CLIENT_ID'),
      clientSecret: configService.get('KAKAO_CLIENT_SECRET'),
      callbackURL: configService.get('KAKAO_CALLBACK_URL'),
      // Kakao OAuth 스코프 - 공백으로 구분
      // openid는 OpenID Connect 활성화 시에만 사용
      // account_email은 카카오 개발자 콘솔에서 필수 동의 항목으로 설정해야 함
      scope: 'account_email',
      // response_type을 명시적으로 설정
      authorizationParams: {
        response_type: 'code',
      },
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    // 카카오 프로필 전체 구조 확인
    console.log('Kakao profile structure:', {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      emails: profile.emails,
      _json: profile._json,
      _raw: profile._raw,
    });

    // Kakao는 이메일을 다른 방식으로 제공할 수 있음
    if (profile._json) {
      console.log('Kakao _json details:', {
        email: profile._json.email,
        kakao_account: profile._json.kakao_account,
      });

      // kakao_account 안에 이메일이 있을 수 있음
      if (profile._json.kakao_account) {
        console.log('Kakao account details:', profile._json.kakao_account);

        // 이메일을 kakao_account에서 가져와서 profile.emails에 추가
        if (profile._json.kakao_account.email) {
          profile.emails = [{
            value: profile._json.kakao_account.email,
            verified: profile._json.kakao_account.is_email_verified || false
          }];
        }
      }
    }

    const result = await this.authService.validateOAuthUser(profile, AuthProvider.KAKAO);
    return result;
  }
} 