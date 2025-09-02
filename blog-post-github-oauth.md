# GitHub OAuth 로그인 구현: Multi-Identity Architecture로 보안 취약점 해결하기

## 📋 목차
1. [문제 인식: Last Provider Wins 취약점](#문제-인식)
2. [해결 방안: Multi-Identity Architecture](#해결-방안)
3. [구현 과정](#구현-과정)
4. [발생한 에러와 해결](#에러와-해결)
5. [핵심 개념 설명](#핵심-개념)
6. [보안 고려사항](#보안-고려사항)
7. [결론](#결론)

## 🔍 문제 인식: Last Provider Wins 취약점 {#문제-인식}

### 시나리오
사용자가 `luticek88@gmail.com`으로 Google 로그인 후, 동일한 이메일로 Kakao 로그인을 시도하면 어떻게 될까?

기존 구현에서는 **"Last Provider Wins"** 문제가 발생했습니다:
```javascript
// ❌ 취약한 구현
const user = await User.findOne({ email });
if (user) {
  user.authProvider = 'kakao'; // Google → Kakao로 덮어씌워짐!
  await user.save();
}
```

이는 심각한 **계정 탈취(Account Takeover)** 취약점으로 이어질 수 있습니다.

## 💡 해결 방안: Multi-Identity Architecture {#해결-방안}

### 핵심 아이디어
한 사용자가 여러 OAuth 제공자로 로그인할 수 있도록 별도의 Identity 테이블을 만들어 관리합니다.

```typescript
// ✅ 안전한 구현
User (1) ──── (N) UserIdentity
         └─ email, username
         └─ UserIdentity[] 
             └─ provider (google/kakao/github)
             └─ providerId
             └─ providerEmail
```

### 장점
- 사용자는 여러 소셜 계정을 연결 가능
- 제공자별 고유 ID로 정확한 매칭
- 이메일 변경에도 안전한 인증

## 🛠️ 구현 과정 {#구현-과정}

### 1. 데이터베이스 마이그레이션

```typescript
// 1756795541631-CreateUserIdentitiesTable.ts
export class CreateUserIdentitiesTable1756795541631 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_identities 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'user_identities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'provider',
            type: 'varchar',
          },
          {
            name: 'providerId',
            type: 'varchar',
          },
          {
            name: 'providerEmail',
            type: 'varchar',
            isNullable: true,
          },
        ],
      }),
    );

    // 복합 유니크 인덱스: provider + providerId
    await queryRunner.createIndex(
      'user_identities',
      new TableIndex({
        name: 'IDX_PROVIDER_PROVIDERID',
        columnNames: ['provider', 'providerId'],
        isUnique: true,
      })
    );
  }
}
```

### 2. Entity 구조

```typescript
// user-identity.entity.ts
@Entity('user_identities')
@Unique(['provider', 'providerId'])
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  provider: string;

  @Column()
  providerId: string;

  @Column({ nullable: true })
  providerEmail: string;
}
```

### 3. GitHub OAuth Strategy

```typescript
// github.strategy.ts
@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID'),
      clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
      callbackURL: 'http://localhost:3000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const userProfile = {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.username,
      displayName: profile.displayName,
      provider: 'github',
    };

    return this.authService.validateOAuthUser(userProfile, 'github');
  }
}
```

### 4. 인증 서비스 로직

```typescript
// auth.service.ts
async validateOAuthUser(profile: any, provider: string) {
  // 1. 기존 Identity 확인
  const existingIdentity = await this.userIdentityRepository.findOne({
    where: {
      provider,
      providerId: profile.id,
    },
    relations: ['user'],
  });

  if (existingIdentity) {
    return this.generateTokens(existingIdentity.user);
  }

  // 2. 이메일로 사용자 찾기 (신뢰할 수 있는 제공자만 자동 연결)
  const trustedProviders = ['google', 'github'];
  if (trustedProviders.includes(provider) && profile.email) {
    const existingUser = await this.usersService.findByEmail(profile.email);
    
    if (existingUser) {
      // 새 Identity 생성 및 연결
      const newIdentity = this.userIdentityRepository.create({
        user: existingUser,
        provider,
        providerId: profile.id,
        providerEmail: profile.email,
      });
      await this.userIdentityRepository.save(newIdentity);
      return this.generateTokens(existingUser);
    }
  }

  // 3. 새 사용자 생성
  const newUser = await this.usersService.create({
    email: profile.email,
    username: profile.username || profile.email.split('@')[0],
    authProvider: provider,
  });

  const newIdentity = this.userIdentityRepository.create({
    user: newUser,
    provider,
    providerId: profile.id,
    providerEmail: profile.email,
  });
  await this.userIdentityRepository.save(newIdentity);

  return this.generateTokens(newUser);
}
```

## 🐛 발생한 에러와 해결 {#에러와-해결}

### 1. TypeScript 컴파일 에러

**문제**: Migration에서 `Index` 타입 에러
```typescript
// ❌ 에러 발생
import { Index } from 'typeorm';
new Index({ ... }); // TS2350: 'Index' 생성자 없음
```

**해결**: `TableIndex` 사용
```typescript
// ✅ 해결
import { TableIndex } from 'typeorm';
new TableIndex({ ... });
```

### 2. DTO 필드 누락

**문제**: `CreateUserDto`에 새 필드 누락
```typescript
// ❌ 컴파일 에러
export class CreateUserDto {
  email: string;
  username: string;
  // bio, accountVerifiedAt 누락!
}
```

**해결**: 필요한 필드 추가
```typescript
// ✅ 해결
export class CreateUserDto {
  email: string;
  username: string;
  bio?: string;
  accountVerifiedAt?: Date;
}
```

### 3. GitHub OAuth 설정 혼동

**문제**: GitHub App vs OAuth App 혼동
- 처음에 GitHub App 생성 시도
- Webhook URL 필수 요구 등 복잡한 설정

**해결**: OAuth App 사용
```
Settings → Developer settings → OAuth Apps → New OAuth App
- Homepage URL: http://localhost:3001
- Authorization callback URL: http://localhost:3000/api/v1/auth/github/callback
```

### 4. Guard 초기화 에러

**문제**: GitHub OAuth 미설정 시 앱 크래시
```typescript
// ❌ 설정 없으면 에러
if (!clientID) throw new Error('GitHub not configured');
```

**해결**: Dummy 값으로 초기화
```typescript
// ✅ 안전한 초기화
super({
  clientID: clientID || 'dummy-client-id',
  clientSecret: clientSecret || 'dummy-client-secret',
});
this.isConfigured = !!(clientID && clientSecret);
```

## 📚 핵심 개념 설명 {#핵심-개념}

### OAuth 2.0 Flow
```
User → Your App → GitHub → User (로그인) → GitHub → Your App (callback)
         ↓                                              ↓
    redirect_uri                                    access_token
    client_id                                       user_profile
```

### Provider Trust Levels
```typescript
const trustLevels = {
  'google': 'HIGH',   // 이메일 자동 검증
  'github': 'HIGH',   // 이메일 자동 검증
  'kakao': 'MEDIUM',  // 추가 검증 필요
  'naver': 'MEDIUM',  // 추가 검증 필요
};
```

### Multi-Identity 장점
1. **유연성**: 사용자가 원하는 방법으로 로그인
2. **보안성**: 계정 탈취 방지
3. **확장성**: 새 제공자 추가 용이
4. **사용자 경험**: 끊김 없는 인증 경험

## 🔒 보안 고려사항 {#보안-고려사항}

### 1. State Parameter (CSRF 방지)
```typescript
// Passport.js가 자동 처리
// state 파라미터로 CSRF 공격 방지
```

### 2. Scope 최소화
```typescript
scope: ['user:email'] // 필요한 권한만 요청
```

### 3. Provider ID 검증
```typescript
// provider + providerId 조합으로 유일성 보장
@Unique(['provider', 'providerId'])
```

### 4. 이메일 신뢰도
```typescript
// 신뢰할 수 있는 제공자만 자동 연결
const trustedProviders = ['google', 'github'];
```

## 🎯 결론 {#결론}

### 구현 성과
- ✅ GitHub OAuth 로그인 완전 구현
- ✅ Multi-Identity Architecture로 보안 강화
- ✅ 계정 탈취 취약점 해결
- ✅ 3개 제공자(Google, Kakao, GitHub) 통합

### 배운 점
1. **보안 우선**: 편의성보다 보안이 중요
2. **확장 가능한 설계**: 처음부터 다중 제공자 고려
3. **에러 처리**: Graceful degradation 구현
4. **사용자 경험**: 복잡한 로직을 단순한 UX로

### 향후 개선사항
- [ ] Identity 관리 UI (연결/해제)
- [ ] 2FA 구현
- [ ] OAuth 토큰 갱신 로직
- [ ] 더 많은 제공자 추가 (Apple, Microsoft)

---

**작성일**: 2025-01-02  
**작업 시간**: 약 4시간  
**주요 기술**: NestJS, TypeORM, Passport.js, OAuth 2.0, Next.js 14

> 💡 **핵심 교훈**: "간단해 보이는 로그인 기능도 보안을 고려하면 복잡해진다. 하지만 그 복잡함이 사용자를 보호한다."