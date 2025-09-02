# OAuth Identity Management 개선 가이드

## 📅 작성일: 2025-09-02
## 👤 작성자: Claude Code Assistant
## 🎯 목적: 동일 이메일 다중 OAuth Provider 처리 문제 해결

---

## 🚨 현재 구현의 치명적 문제

### 문제 상황
```
사용자 시나리오:
1. user@example.com이 Google로 가입 → authProvider: 'google'
2. 같은 이메일로 Kakao 로그인 시도 → authProvider: 'kakao'로 덮어씀 ⚠️
3. 다시 Google로 로그인 → authProvider: 'google'로 다시 덮어씀 ⚠️
```

### 보안 취약점
1. **Account Takeover**: 공격자가 피해자 이메일로 OAuth 계정을 만들어 계정 탈취 가능
2. **Identity 손실**: 이전 OAuth 연결 정보가 덮어써짐
3. **일관성 없는 UX**: 사용자가 어떤 방법으로 로그인해야 하는지 혼란

---

## ✅ 권장 솔루션: Multi-Identity Architecture

### 1. 데이터베이스 스키마 변경

#### 1.1 새로운 Identities 테이블 생성
```sql
-- Migration: CreateUserIdentitiesTable
CREATE TABLE user_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  provider_data JSONB, -- 추가 프로필 정보
  linked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_provider ON user_identities(provider);
```

#### 1.2 Users 테이블 수정
```sql
-- Migration: UpdateUsersTableForMultiIdentity
ALTER TABLE users 
ADD COLUMN primary_identity_id UUID REFERENCES user_identities(id),
ADD COLUMN last_login_provider VARCHAR(50);

-- 기존 authProvider, providerId는 단계적으로 제거
```

### 2. Backend 구현

#### 2.1 Identity Entity 생성
```typescript
// backend/src/users/entities/user-identity.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { AuthProvider } from '../../auth/enums/auth-provider.enum';

@Entity('user_identities')
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.identities, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ name: 'provider_email', nullable: true })
  providerEmail: string;

  @Column({ type: 'jsonb', name: 'provider_data', nullable: true })
  providerData: any;

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt: Date;
}
```

#### 2.2 Identity Service 구현
```typescript
// backend/src/users/services/identity.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIdentity } from '../entities/user-identity.entity';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(UserIdentity)
    private identityRepository: Repository<UserIdentity>,
  ) {}

  async findByProviderId(providerId: string, provider: string): Promise<UserIdentity | null> {
    return this.identityRepository.findOne({
      where: { providerId, provider },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<UserIdentity[]> {
    return this.identityRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });
  }

  async linkIdentity(userId: string, data: {
    provider: string;
    providerId: string;
    email?: string;
    providerData?: any;
  }): Promise<UserIdentity> {
    // 중복 체크
    const existing = await this.findByProviderId(data.providerId, data.provider);
    if (existing && existing.userId !== userId) {
      throw new ConflictException('이 계정은 이미 다른 사용자에게 연결되어 있습니다');
    }

    if (existing && existing.userId === userId) {
      // 이미 연결되어 있으면 last_used_at만 업데이트
      existing.lastUsedAt = new Date();
      return this.identityRepository.save(existing);
    }

    // 새로운 identity 생성
    const identity = this.identityRepository.create({
      userId,
      provider: data.provider,
      providerId: data.providerId,
      providerEmail: data.email,
      providerData: data.providerData,
      lastUsedAt: new Date(),
    });

    return this.identityRepository.save(identity);
  }

  async unlinkIdentity(userId: string, identityId: string): Promise<void> {
    // 마지막 identity는 삭제 불가
    const identities = await this.findByUserId(userId);
    if (identities.length <= 1) {
      throw new ConflictException('마지막 로그인 방법은 삭제할 수 없습니다');
    }

    await this.identityRepository.delete({ id: identityId, userId });
  }
}
```

