# Project Development Guidelines

## Critical Rules

### Port Management
- **Never start/restart servers** - User manages terminals manually
- Frontend: Port 3001 (`pnpm dev`)
- Backend: Port 3000 (`pnpm start:dev`)

### Code Comments
- Add detailed Korean comments explaining code functionality
- Focus on complex logic and business rules

## Framework Principles

### Next.js Frontend (Port 3001)
- **Required**: Functional components + React Hooks only
- **Prohibited**: Class components, direct DOM manipulation
- **State Management**: React Query (@tanstack/react-query) + Zustand
- **Styling**: Tailwind CSS only
- **Always include** `credentials: 'include'` in fetch calls

### NestJS Backend (Port 3000)
- **Required**: Class-based + Decorator pattern
- **DI Pattern**: Dependency Injection mandatory
- **Security**: bcrypt hashing, DTO validation (class-validator)
- **Module Structure**: Feature-based modules (Auth, User, Post, Blog, etc.)

## API Configuration

### Environment Variables
```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Backend (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

### API Path Rules
**Critical**: Avoid duplicate `/api/v1` in paths
```typescript
// ✅ Correct
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
fetch(`${API_URL}/blogs/my-blogs`);

// ❌ Wrong - creates /api/v1/api/v1/
fetch(`${API_URL}/api/v1/blogs/my-blogs`);
```

### API Call Pattern
```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/endpoint`,
  {
    credentials: 'include', // Required for JWT cookies
    headers: { 'Content-Type': 'application/json' },
  }
);
```

## Project Architecture

### System Overview
- Multi-user blog platform with subscription system
- **User → Blog**: 1:1 (one blog per user)
- **Blog → Posts**: 1:N (multiple posts per blog)
- **Features**: OAuth2 (Google, GitHub, Kakao), DM, Comments, Analytics, Payment (Stripe)

### Tech Stack

**Frontend (Next.js 14)**
- Framework: Next.js App Router
- State: React Query + Zustand
- Editor: Tiptap (rich text)
- UI: Tailwind CSS + Radix UI + shadcn/ui
- Auth: HttpOnly cookies

**Backend (NestJS)**
- Framework: NestJS 10
- Database: PostgreSQL + TypeORM
- Cache: Redis + ioredis
- Queue: BullMQ
- Storage: AWS S3
- Auth: JWT + Passport (OAuth2)
- Realtime: Socket.IO

### Key Routes
```
/                           # Home (all posts)
/login, /register          # Authentication
/blog/[slug]               # Blog homepage
/blog/[slug]/posts/[slug]  # Post detail
/new-story                 # Create post
/settings/*                # User settings
/dm                        # Direct messages
/admin/*                   # Admin panel
/pricing                   # Subscription plans
```

### Folder Structure

**Frontend**
```
src/
├── app/              # Next.js pages (App Router)
├── components/       # Reusable UI components
├── editor/          # Tiptap editor components
├── hooks/           # Custom React hooks
├── lib/             # Utilities & helpers
├── services/        # API service layer
├── stores/          # Zustand global state
├── types/           # TypeScript definitions
└── providers/       # Context providers
```

**Backend**
```
src/
├── auth/            # Authentication (JWT, OAuth2)
├── users/           # User management
├── blogs/           # Blog CRUD
├── posts/           # Post management
├── comments/        # Comment system
├── chat/            # Direct messaging
├── files/           # S3 file uploads
├── payment/         # Stripe integration
├── subscription/    # Subscription plans
├── email/           # Email notifications
├── cache/           # Redis caching
├── common/          # Shared utilities
└── config/          # Configuration
```

## UI Design Guidelines

### Color System
```css
/* ✅ Allowed */
Primary: bg-black, hover:bg-gray-800
Secondary: bg-gray-*, border-gray-*
Success: bg-green-*, text-green-*
Error: bg-red-*, text-red-*

/* ❌ Prohibited */
.amber-*, .orange-*, bg-amber-*, text-amber-*
```

### Form States
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- Loading: Use loading indicators
- Validation: Real-time feedback

## Security Checklist

### Frontend
- [ ] Never store tokens in localStorage (use HttpOnly cookies)
- [ ] Always include `credentials: 'include'` in API calls
- [ ] Sanitize user inputs before rendering
- [ ] Validate data client-side (secondary to backend)

### Backend
- [ ] All endpoints protected with appropriate Guards
- [ ] Input validation via DTO + class-validator
- [ ] SQL injection prevention (parameterized queries)
- [ ] Secrets in environment variables only
- [ ] Rate limiting enabled
- [ ] CORS properly configured

## Common Issues & Solutions

### 1. API 404 Errors
- Check for duplicate `/api/v1` in URL path
- Verify backend server is running on port 3000
- Confirm endpoint exists in controller

### 2. Authentication Issues
- Ensure `credentials: 'include'` in fetch calls
- Check JWT token expiration
- Verify CORS settings allow credentials

### 3. Private Blog Access
- Backend: Use `@UseGuards(OptionalJwtAuthGuard)` for owner access
- Frontend: Include `credentials: 'include'` in requests
- Ownership check: `String(user.id) === String(blog.userId)`

