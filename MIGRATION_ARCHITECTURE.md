# NewChat to Blog Migration Architecture

## 개요
NewChat 프로젝트(Next.js + Prisma)에서 Blog 프로젝트(NestJS + Next.js + TypeORM)로 주요 기능을 이식하는 아키텍처 설계 문서입니다.

## 이식할 기능 목록
1. **알림 시스템** - 헤더에 알림 아이콘 추가 (프로필 설정 왼쪽)
2. **유저 호버 툴팁** - 유저 정보를 표시하는 호버 카드
3. **유저 프로필 페이지** - 유저별 상세 프로필 페이지
4. **팔로우/언팔로우 시스템** - 유저 간 팔로우 관계
5. **추천 사이드바** - "회원님을 위한 추천" 섹션

## 아키텍처 차이점 분석

### NewChat (기존)
- **Frontend**: Next.js 15 (App Router)
- **Database ORM**: Prisma
- **Authentication**: Lucia Auth
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS + shadcn/ui
- **Architecture**: Monolithic Next.js

### Blog (대상)
- **Frontend**: Next.js 14 (App Router)
- **Backend**: NestJS (별도 서버)
- **Database ORM**: TypeORM
- **Authentication**: JWT (HttpOnly Cookie)
- **State Management**: React Query
- **Styling**: Tailwind CSS + shadcn/ui
- **Architecture**: Separated Backend/Frontend

## 데이터베이스 스키마 설계

### 새로운 엔티티 추가

#### 1. Follow Entity
```typescript
// backend/src/follows/entities/follow.entity.ts
@Entity('follows')
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  followerId: string;

  @Column({ type: 'uuid' })
  followingId: string;

  @ManyToOne(() => User, user => user.following, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId' })
  follower: User;

  @ManyToOne(() => User, user => user.followers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId' })
  following: User;

  @CreateDateColumn()
  createdAt: Date;

  @Index(['followerId', 'followingId'], { unique: true })
}
```

#### 2. Notification Entity
```typescript
// backend/src/notifications/entities/notification.entity.ts
export enum NotificationType {
  FOLLOW = 'FOLLOW',
  POST_LIKE = 'POST_LIKE',
  COMMENT = 'COMMENT',
  COMMENT_REPLY = 'COMMENT_REPLY',
  BLOG_POST = 'BLOG_POST'
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'uuid' })
  issuerId: string;

  @Column({ type: 'uuid', nullable: true })
  postId?: string;

  @Column({ type: 'uuid', nullable: true })
  commentId?: string;

  @Column({
    type: 'enum',
    enum: NotificationType
  })
  type: NotificationType;

  @Column({ default: false })
  read: boolean;

  @ManyToOne(() => User, user => user.receivedNotifications)
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @ManyToOne(() => User, user => user.issuedNotifications)
  @JoinColumn({ name: 'issuerId' })
  issuer: User;

  @ManyToOne(() => Post, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post?: Post;

  @ManyToOne(() => Comment, { nullable: true })
  @JoinColumn({ name: 'commentId' })
  comment?: Comment;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 3. User Entity 업데이트
```typescript
// User Entity에 추가할 필드
@Entity('users')
export class User {
  // ... 기존 필드 ...

  @Column({ nullable: true, length: 100 })
  displayName: string; // username과 별도로 표시 이름

  // 팔로우 관계
  @OneToMany(() => Follow, follow => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, follow => follow.following)
  followers: Follow[];

  // 알림
  @OneToMany(() => Notification, notification => notification.recipient)
  receivedNotifications: Notification[];

  @OneToMany(() => Notification, notification => notification.issuer)
  issuedNotifications: Notification[];