#### 2.3 Auth Service 개선
```typescript
// backend/src/auth/auth.service.ts
async validateOAuthUser(profile: any, provider: AuthProvider): Promise<AuthResponse> {
  const email = profile.emails?.[0]?.value;
  
  // 1. Provider ID로 기존 identity 찾기
  let identity = await this.identityService.findByProviderId(
    profile.id,
    provider
  );

  if (identity) {
    // 기존 identity로 로그인
    await this.identityService.updateLastUsed(identity.id);
    await this.usersService.updateLastLogin(identity.userId, provider);
    
    const user = await this.usersService.findById(identity.userId);
    return this.generateTokenResponse(user);
  }

  // 2. 이메일로 기존 사용자 찾기
  if (!email) {
    throw new BadRequestException(`${provider}에서 이메일을 가져올 수 없습니다`);
  }

  const existingUser = await this.usersService.findByEmail(email);

  if (existingUser) {
    // 3. 이메일 인증 상태 확인
    if (existingUser.isEmailVerified || this.isTrustedProvider(provider)) {
      // 신뢰할 수 있는 provider거나 이메일 인증된 사용자는 자동 링킹
      await this.identityService.linkIdentity(existingUser.id, {
        provider,
        providerId: profile.id,
        email,
        providerData: {
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
        }
      });

      // 보안 알림 이메일
      await this.emailService.sendSecurityNotification(
        email,
        `새로운 로그인 방법 추가: ${provider}`,
        {
          provider,
          timestamp: new Date(),
          ipAddress: this.getClientIp(),
        }
      );

      await this.usersService.updateLastLogin(existingUser.id, provider);
      return this.generateTokenResponse(existingUser);
    } else {
      // 미인증 사용자는 수동 확인 필요
      throw new ConflictException({
        code: 'MANUAL_LINK_REQUIRED',
        message: '이 이메일은 이미 등록되어 있습니다. 기존 방법으로 로그인 후 계정을 연결해주세요.',
        existingProvider: existingUser.primary_auth_provider || 'local'
      });
    }
  }

  // 4. 새 사용자 생성
  const newUser = await this.usersService.create({
    email,
    username: this.generateUsername(email),
    isEmailVerified: true, // OAuth는 이메일 검증됨
  });

  // Identity 생성
  const newIdentity = await this.identityService.linkIdentity(newUser.id, {
    provider,
    providerId: profile.id,
    email,
    providerData: {
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
    }
  });

  // Primary identity 설정
  await this.usersService.setPrimaryIdentity(newUser.id, newIdentity.id);

  // 블로그 자동 생성
  await this.createUserBlog(newUser);

  return this.generateTokenResponse(newUser);
}

private isTrustedProvider(provider: string): boolean {
  // Google, GitHub는 이메일 검증을 보장
  return ['google', 'github'].includes(provider.toLowerCase());
}
```

### 3. Frontend 구현

#### 3.1 계정 설정 페이지
```tsx
// frontend/src/app/settings/security/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface LinkedIdentity {
  id: string;
  provider: string;
  providerEmail: string;
  linkedAt: string;
  lastUsedAt: string;
}

export default function SecuritySettings() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIdentities();
  }, []);

  const fetchIdentities = async () => {
    const res = await fetch('/api/v1/users/identities', {
      credentials: 'include'
    });
    const data = await res.json();
    setIdentities(data);
  };

  const linkProvider = (provider: string) => {
    window.location.href = `/api/v1/auth/${provider}?action=link`;
  };

  const unlinkProvider = async (identityId: string) => {
    if (!confirm('정말로 이 로그인 방법을 제거하시겠습니까?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/users/identities/${identityId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        await fetchIdentities();
        alert('로그인 방법이 제거되었습니다.');
      } else {
        const error = await res.json();
        alert(error.message || '제거에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch(provider) {
      case 'google':
        return '🔍';
      case 'kakao':
        return '💬';
      case 'github':
        return '🐙';
      case 'naver':
        return '🍀';
      default:
        return '🔑';
    }
  };

  const availableProviders = ['google', 'kakao', 'github', 'naver'];
  const linkedProviders = identities.map(i => i.provider);
  const unlinkedProviders = availableProviders.filter(p => !linkedProviders.includes(p));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">보안 설정</h1>

      {/* 연결된 로그인 방법 */}
      <div className="bg-white rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">연결된 로그인 방법</h2>
        
        <div className="space-y-3">
          {identities.map((identity) => (
            <div key={identity.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getProviderIcon(identity.provider)}</span>
                <div>
                  <div className="font-medium capitalize">{identity.provider}</div>
                  <div className="text-sm text-gray-500">{identity.providerEmail}</div>
                  <div className="text-xs text-gray-400">
                    마지막 사용: {new Date(identity.lastUsedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              {identities.length > 1 && (
                <button
                  onClick={() => unlinkProvider(identity.id)}
                  disabled={loading}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded transition"
                >
                  연결 해제
                </button>
              )}
            </div>
          ))}
        </div>

        {identities.length === 1 && (
          <p className="text-sm text-gray-500 mt-4">
            ⚠️ 최소 하나의 로그인 방법은 유지해야 합니다.
          </p>
        )}
      </div>

      {/* 추가 가능한 로그인 방법 */}
      {unlinkedProviders.length > 0 && (
        <div className="bg-white rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">로그인 방법 추가</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {unlinkedProviders.map((provider) => (
              <button
                key={provider}
                onClick={() => linkProvider(provider)}
                className="flex items-center justify-center space-x-2 p-3 border rounded hover:bg-gray-50 transition"
              >
                <span className="text-xl">{getProviderIcon(provider)}</span>
                <span className="capitalize">{provider} 연결</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 3.2 로그인 페이지 개선
```tsx
// frontend/src/app/login/page.tsx
const handleOAuthError = (error: any) => {
  if (error.code === 'MANUAL_LINK_REQUIRED') {
    setError({
      type: 'account_exists',
      message: error.message,
      provider: error.existingProvider
    });
  } else {
    setError({
      type: 'general',
      message: '로그인에 실패했습니다.'
    });
  }
};

