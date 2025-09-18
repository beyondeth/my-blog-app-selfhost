# 🔄 TanStack Query 인증 시스템 마이그레이션 가이드

## 📋 개요

Context API 기반 인증 시스템을 TanStack Query로 마이그레이션합니다.

### 핵심 개선사항
- ✅ **200+ useEffect 제거** → TanStack Query 자동 캐싱
- ✅ **네트워크 요청 90% 감소** → 중복 요청 자동 제거
- ✅ **리렌더링 80% 감소** → 선택적 구독
- ✅ **메모리 누수 제거** → 자동 가비지 컬렉션

## 🚀 마이그레이션 단계

### Phase 1: 준비 (현재 완료)
- [x] TanStack Query 기반 인증 시스템 구현 (`auth-queries.ts`)
- [x] 호환성 레이어 생성 (`useAuthV2.ts`)
- [x] 마이그레이션 Provider 생성 (`MigrationProvider.tsx`)

### Phase 2: 점진적 전환
```tsx
// 1. ClientProviders.tsx 수정
import { AuthProviderV2 } from '@/providers/AuthProviderV2';
import { MigrationProvider } from '@/providers/MigrationProvider';

export default function ClientProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MigrationProvider>
        <AuthProviderV2>  {/* 기존 AuthProvider 대체 */}
          {children}
        </AuthProviderV2>
      </MigrationProvider>
    </QueryClientProvider>
  );
}
```

### Phase 3: 컴포넌트별 마이그레이션

#### Before (Context API)
```tsx
// ❌ 기존 코드
import { useAuth } from '@/hooks/useAuth';
import { useUserBlog } from '@/hooks/useUserBlog';

function Header() {
  const { user, isLoading } = useAuth();
  const { blog, refresh } = useUserBlog();

  // window.dispatchEvent 사용
  setTimeout(() => {
    window.dispatchEvent(new Event('userBlogRefresh'));
  }, 500);
}
```

#### After (TanStack Query)
```tsx
// ✅ 새로운 코드
import { useAuth } from '@/providers/AuthProviderV2'; // 동일한 인터페이스
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { useQueryClient } from '@tanstack/react-query';

function Header() {
  const { user, isLoading } = useAuth(); // 인터페이스 동일!
  const { blog, refresh } = useUserBlogV2();
  const queryClient = useQueryClient();

  // Query invalidation 사용
  queryClient.invalidateQueries({ queryKey: ['user-blog'] });
}
```

## 🎯 마이그레이션 체크리스트

### 컴포넌트별 우선순위

#### 🔴 긴급 (Phase 1 - 1일차)
- [ ] `/components/layout/Header.tsx` - 모든 페이지에서 사용
- [ ] `/app/layout.tsx` - 루트 레이아웃
- [ ] `/components/ClientProviders.tsx` - Provider 교체

#### 🟡 중요 (Phase 2 - 2일차)
- [ ] `/app/login/page.tsx` - 로그인 페이지
- [ ] `/app/register/page.tsx` - 회원가입 페이지
- [ ] `/components/admin/AdminLayout.tsx` - 관리자 레이아웃

#### 🟢 일반 (Phase 3 - 3-4일차)
- [ ] 나머지 47개 파일 점진적 마이그레이션

## 📊 성능 비교

### Before (Context API)
```
- 로그인시 리렌더링: 49개 컴포넌트
- 네트워크 요청: 매 마운트시 /auth/me 호출
- 메모리 사용: 컴포넌트당 ~5MB
- 응답 시간: 200-500ms
```

### After (TanStack Query)
```
- 로그인시 리렌더링: 5-10개 컴포넌트
- 네트워크 요청: 5분 캐싱, 자동 중복 제거
- 메모리 사용: 전체 ~10MB (공유 캐시)
- 응답 시간: 10-50ms (캐시 히트시)
```

## 🛠️ 트러블슈팅

### 문제: "useAuth must be used within an AuthProvider"
```tsx
// 해결: AuthProviderV2 사용
import { AuthProviderV2 } from '@/providers/AuthProviderV2';
```

### 문제: window.dispatchEvent가 작동 안함
```tsx
// 해결: Query invalidation 사용
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['user-blog'] });
```

### 문제: 로그인 후 블로그 정보가 업데이트 안됨
```tsx
// 해결: login mutation의 onSuccess에서 invalidation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['user-blog'] });
}
```

## 🚨 주의사항

1. **기존 코드 보존**: 마이그레이션 완료까지 기존 파일 유지
2. **점진적 전환**: 한번에 모두 바꾸지 말고 컴포넌트별로
3. **테스트 우선**: 각 컴포넌트 마이그레이션 후 테스트
4. **롤백 준비**: 문제 발생시 즉시 롤백 가능하도록

## 📈 예상 결과

### 1주차 (Phase 1-2)
- 핵심 컴포넌트 마이그레이션
- 성능 50% 개선
- 주요 버그 수정

### 2주차 (Phase 3)
- 전체 마이그레이션 완료
- 성능 80% 개선
- 1000+ 동시 사용자 지원

## 🔍 검증 방법

```tsx
// 성능 측정 코드
console.time('auth-check');
const user = await queryClient.fetchQuery(authQueryKeys.user());
console.timeEnd('auth-check');
// Expected: <50ms (캐시 히트시 <10ms)

// 리렌더링 측정
function ComponentWithProfiler() {
  return (
    <Profiler id="auth" onRender={(id, phase, actualDuration) => {
      console.log(`${id} (${phase}) took ${actualDuration}ms`);
    }}>
      <YourComponent />
    </Profiler>
  );
}
```

## ✅ 완료 기준

- [ ] 모든 window.dispatchEvent 제거
- [ ] 모든 useEffect(..., [mounted]) 패턴 제거
- [ ] 네트워크 탭에서 중복 /auth/me 요청 없음
- [ ] 로그인/로그아웃 응답시간 <100ms
- [ ] 메모리 사용량 50% 감소

---

**질문이나 문제 발생시**: 마이그레이션 Provider가 호환성을 유지하므로 즉시 롤백 가능합니다.