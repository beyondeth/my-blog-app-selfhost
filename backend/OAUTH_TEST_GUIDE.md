# OAuth 로그인 테스트 가이드

## 개선된 기능

### 1. 이메일 기반 사용자명 생성
- OAuth 로그인 시 실제 이메일을 기반으로 사용자명 자동 생성
- 예: `luticek@gmail.com` → username: `luticek`
- 특수문자는 언더스코어로 변환: `test.user@gmail.com` → `test_user`

### 2. 이메일 기반 블로그 주소 생성
- 블로그 slug도 이메일 prefix 기반으로 생성
- 예: `luticek@gmail.com` → blog slug: `luticek`
- 중복 시 자동으로 숫자 추가: `luticek-1`, `luticek-2`

### 3. OAuth 이메일 요구사항
- Google/Kakao OAuth 로그인 시 반드시 실제 이메일 획득
- 이메일을 가져올 수 없으면 에러 발생 및 안내 메시지 표시
- 임시 이메일(`providerId@provider.com`) 패턴 자동 업데이트

## Google OAuth 테스트

### 1. Google Cloud Console 설정 확인
```
승인된 JavaScript 원본:
- http://localhost:3000
- http://localhost:3001

승인된 리디렉션 URI:
- http://localhost:3000/api/v1/auth/google/callback
```

### 2. 테스트 절차
1. 프론트엔드에서 "Google로 로그인" 클릭
2. Google 계정 선택
3. 권한 동의 (이메일, 프로필)
4. 로그인 완료 후 확인:
   - 사용자명이 이메일 prefix로 설정됨
   - 블로그가 자동 생성됨

## Kakao OAuth 테스트

### 1. Kakao Developers 설정 확인
```
플랫폼 설정:
- Web 사이트 도메인: http://localhost:3001

Redirect URI:
- http://localhost:3000/api/v1/auth/kakao/callback

동의 항목:
- 이메일 (필수 동의)
- 프로필 정보 (선택 동의)
```

### 2. 중요 설정
- **카카오 로그인 > 동의 항목**에서 "카카오계정(이메일)" 필수 동의로 설정
- OpenID Connect는 선택사항 (현재 비활성화 상태로 유지)

### 3. 테스트 절차
1. 프론트엔드에서 "카카오로 로그인" 클릭
2. 카카오 계정으로 로그인
3. 이메일 동의 확인
4. 로그인 완료 후 확인:
   - 실제 이메일 (예: `luticek@naver.com`)로 계정 생성
   - 사용자명과 블로그 주소가 이메일 기반으로 생성

## 데이터베이스 확인

### 사용자 정보 확인
```sql
-- OAuth 사용자 확인
SELECT id, email, username, "authProvider", "providerId" 
FROM users 
WHERE "authProvider" IN ('google', 'kakao');
```

### 블로그 정보 확인
```sql
-- 자동 생성된 블로그 확인
SELECT b.slug, b.name, u.email, u.username 
FROM blogs b 
JOIN users u ON b."userId" = u.id 
WHERE u."authProvider" IN ('google', 'kakao');
```

## 트러블슈팅

### Google OAuth 이메일 못 가져오는 경우
- Google 계정 설정에서 이메일 공개 설정 확인
- 앱 권한에서 이메일 접근 허용 확인

### Kakao OAuth 이메일 못 가져오는 경우
- 카카오 계정 설정에서 이메일 등록 확인
- 카카오 개발자 콘솔에서 "카카오계정(이메일)" 필수 동의 설정 확인
- 이메일 동의 화면에서 반드시 동의 체크

### 이메일 기반 username/slug 중복
- 시스템이 자동으로 숫자를 추가하여 고유하게 만듦
- 예: `luticek`, `luticek-1`, `luticek-2`

## 로그 확인

백엔드 로그에서 OAuth 프로세스 확인:
```bash
# 백엔드 로그 확인
cd backend
pnpm start:dev

# 주요 로그 메시지
# - "OAuth google email from profile: luticek@gmail.com"
# - "New OAuth user created with blog: luticek@gmail.com via google"
# - "Blog created automatically for user: luticek@gmail.com with slug: luticek"
```