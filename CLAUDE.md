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

## 🔒 Vibe Coding Security Guidelines

### Critical Security Risks in AI-Generated Code

**Statistics**: ~40-45% of AI-generated code contains security vulnerabilities

### Common Vulnerabilities to Review

#### Frontend Security
1. **Insecure HTTP Connections**
   - Always enforce HTTPS with proper TLS/SSL
   - Add security headers (HSTS, CSP)
   - Never transmit sensitive data over HTTP

2. **XSS (Cross-Site Scripting)**
   - Validate and sanitize ALL user inputs
   - Use parameterized queries, never concatenate
   - Escape output when rendering user content

3. **Insecure Client Storage**
   - NEVER store JWT/tokens in localStorage
   - Use HttpOnly cookies for sensitive data
   - Assume all client-side storage is accessible

#### Backend Security
1. **Authentication & Authorization**
   - Never implement auth checks client-side only
   - Use modern hashing (Argon2id, bcrypt)
   - Implement proper RBAC server-side
   - Never store passwords in plain text

2. **SQL Injection**
   - Always use parameterized queries
   - Never concatenate user input into SQL
   - Validate and sanitize all inputs

3. **Secret Management**
   - NEVER hardcode credentials in source
   - Use environment variables
   - Implement proper secret rotation

### Security Checklist for AI Code
- [ ] Review all authentication/authorization logic
- [ ] Check for input validation on ALL user inputs  
- [ ] Verify HTTPS enforcement
- [ ] Audit data storage methods (especially tokens)
- [ ] Review database query construction
- [ ] Check for hardcoded secrets
- [ ] Test for injection vulnerabilities
- [ ] Verify error handling doesn't leak info

### Red Flags in AI Code
- Generic variable names without context
- Excessive comments explaining basic logic
- Missing error handling
- Outdated or vulnerable dependencies
- Client-side only validation/auth

**Remember**: AI can generate functional code quickly but often misses critical security considerations. Always review and test thoroughly.

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

---

## 📅 최근 작업 내역 (2025-08-22)

### Admin Dashboard UI 개선
1. **통계 카드 정렬 개선**
   - 전체 신고 카드: "처리완료 / 전체" 형식으로 변경
   - 처리 완료 퍼센트 표시 (초록색)
   - 모든 카드의 검색창 위치 통일
   - 검색창과 퍼센트 사이 여백 증가 (mt-3)

2. **차트 개선**
   - 주간 동향: 범례를 좌측 상단으로 이동, 툴바와 겹침 해결
   - 사용자 분포: 3D 효과 추가 (그라데이션, 드롭쉐도우, 중앙에 실제 전체 사용자 수 표시)
   - 성능 메트릭: 사용자 활성도 표시 (DAU/MAU 비율)

3. **UI 디테일**
   - Admin Panel 아이콘: Shield에 fill-indigo-200 + shimmer 애니메이션 추가
   - 인기 포스트 카드: 고정 높이(h-32) + flexbox로 하단 정보 고정
   - 사이드바 타이틀: "관리자 패널" → "Admin Panel"로 변경

4. **데이터 검증**
   - DAU/MAU: lastLoginAt 필드 기반으로 정확히 계산
   - 통계 정확성: 포스트/사용자 평균 9.4, 댓글/포스트 평균 0.6 확인