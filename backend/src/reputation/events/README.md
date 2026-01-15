# 평판 시스템 이벤트 레퍼런스

이 문서는 평판 점수 부여에 사용되는 이벤트와 점수 매핑을 정의합니다.

## 이벤트 → 액션 매핑

| 이벤트 소스 | 이벤트 타입 | ReputationAction | 기본 점수 | 대상 |
|------------|------------|------------------|----------|------|
| `BlogEventEmitter` | `BLOG_POST_CREATED` | `POST_PUBLISHED` | +10 | 포스트 작성자 |
| `PostInteractionEvents` | `COMMENT_ADDED` | `COMMENT_ADDED` | +3 | 댓글 작성자 |
| `PostInteractionEvents` | `LIKE_TOGGLED` (liked=true) | `LIKE_RECEIVED` | +2 | 포스트 작성자 |
| `PostInteractionEvents` | `BOOKMARK_TOGGLED` (bookmarked=true) | `BOOKMARK_RECEIVED` | +1 | 포스트 작성자 |

## 점수 부여 규칙

### 셀프 반응 차단
- **좋아요/북마크**: 자신의 콘텐츠에 반응 시 점수 미부여
- 검증: `actorId === userId` 체크

### 쿨다운 (중복 방지)
- 동일 타겟에 대한 반복 점수 차단
- TTL: 60초

## 타이틀 부여 조건

| TitleCode | 조건 | 유효 기간 |
|-----------|------|----------|
| `TOP_CONTRIBUTOR` | L7 상위 10% | 7일 |
| `RISING_STAR` | 가입 30일 이내 + L7 상위 20% | 14일 |
| `VERIFIED_WRITER` | 총점 100+ & 게시글 10+ | 영구 |

## 집계 스케줄

| Job | Cron | 설명 |
|-----|------|------|
| `DailyAggregateJob` | 매일 03:00 KST | 기간별 총점 집계 |
| `WeeklyLeaderboardJob` | 매주 월 04:00 KST | Redis 리더보드 갱신 |
| (일일) | 매일 05:00 KST | 리더보드 추가 갱신 |