### 4. Timezone Issues (KST/UTC)
- Server stores in UTC
- Frontend displays in user's timezone
- Use `timestamptz` type in PostgreSQL
- Apply `TimezoneInterceptor` for consistent display

## Development Commands

```bash
# Frontend (Terminal 1)
cd frontend
pnpm dev              # Port 3001

# Backend (Terminal 2)
cd backend
pnpm start:dev        # Port 3000

# Database migrations
pnpm migration:generate
pnpm migration:run

# Type checking
pnpm type-check       # Frontend
pnpm lint            # Both
```

## Code Quality Standards

### TypeScript
- All types explicitly defined
- No `any` types (use `unknown` if needed)
- Proper error handling with try-catch

### React Components
- Functional components only
- Custom hooks for reusable logic
- Proper dependency arrays in useEffect

### API Development
- RESTful conventions
- Consistent error responses
- Proper HTTP status codes
- Request/response DTOs

### Performance
- Lazy loading for routes
- Image optimization (next/image)
- Database query optimization (avoid N+1)
- Redis caching for expensive operations
- Pagination for list endpoints

## Testing Requirements

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Security testing for auth flows

## Logging Guidelines

### Frontend Logging Rules

#### 1. Production Build Optimization
- Next.js는 프로덕션 빌드 시 `console.log`, `console.info`, `console.debug` 자동 제거
- `console.error`와 `console.warn`만 유지 (중요 에러 추적용)
- 설정: `next.config.js`의 `compiler.removeConsole` 옵션

#### 2. 민감정보 로깅 금지
```typescript
// ❌ 금지: 민감정보 직접 로깅
console.log('User logged in:', user.email, user.password);
console.log('Token:', accessToken);

// ✅ 허용: 일반 디버그 정보
console.log('Login successful');
console.log('Fetching user data...');
```

#### 3. 개발 환경 구분
```typescript
// ✅ 개발 환경에서만 로깅
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

### Backend Logging Rules

#### 1. Logger 사용 필수
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  someMethod() {
    this.logger.log('Info message');       // 일반 정보
    this.logger.debug('Debug message');    // 디버그 (개발만)
    this.logger.warn('Warning message');   // 경고
    this.logger.error('Error message', error.stack);  // 에러
  }
}
```

#### 2. console.log 사용 금지
```typescript
// ❌ 금지: console 직접 사용
console.log('User ID:', userId);

// ✅ 허용: Logger 사용
this.logger.debug('Processing request');
```

#### 3. 민감정보 보호
```typescript
// ❌ 금지: 개인정보/인증정보 로깅
this.logger.log(`User ${userId} logged in`);        // userId 노출
this.logger.log(`Token: ${accessToken}`);           // 토큰 노출
this.logger.debug(`User data: ${JSON.stringify(user)}`);  // 전체 객체

// ✅ 허용: 마스킹 또는 제거
this.logger.log('User logged in successfully');
this.logger.debug(`User ID: ${userId.substring(0, 8)}...`);  // 마스킹
this.logger.debug(`Processing request for authenticated user`);
```

#### 4. 로그 레벨 기준

**프로덕션 환경** (error, warn만 출력)
- `error`: 시스템 오류, 예외 발생
- `warn`: 잠재적 문제, 비정상 상황

**개발 환경** (모든 레벨 출력)
- `log`: 중요한 비즈니스 이벤트
- `debug`: 디버깅용 상세 정보
- `verbose`: 매우 상세한 정보

```typescript
// 프로덕션에서 출력 O
this.logger.error('Database connection failed', error.stack);
this.logger.warn('API rate limit approaching');

// 프로덕션에서 출력 X (개발에서만)
this.logger.log('User registration completed');
this.logger.debug('Cache hit for key: xyz');
this.logger.verbose('Request headers:', headers);
```

#### 5. 에러 로깅 패턴
```typescript
try {
  await this.processData();
} catch (error) {
  // ✅ 올바른 에러 로깅
  this.logger.error('Failed to process data', error.stack);
  throw error;
}
```

### 보안 체크리스트

**로깅 시 절대 금지:**
- ❌ 비밀번호 (password)
- ❌ API 키 (apiKey, api_key)
- ❌ 토큰 (accessToken, refreshToken, jwt)
- ❌ 세션 ID (sessionId)
- ❌ 민감한 개인정보 (이메일, 전화번호, 주민번호 등)
- ❌ 사용자 ID 전체 (마스킹 필수)

**로깅 가능:**
- ✅ 비즈니스 이벤트 (로그인 성공, 포스트 생성 등)
- ✅ 성능 지표 (응답 시간, 처리 건수)
- ✅ 에러 메시지 (단, 민감정보 제외)
- ✅ 마스킹된 식별자 (ID의 일부만)

---

**Last Updated**: 2025-01-21
**Project**: Multi-user Blog Platform with Subscription System
- 이 프로젝트는 개인 프로젝트가 아닌 엔터프라이즈급 saas 블로그 플랫폼이면서 mcp 를 활용한 자동블로그 시스템을 구축하기 위한 프로젝트이다. 그렇기 때문에 코드는 항상 클린하며, 여러 사용자가 사용하는만큼 최적화가 필수여야한다. 메모리 누수 방지, 클린업, 에러처리 필수.\
또한 함수형 코드, OOP 코드 작성이 적절하게 시기 적절하게 적용되어야한다.