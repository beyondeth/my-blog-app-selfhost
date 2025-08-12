# CLAUDE.md - 프로젝트 규칙 및 주의사항

## 🚨 중요한 API 경로 규칙

### ❌ 자주 발생하는 실수: API 경로 중복

**문제 상황:**
```javascript
// ❌ 잘못된 예시 - /api/v1이 중복됨
const API_URL = process.env.NEXT_PUBLIC_API_URL; // 이미 "http://localhost:3000/api/v1" 포함
fetch(`${API_URL}/api/v1/blogs/my-blogs`); // 결과: /api/v1/api/v1/blogs/my-blogs
```

**올바른 사용법:**
```javascript
// ✅ 올바른 예시
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
fetch(`${API_URL}/blogs/my-blogs`); // 결과: /api/v1/blogs/my-blogs
```

### 📋 체크리스트
1. **환경 변수 확인**: `NEXT_PUBLIC_API_URL`이 이미 `/api/v1`을 포함하는지 확인
2. **fetch 호출 시**: API_URL 뒤에 바로 엔드포인트 경로 추가 (추가 `/api/v1` 없이)
3. **기본값 설정**: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'`

### 🔍 디버깅 팁
404 에러 발생 시 네트워크 탭에서 실제 요청 URL 확인:
- `/api/v1/api/v1/...` 형태면 중복 문제
- 정상: `http://localhost:3000/api/v1/blogs/...`
- 비정상: `http://localhost:3000/api/v1/api/v1/blogs/...`

---

## 🏗️ 프로젝트 구조

### Multi-User Blog System
- **User-Blog 관계**: 1:1 (한 사용자당 하나의 블로그만)
- **Blog-Post 관계**: 1:N (한 블로그에 여러 포스트)
- **권한**: 
  - 블로그 생성: 로그인한 사용자, 1회만
  - 포스트 작성: 자신의 블로그에서만
  - 포스트 수정/삭제: 작성자 본인만

### 주요 URL 구조
```
/                                  # 홈 (모든 블로그 포스트)
/blog/new                         # 블로그 생성
/blog/[blogSlug]                  # 특정 블로그 홈
/blog/[blogSlug]/posts/new        # 블로그에 포스트 작성
/blog/[blogSlug]/posts/[postSlug] # 포스트 보기
```

---

## 🔧 개발 환경

### 프론트엔드
- **Framework**: Next.js 14 (App Router)
- **상태 관리**: React Query (TanStack Query)
- **스타일링**: Tailwind CSS
- **인증**: Cookie 기반 (HttpOnly)

### 백엔드
- **Framework**: NestJS
- **Database**: PostgreSQL + TypeORM
- **인증**: JWT (HttpOnly Cookie)
- **API Prefix**: `/api/v1`

### 환경 변수
```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Backend (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

---

## 📝 코딩 컨벤션

### API 호출 패턴
```typescript
// 항상 이 패턴 사용
const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/endpoint`,
  {
    credentials: 'include', // Cookie 인증 필수
    headers: {
      'Content-Type': 'application/json',
    },
  }
);
```

### 에러 처리
```typescript
if (!response.ok) {
  if (response.status === 404) {
    // 특정 에러 처리
  }
  throw new Error('API call failed');
}
```

---

## 🐛 일반적인 문제 해결

### 1. API 404 에러
- URL 경로 중복 확인 (`/api/v1/api/v1/...`)
- 백엔드 서버 실행 확인
- 엔드포인트 존재 여부 확인

### 2. 인증 문제
- Cookie 설정 확인 (`credentials: 'include'`)
- JWT 토큰 만료 확인
- CORS 설정 확인

### 3. 블로그 생성 실패
- 사용자당 1개 블로그 제한 확인
- Slug 중복 확인
- 필수 필드 확인 (name, slug)

---

## 🚀 개발 서버 실행

```bash
# Backend (포트 3000)
cd backend
pnpm start:dev

# Frontend (포트 3001)
cd frontend
pnpm dev
```

---

## 📚 추가 문서
- [Multi-User Blog Implementation](./MULTI_USER_BLOG_IMPLEMENTATION.md)
- [Blog System Design](./BLOG_SYSTEM_DESIGN.md)