---
title: "NestJS에서 비공개 블로그 접근 권한 문제 해결하기: @Public() 데코레이터의 함정"
tags: ["NestJS", "JWT", "Authentication", "Authorization", "Troubleshooting", "Backend", "TypeScript", "Security", "Debugging"]
date: 2025-08-31T23:17:25.523116
---

# NestJS에서 비공개 블로그 접근 권한 문제 해결하기: @Public() 데코레이터의 함정

## 🤬 문제 상황

블로그를 비공개로 설정했는데, **내가 블로그 주인인데도 내 글을 볼 수 없는** 황당한 상황이 발생했다.

```
http://localhost:3001/posts/123-c05c89e5
→ "비공개 블로그입니다" 
→ 나는 주인인데??? 왜 못 보는거지???
```

분명히 로그인도 했고, 내 블로그고, 내가 쓴 글인데 접근이 안 되는 상황. 정말 답답했다.

## 🔍 문제의 원인

### 1. JWT 인증 토큰은 정상적으로 전달되고 있었다

```javascript
// Frontend - 쿠키로 JWT 전송 ✅
axios.create({
  withCredentials: true, // 쿠키 전송 활성화
});

// Backend - 쿠키에서 JWT 추출 ✅
res.cookie('access_token', authResponse.access_token, {
  httpOnly: true,
  maxAge: 15 * 60 * 1000, // 15분
});
```

### 2. 진짜 문제: @Public() 데코레이터의 함정

```typescript
// ❌ 문제가 되는 코드
@Get('slug/:slug')
@Public()  // 이게 문제! JWT 인증을 완전히 무시함
@ApiOperation({ summary: 'Slug로 게시글 조회' })
findBySlug(@Param('slug') slug: string, @Request() req: any) {
  const user = req.user || null;  // 항상 null이 됨!
  return this.postsService.findBySlug(slug, user);
}
```

**`@Public()` 데코레이터는 인증을 완전히 건너뛴다!**
- JWT 토큰이 있어도 무시
- `req.user`는 항상 `undefined`
- 결과: 로그인 여부와 상관없이 항상 비로그인 상태로 처리

### 3. 서비스 로직은 정상이었다

```typescript
// PostsService - 로직은 완벽했음
if (!post.blog.isPublic) {
  // 블로그 소유자 또는 포스트 작성자인 경우 접근 허용
  const isOwner = user && (
    String(user.id) === String(post.blog.userId) || 
    String(user.id) === String(post.author?.id)
  );
  
  if (!isOwner) {
    return { isPrivate: true, message: '비공개 블로그입니다' };
  }
}
```

하지만 `user`가 항상 `null`이라서 소용없었다.

## ✅ 해결 방법

### 1. OptionalJwtAuthGuard 생성

```typescript
// src/common/guards/optional-jwt-auth.guard.ts
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // 인증 실패해도 에러 안 던짐
    // 로그인 안 했으면 null, 했으면 user 객체 반환
    if (err || !user) {
      return null;
    }
    return user;
  }
}
```

### 2. 컨트롤러 수정

```typescript
// ✅ 수정된 코드
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

@Get('slug/:slug')
@Public()
@UseGuards(OptionalJwtAuthGuard)  // 핵심! 선택적 인증 확인
@ApiOperation({ summary: 'Slug로 게시글 조회' })
findBySlug(@Param('slug') slug: string, @Request() req: any) {
  const user = req.user || null;  // 이제 로그인했으면 user 정보가 있음!
  return this.postsService.findBySlug(slug, user);
}
```

## 🎯 핵심 정리

### @Public() vs OptionalJwtAuthGuard

| 구분 | @Public()만 사용 | @Public() + OptionalJwtAuthGuard |
|------|-----------------|-----------------------------------|
| 비로그인 접근 | ✅ 가능 | ✅ 가능 |
| 로그인 사용자 인식 | ❌ 불가능 | ✅ 가능 |
| req.user | 항상 undefined | 로그인 시 user 객체 |
| 사용 케이스 | 완전 공개 API | 선택적 인증이 필요한 API |

### 언제 어떤 걸 써야 할까?

1. **@Public()만**: 로그인 여부가 전혀 상관없는 완전 공개 API
   - 예: 공개 블로그 목록, 이용약관 페이지

2. **@Public() + OptionalJwtAuthGuard**: 비로그인도 접근 가능하지만, 로그인 시 추가 기능이 있는 API
   - 예: 블로그 글 조회 (비공개 블로그는 주인만)
   - 예: 좋아요 기능 (로그인 시에만 가능)

3. **@UseGuards(JwtAuthGuard)**: 반드시 로그인이 필요한 API
   - 예: 글 작성, 수정, 삭제

## 🤦 삽질 포인트

1. **JWT 토큰 디버깅에 시간 낭비**
   - 토큰 생성, 쿠키 전송, JWT Strategy 모두 정상이었음
   - 문제는 단순히 Guard를 안 써서였음

2. **두 개의 비슷한 유저명으로 인한 혼란**
   - `luticek` vs `luticek88` 
   - 다른 사용자인데 착각함

3. **@Public() 데코레이터의 동작 방식 오해**
   - "공개 API = 인증 체크 안 함"이 아니라
   - "공개 API = 인증 필수는 아니지만 확인은 해야 함"

## 💡 교훈

1. **데코레이터의 정확한 동작을 이해하자**
   - @Public()은 인증을 완전히 무시한다
   - 선택적 인증이 필요하면 OptionalJwtAuthGuard를 추가해야 한다

2. **로그를 제대로 활용하자**
   - `console.log('[OptionalJwtAuthGuard] User:', user?.id)`
   - 이 한 줄이 문제를 바로 보여줬다

3. **간단한 문제일수록 기본을 확인하자**
   - 복잡한 JWT 로직을 의심하기 전에
   - 단순히 Guard를 적용했는지 확인

## 🚀 결론

비공개 블로그 기능을 구현할 때는:
1. 반드시 `OptionalJwtAuthGuard` 사용
2. `@Public()` 데코레이터와 함께 사용
3. 서비스에서 `user` 객체로 권한 확인

이제 비공개 블로그도 주인은 볼 수 있다! 🎉

---

*이 글은 실제 디버깅 과정에서 겪은 경험을 바탕으로 작성되었습니다.*