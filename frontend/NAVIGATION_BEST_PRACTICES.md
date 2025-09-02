# 🧭 Navigation Best Practices Guide

## window.location.href vs window.location.replace()

### 📊 비교표

| 구분 | `location.href` | `location.replace()` |
|------|----------------|---------------------|
| **히스토리** | 새 항목 추가 | 현재 항목 대체 |
| **뒤로가기** | 이전 페이지로 가능 | 이전 페이지로 불가능 |
| **사용 시기** | 일반 네비게이션 | 리디렉션, 인증 후 |

### 🎯 사용 시나리오

#### ✅ `window.location.replace()` 사용해야 할 때

1. **OAuth 로그인**
```javascript
// 로그인 페이지를 히스토리에 남기지 않음
window.location.replace(`${API_URL}/auth/google`);
```

2. **로그아웃 후 리디렉션**
```javascript
// 로그아웃 후 홈으로 이동 (뒤로가기로 다시 로그인 상태가 되면 안됨)
logout();
window.location.replace('/');
```

3. **권한 없는 페이지 접근 시**
```javascript
// 401/403 에러 시 로그인 페이지로
if (error.status === 401) {
  window.location.replace('/login');
}
```

4. **일회성 페이지 (결제 완료, 회원가입 완료)**
```javascript
// 결제 완료 페이지는 새로고침/뒤로가기로 재접근 방지
window.location.replace('/payment/success');
```

#### ✅ `window.location.href` 사용해야 할 때

1. **일반 네비게이션**
```javascript
// 사용자가 뒤로가기로 돌아올 수 있어야 함
window.location.href = '/products';
```

2. **외부 링크**
```javascript
// 외부 사이트로 이동
window.location.href = 'https://example.com';
```

3. **새 탭에서 열기**
```javascript
// 새 창/탭에서 열기
window.open(url, '_blank');
```

### 🚀 개선된 구현 예시

#### Before (문제점)
```javascript
// ❌ 로그인 페이지가 히스토리에 남음
onClick={() => window.location.href = 'http://localhost:3000/api/v1/auth/google'}

// 문제: 로그인 후 뒤로가기 → 로그인 페이지 → 또 로그인 시도 → 에러
```

#### After (개선됨)
```javascript
// ✅ 로그인 페이지를 히스토리에서 대체
onClick={() => window.location.replace(`${API_URL}/auth/google`)}

// 장점: 로그인 후 뒤로가기 → 로그인 전 원래 페이지로 바로 이동
```

### 🔧 유틸리티 함수 활용

```javascript
import { navigateTo, shouldUseReplace } from '@/utils/navigation';

// 자동으로 적절한 메서드 선택
navigateTo('/login', { 
  replace: shouldUseReplace('login') // true
});

navigateTo('/products', { 
  replace: shouldUseReplace('navigation') // false
});

// OAuth 로그인
navigateTo(`${API_URL}/auth/google`, { 
  external: true,
  replace: true  // 히스토리 대체
});
```

### 📱 React/Next.js에서의 Best Practice

#### 1. **Next.js Router 우선 사용**
```javascript
import { useRouter } from 'next/navigation';

const router = useRouter();

// 권장: Next.js router 사용
router.push('/settings');      // 히스토리 추가
router.replace('/login');       // 히스토리 대체
```

#### 2. **window.location은 필요할 때만**
```javascript
// OAuth 리디렉션 (외부 URL)
window.location.replace(oauthUrl);

// 완전한 페이지 새로고침이 필요할 때
window.location.reload();
```

### 🎨 UX 고려사항

#### 좋은 UX
- ✅ 로그인 후 → 원래 보던 페이지로 복귀
- ✅ 결제 완료 → 뒤로가기로 재결제 방지
- ✅ 권한 없음 → 로그인 → 원래 요청한 페이지로

#### 나쁜 UX
- ❌ 로그인 후 → 뒤로가기 → 다시 로그인 페이지
- ❌ 결제 완료 → 뒤로가기 → 중복 결제 시도
- ❌ 무한 리디렉션 루프

### 🔍 디버깅 팁

```javascript
// 현재 히스토리 상태 확인
console.log('History Length:', window.history.length);
console.log('Current State:', window.history.state);

// 네비게이션 이벤트 감지
window.addEventListener('popstate', (event) => {
  console.log('Navigation:', event.state);
});
```

### 📋 체크리스트

- [ ] OAuth 로그인은 `replace()` 사용
- [ ] 로그아웃 후 리디렉션은 `replace()` 사용
- [ ] 일반 페이지 이동은 `router.push()` 또는 `href` 사용
- [ ] 권한 체크 실패 시 `replace()` 사용
- [ ] 일회성 페이지는 `replace()` 사용
- [ ] 외부 URL은 상황에 따라 선택

---

*Last Updated: 2025-01-02*