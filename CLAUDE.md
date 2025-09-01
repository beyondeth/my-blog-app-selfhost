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

### UI 색상 가이드라인
```css
/* ❌ 사용 금지 */
.amber-* / .orange-* / bg-amber-* / text-amber-*

/* ✅ 권장 색상 */
- Primary: bg-black, hover:bg-gray-800
- Secondary: bg-gray-*, border-gray-*
- Success: bg-green-*, text-green-*
- Error: bg-red-*, text-red-*
- Disabled: disabled:opacity-50 disabled:cursor-not-allowed
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

### 4. 비공개 블로그 접근 문제
- **문제**: 블로그 소유자도 자신의 비공개 블로그에 접근 불가
- **해결**: 
  - Backend: `@UseGuards(OptionalJwtAuthGuard)` 적용
  - Frontend: `credentials: 'include'` 추가
  - 소유자 확인: `String(user.id) === String(blog.userId)`

### 5. API 키 시간대 문제 (9시간 차이)
- **문제**: 방금 생성한 API 키가 "9시간 전"으로 표시
- **원인**: 서버가 UTC로 저장, 클라이언트가 KST로 표시
- **해결**:
  1. `TimezoneInterceptor` 생성 및 적용
  2. `process.env.TZ = 'Asia/Seoul'` 설정
  3. Entity에 `timestamptz` 타입 사용

### 6. 댓글 섹션 깜빡임 문제
- **문제**: 댓글 비활성화된 포스트에서 댓글 섹션이 잠깐 보였다가 사라짐
- **해결**: 조건문 수정
  ```javascript
  // ❌ 잘못된 조건
  {blog?.allowComments !== false && ...}
  
  // ✅ 올바른 조건  
  {blog && blog.allowComments === true && ...}
  ```

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

## 📅 최근 작업 내역 (2025-09-01)

### 🔐 Private 블로그 접근 권한 개선
1. **OptionalJwtAuthGuard 패턴**
   ```typescript
   // blogs.controller.ts
   @Get('slug/:slug')
   @Public()
   @UseGuards(OptionalJwtAuthGuard)  // 인증 선택적 적용
   async findOneBySlug(@Param('slug') slug: string, @CurrentUser() user?: User) {
     // 비공개 블로그도 소유자는 접근 가능
   }
   ```
   - 공개 엔드포인트에서도 인증 정보 활용 가능
   - 비공개 블로그 소유자 확인: `String(user.id) === String(blog.userId)`

2. **프론트엔드 인증 쿠키 전달**
   ```javascript
   // 반드시 credentials: 'include' 추가
   fetch(`${API_URL}/blogs/slug/${slug}`, {
     credentials: 'include'  // 중요!
   });
   ```

### ⏰ API 키 시간대 문제 해결
1. **TimezoneInterceptor 구현**
   - UTC → KST 자동 변환 (+9시간)
   - `createdAt`, `updatedAt` 등 날짜 필드 자동 처리
   - Controller에 `@UseInterceptors(TimezoneInterceptor)` 적용

2. **서버 타임존 설정**
   ```typescript
   // main.ts
   process.env.TZ = 'Asia/Seoul';
   ```

3. **Entity 타임스탬프 타입**
   ```typescript
   @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
   createdAt: Date;
   ```

### 🔑 API 키 관리 개선
- **개수 제한**: 사용자당 최대 3개
- **UI 단순화**: 설명 필드 제거, 이름만 필수
- **로딩 상태**: 생성 중 버튼 비활성화 및 스피너 표시
- **시간 표시**: 24시간 이내는 상대 시간, 이후는 절대 시간

### 🎨 UI/UX 표준화
1. **색상 체계 변경**
   - ❌ Amber/Orange 색상 사용 금지
   - ✅ Black/Gray 색상 체계 사용
   - 버튼: `bg-black hover:bg-gray-800`
   - 비활성화: `disabled:opacity-50`

2. **컴포넌트 표준**
   - 알림 아이콘: `h-6 w-6` (기존 h-5 w-5에서 변경)
   - 툴팁: Followers만 표시 (Following 제거)
   - 댓글 섹션: `blog && blog.allowComments === true` 조건 사용

### 🌐 RDS 연결 상태
- **호스트**: `myblog.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com`
- **데이터베이스**: `blog-db`
- **마이그레이션**: 최신 상태 (AddBlogPublicFields1756641791150)