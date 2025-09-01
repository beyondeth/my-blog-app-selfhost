# 소셜 로그인 통합 가이드 (Social Login Integration Guide)

## 📅 작성일: 2025-09-01
## 👤 작성자: Claude Code Assistant
## 🎯 목적: 향후 네이버, 깃허브 등 추가 소셜 로그인 구현 시 참고 문서

---

## 📋 목차
1. [현재 구현 상태](#1-현재-구현-상태)
2. [오늘 작업 내역 및 이슈](#2-오늘-작업-내역-및-이슈)
3. [신규 소셜 로그인 추가 가이드](#3-신규-소셜-로그인-추가-가이드)
4. [주요 파일 구조](#4-주요-파일-구조)
5. [체크리스트](#5-체크리스트)
6. [주의사항](#6-주의사항)
7. [테스트 시나리오](#7-테스트-시나리오)

---

## 1. 현재 구현 상태

### 구현된 소셜 로그인
- ✅ **Google OAuth 2.0**
- ✅ **Kakao OAuth 2.0**

### 주요 기능
- 소셜 로그인을 통한 회원가입/로그인
- 기존 계정에 소셜 계정 연결
- 소셜 로그인 계정의 비밀번호 재설정 방지
- 중복 이메일 체크 및 안내

---

## 2. 오늘 작업 내역 및 이슈

### 🔧 작업 내역

#### 2.1 이메일 템플릿 단순화
**문제점:**
- 이메일 템플릿이 너무 복잡하고 색상이 많아 신뢰도가 떨어짐
- 폰트 크기와 스타일이 일관되지 않음

**해결방법:**
```typescript
// 📍 /backend/src/email/email.service.ts
// 기존: 복잡한 색상과 그라데이션
// 개선: 단순한 흑백 디자인, 일관된 폰트 크기
private getPasswordResetTemplate(resetUrl: string, username: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- 심플한 헤더 -->
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #000;">
        <h1 style="margin: 0; color: #000; font-size: 24px;">codebase.blog</h1>
      </div>
      <!-- 나머지 내용도 단순화 -->
    </div>
  `;
}
```

#### 2.2 소셜 로그인 계정 비밀번호 재설정 방지
**문제점:**
- 소셜 로그인 계정이 비밀번호 재설정을 시도할 수 있음
- 사용자에게 명확한 안내 부족

**해결방법:**

**백엔드:**
```typescript
// 📍 /backend/src/auth/auth.service.ts
async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
  const user = await this.usersService.findByEmail(email);
  
  if (!user) {
    // 보안: 이메일 존재 여부를 노출하지 않음
    return;
  }

  // 소셜 로그인 계정 체크
  if (user.authProvider !== AuthProvider.LOCAL) {
    throw new BadRequestException('소셜 로그인 계정은 비밀번호 재설정이 필요하지 않습니다');
  }
  // ... 비밀번호 재설정 로직
}
```

**프론트엔드:**
```typescript
// 📍 /frontend/src/app/forgot-password/page.tsx
// 소셜 로그인 계정 감지 시 전용 UI 표시
if (response.status === 400 && data.message?.includes('소셜 로그인')) {
  setIsSocialAccount(true);
  // 소셜 로그인 안내 화면 표시
}
```

#### 2.3 회원가입 중복 이메일 체크
**확인사항:**
- 이미 구현되어 있음 ✅
- `EmailService.sendVerificationCode()`에서 중복 체크
- 409 Conflict 상태 코드 반환
- 프론트엔드에서 적절히 처리

---

## 3. 신규 소셜 로그인 추가 가이드

### 🎯 네이버/깃허브 로그인 추가 시 필요한 작업

### 3.1 백엔드 구현

#### Step 1: AuthProvider Enum 확장
```typescript
// 📍 /backend/src/auth/enums/auth-provider.enum.ts
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  KAKAO = 'kakao',
  NAVER = 'naver',  // 추가
  GITHUB = 'github'  // 추가
}
```

#### Step 2: OAuth Strategy 구현
```typescript
// 📍 /backend/src/auth/strategies/naver.strategy.ts (새 파일)
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver';  // npm install passport-naver

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('NAVER_CLIENT_ID'),
      clientSecret: configService.get('NAVER_CLIENT_SECRET'),
      callbackURL: configService.get('NAVER_CALLBACK_URL'),
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const { email, nickname, profile_image } = profile._json;
    
    return this.authService.validateOAuthUser({
      email,
      username: nickname,
      authProvider: AuthProvider.NAVER,
      providerId: profile.id,
      profileImage: profile_image,
    });
  }
}
```

#### Step 3: AuthModule에 Strategy 등록
```typescript
// 📍 /backend/src/auth/auth.module.ts
@Module({
  providers: [
    // ... 기존 providers
    NaverStrategy,  // 추가
    GithubStrategy, // 추가
  ],
})
```

#### Step 4: Controller 엔드포인트 추가
```typescript
// 📍 /backend/src/auth/auth.controller.ts
@Get('naver')
@UseGuards(AuthGuard('naver'))
async naverAuth() {}

@Get('naver/callback')
@UseGuards(AuthGuard('naver'))
async naverAuthCallback(@Req() req, @Res() res) {
  return this.handleOAuthCallback(req, res, 'naver');
}
```

#### Step 5: 환경 변수 추가
```bash
# 📍 /backend/.env
# Naver OAuth
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NAVER_CALLBACK_URL=http://localhost:3000/api/v1/auth/naver/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
```

### 3.2 프론트엔드 구현

#### Step 1: 로그인 페이지에 버튼 추가
```tsx
// 📍 /frontend/src/app/login/page.tsx
{/* Naver Login */}
<button
  type="button"
  onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/naver'}
  className="w-full flex items-center justify-center px-5 py-3 bg-[#03C75A] hover:bg-[#02B550] rounded-full text-sm font-semibold text-white transition-all shadow-sm"
>
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
    {/* 네이버 N 로고 SVG */}
    <path fill="white" d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
  </svg>
  네이버로 로그인
</button>

{/* GitHub Login */}
<button
  type="button"
  onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/github'}
  className="w-full flex items-center justify-center px-5 py-3 bg-[#24292e] hover:bg-[#1a1e22] rounded-full text-sm font-semibold text-white transition-all shadow-sm"
>
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="white">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
  깃허브로 로그인
</button>
```

#### Step 2: 비밀번호 찾기 페이지 업데이트
```tsx
// 📍 /frontend/src/app/forgot-password/page.tsx
// 소셜 로그인 안내 화면에 새로운 버튼 추가
// 로그인 페이지와 동일한 스타일 사용
```

### 3.3 이메일 템플릿 수정

#### 계정 연결 알림 이메일
```typescript
// 📍 /backend/src/email/email.service.ts
private getAccountLinkTemplate(provider: string, username: string): string {
  let providerName = '';
  let providerColor = '';
  
  switch(provider.toLowerCase()) {
    case 'google':
      providerName = 'Google';
      providerColor = '#4285F4';
      break;
    case 'kakao':
      providerName = 'Kakao';
      providerColor = '#FEE500';
      break;
    case 'naver':
      providerName = 'Naver';
      providerColor = '#03C75A';
      break;
    case 'github':
      providerName = 'GitHub';
      providerColor = '#24292e';
      break;
  }
  // ... 템플릿 생성
}
```

---

## 4. 주요 파일 구조

```
my-blog-app/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── strategies/
│   │   │   │   ├── google.strategy.ts
│   │   │   │   ├── kakao.strategy.ts
│   │   │   │   ├── naver.strategy.ts (신규)
│   │   │   │   └── github.strategy.ts (신규)
│   │   │   ├── enums/
│   │   │   │   └── auth-provider.enum.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   └── email/
│   │       └── email.service.ts
│   └── .env
├── frontend/
│   └── src/
│       └── app/
│           ├── login/
│           │   └── page.tsx
│           ├── forgot-password/
│           │   └── page.tsx
│           └── register/
│               └── page.tsx
```

---

## 5. 체크리스트

### 백엔드 체크리스트
- [ ] AuthProvider enum에 새로운 provider 추가
- [ ] OAuth Strategy 클래스 구현
- [ ] passport-[provider] 패키지 설치
- [ ] AuthModule에 Strategy 등록
- [ ] Controller에 엔드포인트 추가
- [ ] 환경 변수 설정 (.env)
- [ ] 이메일 템플릿에 provider 추가

### 프론트엔드 체크리스트
- [ ] 로그인 페이지에 버튼 추가
- [ ] 회원가입 페이지에 버튼 추가 (선택)
- [ ] 비밀번호 찾기 페이지 소셜 안내 화면 업데이트
- [ ] SVG 아이콘 준비
- [ ] 버튼 색상 및 스타일 정의

### OAuth 앱 설정 체크리스트
- [ ] OAuth 앱 생성 (각 provider 개발자 센터)
- [ ] Redirect URI 설정
- [ ] Client ID/Secret 발급
- [ ] 필요한 권한 scope 설정 (email, profile 등)

---

## 6. 주의사항

### ⚠️ 보안 관련
1. **환경 변수 관리**
   - Client Secret은 절대 프론트엔드에 노출되면 안 됨
   - .env 파일은 .gitignore에 포함 필수
   - Production 환경에서는 환경 변수 암호화 고려

2. **에러 메시지**
   - 이메일 존재 여부를 노출하지 않도록 주의
   - 비밀번호 재설정 시 계정 존재 여부와 관계없이 동일한 메시지 표시

3. **Rate Limiting**
   - 이메일 발송: 분당 1회, 일 5회 제한
   - 비밀번호 재설정: 5분당 1회 제한
   - 로그인 시도: 5회 실패 시 일시 차단

### 🎨 UI/UX 관련
1. **일관성 유지**
   - 모든 소셜 로그인 버튼은 rounded-full 스타일 사용
   - 폰트 크기: text-sm, font-semibold
   - 패딩: px-5 py-3
   - 아이콘 크기: w-5 h-5 mr-2

2. **색상 가이드**
   - Google: 흰색 배경, 다색 로고
   - Kakao: #FEE500 (노란색)
   - Naver: #03C75A (초록색)
   - GitHub: #24292e (검은색)

3. **이메일 템플릿**
   - 단순한 디자인 유지 (흑백 위주)
   - 일관된 폰트 크기
   - 과도한 색상 사용 자제

### 🔄 마이그레이션 관련
1. **기존 사용자 처리**
   - 동일 이메일로 여러 provider 연결 가능하도록 설계
   - 기존 LOCAL 계정에 소셜 계정 연결 기능 제공

2. **데이터베이스 스키마**
   - authProvider 필드가 새로운 값 지원하는지 확인
   - provider별 고유 ID 저장 (providerId)

---

## 7. 테스트 시나리오

### 신규 소셜 로그인 테스트
1. **신규 가입 플로우**
   - [ ] 소셜 로그인 버튼 클릭
   - [ ] OAuth 인증 페이지 리다이렉트
   - [ ] 권한 승인
   - [ ] 콜백 처리 및 JWT 발급
   - [ ] 홈페이지 리다이렉트

2. **기존 계정 연결**
   - [ ] 이메일 주소가 동일한 경우 자동 연결
   - [ ] 계정 연결 알림 이메일 발송
   - [ ] 프로필 정보 업데이트

3. **비밀번호 재설정 차단**
   - [ ] 소셜 로그인 계정으로 비밀번호 재설정 시도
   - [ ] "소셜 로그인 계정입니다" 메시지 표시
   - [ ] 적절한 소셜 로그인 버튼 안내

4. **중복 이메일 처리**
   - [ ] 이미 가입된 이메일로 회원가입 시도
   - [ ] 409 에러 및 안내 메시지 표시

### 엣지 케이스
1. **OAuth 실패 처리**
   - [ ] 사용자가 권한 거부
   - [ ] OAuth provider 오류
   - [ ] 네트워크 오류

2. **토큰 만료**
   - [ ] Access Token 만료 시 갱신
   - [ ] Refresh Token 처리

3. **계정 삭제/연결 해제**
   - [ ] 소셜 계정 연결 해제 기능
   - [ ] 마지막 인증 수단 삭제 방지

---

## 📝 추가 메모

### 개발 환경 설정
```bash
# 필요한 패키지 설치 (백엔드)
pnpm add passport-naver passport-github @types/passport-naver @types/passport-github

# 환경 변수 예시
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
NAVER_CALLBACK_URL=http://localhost:3000/api/v1/auth/naver/callback

GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
```

### 참고 문서
- [네이버 로그인 API 문서](https://developers.naver.com/docs/login/overview/)
- [GitHub OAuth Apps 문서](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Passport.js Strategy 문서](http://www.passportjs.org/docs/)

### 트러블슈팅 가이드
1. **"redirect_uri_mismatch" 에러**
   - OAuth 앱 설정에서 Redirect URI 확인
   - 환경 변수의 CALLBACK_URL 확인
   - http/https, 포트 번호, 경로 정확히 일치 필요

2. **"invalid_client" 에러**
   - Client ID/Secret 확인
   - 환경 변수 로드 확인
   - OAuth 앱 활성화 상태 확인

3. **소셜 로그인 후 쿠키 설정 안 됨**
   - CORS 설정 확인
   - credentials: 'include' 설정 확인
   - SameSite 쿠키 정책 확인

---

## 🎯 다음 단계 권장사항

1. **우선순위**
   - 네이버 로그인 (한국 사용자 대상)
   - GitHub 로그인 (개발자 커뮤니티 대상)
   - Apple 로그인 (iOS 앱 출시 시 필수)

2. **보안 강화**
   - 2FA (Two-Factor Authentication) 구현
   - 계정 연결 시 이메일 인증 추가
   - 비정상 로그인 감지 및 알림

3. **사용자 경험 개선**
   - 소셜 로그인 선택 화면 개선
   - 자동 로그인 기능
   - 계정 통합 관리 페이지

---

**작성 완료: 2025-09-01**
**다음 업데이트 예정: 네이버/GitHub 로그인 구현 후**