  // 통계를 위한 가상 필드 (QueryBuilder로 계산)
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
}
```

## API 엔드포인트 설계

### Follow 관련 API
```
POST   /api/v1/users/:userId/follow      - 팔로우
DELETE /api/v1/users/:userId/follow      - 언팔로우
GET    /api/v1/users/:userId/followers   - 팔로워 목록
GET    /api/v1/users/:userId/following   - 팔로잉 목록
GET    /api/v1/users/:userId/follow-info - 팔로우 정보 (팔로워 수, 팔로우 여부)
```

### Notification 관련 API
```
GET    /api/v1/notifications           - 알림 목록 (페이지네이션)
GET    /api/v1/notifications/unread    - 읽지 않은 알림 수
PUT    /api/v1/notifications/:id/read  - 알림 읽음 처리
PUT    /api/v1/notifications/read-all  - 모든 알림 읽음 처리
DELETE /api/v1/notifications/:id       - 알림 삭제
```

### User Profile 관련 API
```
GET    /api/v1/users/:username         - 유저 프로필 정보
GET    /api/v1/users/:username/posts   - 유저 포스트 목록
GET    /api/v1/users/recommendations   - 추천 유저 목록
PUT    /api/v1/users/profile           - 프로필 업데이트 (bio, displayName 등)
```

## 프론트엔드 컴포넌트 설계

### 1. 알림 시스템 컴포넌트
```typescript
// frontend/src/components/notifications/
├── NotificationIcon.tsx       // 헤더의 알림 아이콘
├── NotificationDropdown.tsx   // 알림 드롭다운 메뉴
├── NotificationItem.tsx       // 개별 알림 아이템
└── NotificationBadge.tsx      // 읽지 않은 알림 카운트 뱃지
```

### 2. 유저 툴팁 컴포넌트
```typescript
// frontend/src/components/user/
├── UserTooltip.tsx          // 유저 호버 툴팁 컨테이너
├── UserAvatar.tsx           // 유저 아바타 (재사용 가능)
├── UserTooltipContent.tsx   // 툴팁 내용 (팔로우 정보, bio 등)
└── UserLink.tsx             // 툴팁이 적용된 유저 링크
```

### 3. 팔로우 시스템 컴포넌트
```typescript
// frontend/src/components/follow/
├── FollowButton.tsx         // 팔로우/언팔로우 버튼
├── FollowerCount.tsx        // 팔로워 수 표시
├── FollowingCount.tsx       // 팔로잉 수 표시
└── FollowList.tsx          // 팔로워/팔로잉 목록
```

### 4. 추천 사이드바 컴포넌트
```typescript
// frontend/src/components/recommendations/
├── RecommendationsSidebar.tsx   // 추천 사이드바 컨테이너
├── RecommendedUser.tsx          // 추천 유저 아이템
└── TrendingPosts.tsx            // 인기 포스트 (선택사항)
```

### 5. 유저 프로필 페이지
```typescript
// frontend/src/app/users/[username]/
├── page.tsx                // 프로필 페이지 메인
├── UserProfile.tsx         // 프로필 정보 컴포넌트
├── UserPosts.tsx          // 유저 포스트 목록
└── EditProfileDialog.tsx   // 프로필 편집 다이얼로그
```

## 구현 순서

### Phase 1: 백엔드 기반 구축
1. **데이터베이스 스키마 업데이트**
   - Follow, Notification 엔티티 생성
   - User 엔티티 업데이트
   - Migration 생성 및 실행

2. **NestJS 모듈 생성**
   - FollowsModule 생성
   - NotificationsModule 생성
   - Users 모듈 업데이트

3. **API 구현**
   - Follow 관련 엔드포인트
   - Notification 관련 엔드포인트
   - User profile 관련 엔드포인트

### Phase 2: 프론트엔드 기능 구현
1. **기초 컴포넌트 구현**
   - UserAvatar 컴포넌트
   - FollowButton 컴포넌트
   - UserTooltip 컴포넌트

2. **알림 시스템 구현**
   - NotificationIcon 헤더에 추가
   - NotificationDropdown 구현
   - 실시간 알림 수 업데이트 (React Query)

3. **유저 프로필 페이지**
   - 프로필 페이지 라우팅 설정
   - 프로필 정보 표시
   - 팔로우/언팔로우 기능

4. **추천 사이드바**
   - RecommendationsSidebar 구현
   - 레이아웃에 통합

### Phase 3: 통합 및 최적화
1. **성능 최적화**
   - React Query 캐싱 전략
   - 이미지 최적화
   - 무한 스크롤 구현

2. **보안 강화**
   - Input validation
   - Rate limiting
   - SQL injection 방지

3. **테스트**
   - Unit tests
   - Integration tests
   - E2E tests

## 기술적 고려사항

### 1. 실시간 업데이트
- **알림**: Server-Sent Events (SSE) 또는 WebSocket 고려
- **팔로우 수**: React Query의 optimistic update 활용

### 2. 성능 최적화
- **데이터베이스 인덱싱**: followerId, followingId 복합 인덱스
- **쿼리 최적화**: N+1 문제 방지를 위한 eager loading
- **캐싱**: Redis 활용 고려 (선택사항)

### 3. 보안
- **인증/인가**: JWT 토큰 검증
- **Rate Limiting**: 팔로우/언팔로우 남용 방지
- **입력 검증**: DTO와 class-validator 활용

### 4. 확장성
- **페이지네이션**: 모든 목록 API에 적용
- **필터링**: 알림 타입별 필터링
- **정렬**: 최신순, 인기순 등

## 마이그레이션 리스크 및 대응 방안

### 리스크
1. **TypeORM vs Prisma 차이**: 쿼리 작성 방식 차이
2. **인증 시스템 차이**: Lucia Auth vs JWT
3. **파일 구조 차이**: Monolithic vs Separated

### 대응 방안
1. **점진적 마이그레이션**: 기능별로 단계적 구현
2. **테스트 커버리지**: 각 단계별 충분한 테스트
3. **롤백 계획**: 각 Phase별 롤백 가능하도록 구현
4. **문서화**: 변경사항 상세 문서화

## 예상 타임라인
- Phase 1: 3-4일 (백엔드 기반 구축)
- Phase 2: 4-5일 (프론트엔드 구현)
- Phase 3: 2-3일 (통합 및 최적화)
- 총 예상: 9-12일

## 성공 지표
1. 모든 API 엔드포인트 정상 작동
2. 기존 Blog 기능 정상 작동 유지
3. 페이지 로딩 속도 3초 이내
4. 테스트 커버리지 80% 이상
5. 보안 취약점 0개