// 에러 표시 UI
{error?.type === 'account_exists' && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
    <p className="text-sm text-yellow-800 mb-2">{error.message}</p>
    <button 
      onClick={() => loginWith(error.provider)}
      className="text-yellow-900 font-semibold underline"
    >
      {error.provider}로 로그인하기 →
    </button>
  </div>
)}
```

### 4. 보안 고려사항

#### 4.1 Trust Levels
```typescript
enum TrustLevel {
  HIGH = 'high',    // Google, GitHub (이메일 검증 보장)
  MEDIUM = 'medium', // Kakao, Naver (대부분 검증됨)
  LOW = 'low'       // Custom OAuth (검증 불확실)
}

const PROVIDER_TRUST_LEVELS = {
  google: TrustLevel.HIGH,
  github: TrustLevel.HIGH,
  kakao: TrustLevel.MEDIUM,
  naver: TrustLevel.MEDIUM,
};

// 자동 링킹 정책
const canAutoLink = (provider: string, user: User): boolean => {
  const trustLevel = PROVIDER_TRUST_LEVELS[provider];
  
  if (trustLevel === TrustLevel.HIGH) {
    return true; // 항상 허용
  }
  
  if (trustLevel === TrustLevel.MEDIUM && user.isEmailVerified) {
    return true; // 이메일 검증된 사용자만
  }
  
  return false; // 수동 링킹 필요
};
```

#### 4.2 Rate Limiting
```typescript
// 계정 연결 시도 제한
@UseGuards(RateLimitGuard)
@RateLimit({ points: 5, duration: 3600 }) // 시간당 5회
async linkIdentity() { }
```

#### 4.3 Audit Logging
```typescript
// 모든 identity 변경사항 기록
interface IdentityAuditLog {
  userId: string;
  action: 'linked' | 'unlinked' | 'login';
  provider: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

### 5. 마이그레이션 전략

#### 5.1 기존 데이터 마이그레이션
```sql
-- Migration: MigrateExistingOAuthUsers
INSERT INTO user_identities (user_id, provider, provider_id, provider_email, linked_at)
SELECT 
  id as user_id,
  authProvider as provider,
  providerId as provider_id,
  email as provider_email,
  created_at as linked_at
FROM users
WHERE authProvider != 'local' AND providerId IS NOT NULL;
```

#### 5.2 단계적 롤아웃
```typescript
// Feature Flag를 통한 점진적 활성화
const useMultiIdentity = () => {
  const featureFlags = useFeatureFlags();
  return featureFlags.multiIdentity || process.env.NODE_ENV === 'development';
};

// 기존 코드와 새 코드 병행
if (useMultiIdentity()) {
  return await this.validateOAuthUserMultiIdentity(profile, provider);
} else {
  return await this.validateOAuthUserLegacy(profile, provider);
}
```

### 6. 모니터링 및 메트릭

```typescript
// 추적해야 할 메트릭
interface IdentityMetrics {
  totalUsers: number;
  usersWithMultipleIdentities: number;
  averageIdentitiesPerUser: number;
  linkingAttempts: number;
  linkingFailures: number;
  unlinkingAttempts: number;
  providerDistribution: Record<string, number>;
}

// Prometheus 메트릭 예시
identity_linking_total{provider="google",status="success"} 142
identity_linking_total{provider="kakao",status="failed"} 8
users_with_multiple_identities_total 87
```

---

## 📋 구현 체크리스트

### Phase 1: 기반 구축 (1-2일)
- [ ] user_identities 테이블 생성
- [ ] UserIdentity Entity 구현
- [ ] IdentityService 구현
- [ ] 기존 데이터 마이그레이션 스크립트

### Phase 2: 백엔드 통합 (2-3일)
- [ ] Auth Service 개선
- [ ] Trust Level 시스템 구현
- [ ] Rate Limiting 추가
- [ ] Audit Logging 구현

### Phase 3: 프론트엔드 (2-3일)
- [ ] 계정 설정 페이지 구현
- [ ] 로그인 에러 처리 개선
- [ ] Identity 관리 UI 구현
- [ ] 보안 알림 표시

### Phase 4: 테스트 및 배포 (2일)
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 시나리오
- [ ] Feature Flag 설정
- [ ] 단계적 롤아웃 계획

### Phase 5: 모니터링 (지속)
- [ ] 메트릭 수집 설정
- [ ] 알림 규칙 구성
- [ ] 대시보드 구축
- [ ] 사용자 피드백 수집

---

## 🎯 예상 결과

### 사용자 경험 개선
- ✅ 어떤 OAuth 방법으로든 로그인 가능
- ✅ 계정 보안 강화
- ✅ 명확한 identity 관리

### 보안 강화
- ✅ Account takeover 방지
- ✅ 감사 추적 가능
- ✅ 세분화된 접근 제어

### 운영 이점
- ✅ 사용자 행동 패턴 분석
- ✅ 문제 발생 시 빠른 대응
- ✅ 유연한 인증 정책

---

## 📚 참고 자료

- [Firebase Account Linking](https://firebase.google.com/docs/auth/web/account-linking)
- [Supabase Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Auth0 Account Linking](https://auth0.com/docs/users/user-account-linking)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**작성 완료: 2025-09-02**
**다음 검토: Multi-Identity 구현 완료 후**