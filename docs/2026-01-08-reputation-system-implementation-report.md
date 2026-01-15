# 평판 시스템 MVP 구현 보고서

**작성일**: 2026-01-08  
**작성자**: Antigravity AI

---

## 1. 진행 개요

### 목표
사용자 평판(Ranking) 시스템 MVP 구현:
- 포스트 작성, 댓글, 좋아요, 북마크 등 활동에 따른 점수 부여
- 기간별 리더보드 (7일, 30일)
- Admin 대시보드 연동

### 진행 기간
단일 세션 내 구현 완료

---

## 2. 진행 과정

### Phase 1-2: Backend 핵심 구조 구현
| 작업 | 파일 수 |
|-----|--------|
| Enums (ReputationAction, ReputationPeriod, TitleCode) | 3개 |
| Entities (ReputationLedger, ReputationTotal, TitleGrant) | 3개 |
| Services (Ledger, Aggregator, Title, Leaderboard) | 4개 |
| DTOs | 3개 |

### Phase 3: 이벤트 연동
기존 서비스에 평판 이벤트 발행 코드 추가:

| 서비스 | 이벤트 | 평판 액션 |
|--------|--------|-----------|
| CommentsService | `post.comment.added` | COMMENT_ADDED (+3점) |
| VoteService | `post.like.toggled` | LIKE_RECEIVED (+2점) |
| BookmarksService | `post.bookmark.toggled` | BOOKMARK_RECEIVED (+1점) |

### Phase 4-5: Cron Jobs & Admin API
- `daily-aggregate.job.ts`: 매일 03:00 집계
- `weekly-leaderboard.job.ts`: 주간 리더보드 갱신
- `reputation-admin.controller.ts`: Admin REST API

### Phase 6: Frontend
- API 클라이언트, React Query Hooks, UI 컴포넌트
- `/admin/reputation` 페이지 생성

---

## 3. 발생한 문제점 및 해결

### 문제 1: 마이그레이션 타임스탬프 오류
**증상**: `migration:generate`로 생성된 파일의 타임스탬프가 기존 마이그레이션보다 이전 시점  
**해결**: 파일 삭제 후 `1793000000000-CreateReputationTables.ts`로 수동 작성

### 문제 2: TypeScript 컴파일 오류
**증상**: `Property 'avatarUrl' does not exist on type 'Profile'`  
**해결**: `leaderboard.service.ts`에서 `avatarUrl` → `profileImage` 변경

### 문제 3: BlogPostEvent 타입 불일치
**증상**: `Property 'authorId' does not exist on type 'BlogPostEvent'`  
**해결**: `post.events.listener.ts`에서 `authorId` → `userId` 변경

### 문제 4: Frontend API URL 중복
**증상**: 리더보드 페이지에서 404 오류  
**해결**: `reputation.ts`의 모든 API 함수에서 `/api/v1` 중복 제거

---

## 4. 최종 결과물

### 생성된 파일 (Backend: 25개)
```
backend/src/reputation/
├── reputation.module.ts
├── reputation.keys.ts
├── controllers/ (2개)
├── dto/ (4개)
├── entities/ (4개)
├── enums/ (3개)
├── events/ (2개)
├── jobs/ (3개)
├── listeners/ (4개)
├── services/ (5개)
└── __tests__/ (3개)
```

### 생성된 파일 (Frontend: 7개)
```
frontend/src/features/reputation/
├── index.ts
├── api/reputation.ts
├── hooks/ (2개)
└── components/ (2개)

frontend/src/app/admin/reputation/page.tsx
```

---

## 5. 결론

✅ **평판 시스템 MVP 구현 완료**

- 백엔드: 점수 기록, 집계, 리더보드, Admin API 모두 구현
- 프론트엔드: 리더보드 UI, Admin 페이지 구현
- 테스트: 단위 테스트 12개 통과, E2E 테스트 성공
- 이벤트 연동: 댓글, 좋아요, 북마크 시 자동 점수 기록

⚠️ **참고사항**: 자기 게시물에 좋아요/댓글은 점수가 부여되지 않도록 설계됨 (정상 동작)
