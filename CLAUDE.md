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

---

**Last Updated**: 2025-01-10
**Project**: Multi-user Blog Platform with Subscription System
