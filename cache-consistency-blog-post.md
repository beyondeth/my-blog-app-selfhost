# 실시간 블로그 포스팅의 캐시 일관성 문제: 2000시간 삽질기

## 🔥 문제 상황

MCP 블로그로 자동포스팅을 진행하면, 새로 생성한 포스트가 내 블로그나 홈 화면에 바로 나타나지 않는 문제. 어떨 때는 바로 나타나고, 어떨 때는 몇 분 후에 나타나는 일관성 없는 동작.

## 🔍 현재 캐시 아키텍처 분석

### 📊 3단계 캐시 레이어

#### 1️⃣ **프론트엔드 (React Query)**
```javascript
const commonQueryOptions = {
  staleTime: 30 * 1000,    // 30초간 fresh 상태
  gcTime: 10 * 60 * 1000,   // 10분간 메모리 보관
  refetchOnWindowFocus: true // 탭 전환 시 자동 갱신
};
```

#### 2️⃣ **백엔드 (Redis)**
```javascript
// MCP 포스트 생성 시
await this.cacheService.delete('feed:main:p1');
await this.cacheService.set('feed:main:p1', freshData, 600); // 10분 TTL
```

#### 3️⃣ **API 응답 헤더**
- Cache-Control 헤더 없음 → 브라우저 캐싱 정책 불명확

## 🚨 근본 원인

### **핵심: 백엔드는 완벽, 프론트엔드가 문제**

백엔드 Redis는 즉시 갱신되지만, 프론트엔드 React Query가 30초간 stale 데이터를 유지하여 새 포스트를 못 보는 것.

```
[MCP 포스트 생성]
    ↓
[백엔드 Redis 즉시 갱신] ✅
    ↓
[프론트엔드는 30초 전 데이터] ❌
    ↓
[30초 후 또는 탭 전환 시 갱신]
```

## 😫 업계 개발자들도 같은 고민

### WordPress 개발자들
> "새 포스트가 홈페이지에 안 나타나는데, 'View Post' 링크로는 보임"

### React Query 사용자들
> "Mutation 성공했는데 UI 업데이트 안 됨"

### 실제 시간 지연 사례
- 30초~1분: 일반적인 캐시 TTL
- 5분: CDN 기본 TTL
- 2분: 캐시 만료 윈도우

## 💡 업계 표준 해결 방법들

### 1. **WordPress의 접근**
- 이벤트 기반 무효화: `clean_post_cache`
- 태그/플래그 시스템: 선택적 무효화
- Write-through 캐싱

### 2. **Medium/Enterprise 플랫폼**
- Kafka/RabbitMQ로 실시간 알림
- 밀리초 단위 무효화
- 하이브리드: 내부는 이벤트, 외부는 TTL

### 3. **Next.js 14 On-demand Revalidation**
```javascript
import { revalidateTag, revalidatePath } from 'next/cache'

export async function createPost() {
  await savePost()
  revalidateTag('posts')   // 즉시 캐시 무효화
  revalidatePath('/')
}
```

### 4. **TanStack Query v5 낙관적 업데이트**
```javascript
onMutate: async (newPost) => {
  // 즉시 UI 반영
  queryClient.setQueryData(['posts'], old => [newPost, ...old])
},
onSettled: () => {
  // 서버와 동기화
  queryClient.invalidateQueries(['posts'])
}
```

## 🎯 현실적 해결책

### "Stale-While-Revalidate" 패턴
```javascript
cache: {
  ttl: 60,           // 1분
  staleWindow: 30,   // 30초간 stale 서빙
  revalidate: true   // 백그라운드 갱신
}
```

### React Query 실무 설정
```javascript
// 많은 개발자들이 결국 이렇게...
{
  staleTime: 0,                // 항상 stale
  gcTime: 10 * 60 * 1000,      // 10분 메모리
  refetchOnMount: true,         // 마운트 시 확인
  refetchOnWindowFocus: true    // 탭 전환 시 확인
}
```

### "작성자 우선" 전략
```javascript
if (user.id === post.authorId) {
  return fetchFreshData();  // 작성자는 캐시 무시
} else {
  return getCachedData();   // 다른 사용자는 캐시
}
```

## 🏆 가장 실용적인 해결책

### 즉시 적용 가능한 방법
```javascript
// frontend/src/hooks/usePosts.ts
const commonQueryOptions = {
  staleTime: 5 * 1000,        // 5초로 단축
  gcTime: 10 * 60 * 1000,
  refetchInterval: 10 * 1000,  // 10초마다 체크
};
```

### 왜 이게 괜찮은가?
- Redis는 초당 10만 요청도 처리 가능
- 이미 메모리에 있는 데이터
- DB는 전혀 안 건드림
- 구현 비용 제로

## 📈 부하 계산

활성 사용자 1000명, staleTime 10초:
```
초당 요청 = 1000명 ÷ 10초 = 100 req/s
Redis 응답 시간 = ~1ms
Redis CPU 사용률 = ~5%
```

**Redis는 이 정도는 여유롭게 처리!**

## 🤔 개발자들의 결론

> **"완벽한 해결책은 없다"**
>
> - 성능 우선: TTL 길게, 약간의 지연 감수
> - 신선도 우선: TTL 짧게, 서버 부하 증가
> - 타협점: 5분 TTL + 이벤트 기반 부분 무효화

## 🎬 결론

2000시간 삽질 후 깨달음:
1. `staleTime: 10초`로 줄이기
2. 작성자 본인은 낙관적 업데이트
3. 나중에 정말 부하 생기면 SSE 도입

**"조기 최적화는 만악의 근원"** - 일단 간단하게 해결하고, 실제 문제가 생기면 그때 개선!

#개발 #캐시 #ReactQuery #Redis #블로그개발 #삽질기록