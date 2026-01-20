/**
 * 커뮤니티 관련 타입 정의
 *
 * @description Reddit 스타일 커뮤니티 시스템의 프론트엔드 타입
 */

import type { User, VoteType } from './index';

/**
 * 커뮤니티 잠금 상태 정보
 */
export interface CommunityLockState {
  readonly isLocked: boolean;
  readonly lockedAt?: string | null;
  readonly lockedById?: string | null;
  readonly lockedBy?: {
    readonly id: string;
    readonly username: string;
  } | null;
}

// =====================================================
// Enum 타입 정의
// =====================================================

/**
 * 커뮤니티 가입 정책
 */
export const JoinPolicy = {
  OPEN: 'open',           // 누구나 가입
  RESTRICTED: 'restricted', // 승인 필요
  PRIVATE: 'private',     // 초대 전용
} as const;

export type JoinPolicyType = typeof JoinPolicy[keyof typeof JoinPolicy];

/**
 * 커뮤니티 멤버 역할 (4단계 시스템)
 */
export const CommunityRole = {
  OWNER: 'owner',         // 커뮤니티 생성자 (최고 권한)
  ADMIN: 'admin',         // 부방장 (설정 변경, 매니저 관리)
  MODERATOR: 'moderator', // 매니저 (콘텐츠 관리)
  MEMBER: 'member',       // 일반 멤버 (읽기/쓰기)
} as const;

export type CommunityRoleType = typeof CommunityRole[keyof typeof CommunityRole];

/**
 * 매니저 권한 (Reddit 스타일)
 *
 * @description 매니저의 세부 권한을 정의합니다.
 * 각 매니저는 여러 권한을 조합하여 가질 수 있습니다.
 */
export const ModeratorPermission = {
  /** 전체 관리 - 모든 권한 + 다른 매니저 관리 */
  ALL: 'all',
  /** 멤버 관리 - 사용자 차단/승인, 멤버 목록 관리 */
  MEMBERS: 'members',
  /** 설정 - 커뮤니티 설정, 규칙, 외관 변경 */
  SETTINGS: 'settings',
  /** 게시물 관리 - 게시물/댓글 삭제, 공지, 고정 */
  POSTS: 'posts',
  /** 태그 관리 - 게시물/사용자 태그(플레어) 관리 */
  TAGS: 'tags',
  /** 문의 관리 - 모드메일, 신고 처리 */
  MESSAGES: 'messages',
} as const;

export type ModeratorPermissionType = typeof ModeratorPermission[keyof typeof ModeratorPermission];

/**
 * 권한 라벨 (UI 표시용, 한국어)
 */
export const ModeratorPermissionLabel: Record<ModeratorPermissionType, string> = {
  [ModeratorPermission.ALL]: '전체 관리',
  [ModeratorPermission.MEMBERS]: '멤버 관리',
  [ModeratorPermission.SETTINGS]: '설정',
  [ModeratorPermission.POSTS]: '게시물 관리',
  [ModeratorPermission.TAGS]: '태그 관리',
  [ModeratorPermission.MESSAGES]: '문의 관리',
};

/**
 * 권한 설명 (UI 툴팁용)
 */
export const ModeratorPermissionDescription: Record<ModeratorPermissionType, string> = {
  [ModeratorPermission.ALL]: '모든 권한을 가지며, 다른 운영진을 관리할 수 있습니다.',
  [ModeratorPermission.MEMBERS]: '멤버 차단, 승인, 멤버 목록 관리가 가능합니다.',
  [ModeratorPermission.SETTINGS]: '커뮤니티 설정, 규칙, 외관을 변경할 수 있습니다.',
  [ModeratorPermission.POSTS]: '게시물과 댓글을 삭제하고, 공지를 작성할 수 있습니다.',
  [ModeratorPermission.TAGS]: '게시물 및 사용자 태그를 관리할 수 있습니다.',
  [ModeratorPermission.MESSAGES]: '커뮤니티 문의와 신고를 처리할 수 있습니다.',
};

/**
 * 멤버십 상태
 */
export const MembershipStatus = {
  ACTIVE: 'active',     // 활성 멤버
  PENDING: 'pending',   // 승인 대기
  BANNED: 'banned',     // 차단됨
} as const;

export type MembershipStatusType = typeof MembershipStatus[keyof typeof MembershipStatus];

/**
 * 커뮤니티 게시물 상태
 */
export const CommunityPostStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  REMOVED: 'removed',
} as const;

export type CommunityPostStatusType = typeof CommunityPostStatus[keyof typeof CommunityPostStatus];

/**
 * 플레어 타입
 */
export const FlairType = {
  POST: 'post',   // 게시물 플레어
  USER: 'user',   // 사용자 플레어
} as const;

export type FlairTypeType = typeof FlairType[keyof typeof FlairType];

/**
 * 커뮤니티 목록 정렬
 */
export const CommunitySortBy = {
  POPULAR: 'popular',   // 멤버 수 기준
  NEWEST: 'newest',     // 최신 생성
  NAME: 'name',         // 이름순
  ACTIVE: 'active',     // 활동량 기준
} as const;

export type CommunitySortByType = typeof CommunitySortBy[keyof typeof CommunitySortBy];

/**
 * 게시물 정렬
 */
export const CommunityPostSortBy = {
  NEWEST: 'newest',
  HOT: 'hot',
  TOP: 'top',
  CONTROVERSIAL: 'controversial',
} as const;

export type CommunityPostSortByType = typeof CommunityPostSortBy[keyof typeof CommunityPostSortBy];

// =====================================================
// 엔티티 인터페이스
// =====================================================

/**
 * 커뮤니티 인터페이스
 */
export interface Community {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly iconImageFit?: 'cover' | 'contain';
  readonly bannerUrl?: string;
  readonly bannerImageFit?: 'cover' | 'contain';
  readonly creatorId?: string;
  readonly isPublic: boolean;
  readonly isPostDiscoverable: boolean;
  readonly joinPolicy: JoinPolicyType;
  readonly isNsfw: boolean;
  readonly memberCount: number;
  readonly postCount: number;
  readonly isLocked: boolean;
  readonly lockedAt?: string | null;
  readonly lockedBy?: {
    readonly id: string;
    readonly username: string;
  } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly creator?: {
    readonly id: string;
    readonly username: string;
  };
  readonly rules?: CommunityRule[];
  readonly flairs?: CommunityFlair[];
  // 동적으로 추가되는 사용자 관련 정보
  readonly userMembership?: {
    readonly isMember: boolean;
    readonly role?: CommunityRoleType;
    readonly status?: MembershipStatusType;
  };
}

/**
 * 사이드바 위젯 타입
 */
export type CommunitySidebarWidgetType =
  | 'text'
  | 'buttons'
  | 'images'
  | 'community_list'
  | 'calendar'
  | 'post_flairs'
  | 'bookmarks'
  | 'community_rules';

export type CommunitySidebarWidgetEntryType =
  | 'text'
  | 'link'
  | 'bookmark'
  | 'image'
  | 'community'
  | 'event';

export interface CommunitySidebarWidgetEntry {
  readonly id: string;
  readonly entryType: CommunitySidebarWidgetEntryType;
  readonly label?: string;
  readonly body?: string;
  readonly linkUrl?: string;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
  readonly orderIndex: number;
  readonly location?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly targetCommunity?: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly iconUrl?: string | null;
  } | null;
  readonly metadata?: Record<string, any>;
}

export interface CommunitySidebarWidget {
  readonly id: string;
  readonly type: CommunitySidebarWidgetType;
  readonly title?: string;
  readonly description?: string;
  readonly orderIndex: number;
  readonly isEnabled: boolean;
  readonly metadata?: Record<string, any>;
  readonly items: CommunitySidebarWidgetEntry[];
}

export interface CommunityWidgetItemInput {
  label?: string;
  body?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  targetCommunityId?: string;
  targetCommunitySlug?: string;
  metadata?: Record<string, any>;
}

export interface CreateCommunityWidgetInput {
  type: CommunitySidebarWidgetType;
  title?: string;
  description?: string;
  isEnabled?: boolean;
  metadata?: Record<string, any>;
  items?: CommunityWidgetItemInput[];
}

export type UpdateCommunityWidgetInput = Partial<
  Omit<CreateCommunityWidgetInput, 'type'>
> & {
  items?: CommunityWidgetItemInput[];
};

export interface ReorderCommunityWidgetsInput {
  items: Array<{ id: string }>;
}

/**
 * 커뮤니티 잠금/복구 관련 DTO
 */
export interface CommunityLockDto {
  readonly reason?: string;
}

export interface CommunitySnapshotReasonDto {
  readonly reason: string;
  readonly metadata?: Record<string, any>;
}

export interface CommunityRecoverySnapshot {
  readonly id: string;
  readonly communityId: string;
  readonly reason: string;
  readonly metadata?: Record<string, any> | null;
  readonly createdAt: string;
  readonly createdBy?: {
    readonly id: string;
    readonly username: string;
  } | null;
  readonly postsSnapshot: Array<{
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: string;
    readonly isLocked?: boolean;
    readonly removalReason?: string | null;
    readonly deletedAt?: string | null;
    readonly updatedAt?: string;
  }>;
  readonly commentsSnapshot: Array<{
    readonly id: string;
    readonly postId: string;
    readonly parentCommentId?: string | null;
    readonly content: string;
    readonly likeCount?: number;
    readonly dislikeCount?: number;
    readonly isDeleted: boolean;
    readonly removedAt?: string | null;
    readonly updatedAt?: string;
  }>;
  readonly settingsSnapshot: {
    readonly description?: string | null;
    readonly joinPolicy?: JoinPolicyType;
    readonly isPublic?: boolean;
    readonly isPostDiscoverable?: boolean;
    readonly isNsfw?: boolean;
    readonly iconUrl?: string | null;
    readonly bannerUrl?: string | null;
    readonly isLocked?: boolean;
    readonly lockedAt?: string | null;
  };
}

/**
 * 커뮤니티 멤버 인터페이스 (Reddit 스타일 권한 시스템)
 */
export interface CommunityMember {
  readonly id: string;
  readonly communityId: string;
  readonly userId: string;
  readonly role: CommunityRoleType;
  readonly status: MembershipStatusType;
  readonly userFlairId?: string;
  readonly notificationsEnabled: boolean;
  readonly joinedAt: string;
  /**
   * 운영진 권한 배열 (Reddit 스타일)
   * - 운영진만 값이 있음 (일반 멤버는 null)
   * - ['all']: 전체 관리 권한
   * - ['posts', 'members']: 개별 권한 조합
   */
  readonly permissions?: ModeratorPermissionType[] | null;
  /**
   * 운영진 순서 (Reddit 스타일 Top-Mod 시스템)
   * - 1: Top-Mod (최고 권한, 보통 Creator)
   * - 2~N: 순서대로 권한 계층
   * - null: 일반 멤버 (운영진 아님)
   */
  readonly moderatorOrder?: number | null;
  /**
   * 운영진 승격 시간
   */
  readonly promotedAt?: string | null;
  readonly user?: {
    readonly id: string;
    readonly username: string;
    readonly profileImage?: string;
    readonly blog?: {
      readonly id: string;
      readonly slug: string;
      readonly alias?: string | null;
    } | null;
  };
  readonly userFlair?: CommunityFlair;
}

/**
 * 커뮤니티 게시물 인터페이스
 */
export interface CommunityPost {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly content: string;
  readonly content_markdown?: string;
  readonly contentPreview?: string;
  readonly excerpt?: string;
  readonly communityId: string;
  readonly communitySlug?: string;
  readonly communityName?: string;
  readonly authorId: string;
  readonly flairId?: string;
  readonly thumbnailImageId?: string;
  readonly thumbnailImageUrl?: string;
  readonly thumbnailUrl?: string;
  readonly thumbnailImage?: {
    readonly id: string;
    readonly url: string;
  };
  readonly isPinned: boolean;
  readonly isLocked: boolean;
  readonly isNsfw: boolean;
  readonly isSpoiler: boolean;
  /** @deprecated upvoteCount 사용 권장 */
  readonly likeCount: number;
  /** 업보트 수 */
  readonly upvoteCount: number;
  /** 다운보트 수 */
  readonly downvoteCount: number;
  /** 순투표 점수 (upvoteCount - downvoteCount) */
  readonly score: number;
  readonly commentCount: number;
  readonly viewCount: number;
  readonly tags: string[];
  readonly status: CommunityPostStatusType;
  readonly removalReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author?: {
    readonly id: string;
    readonly username: string;
    readonly profileImage?: string;
  };
  readonly flair?: CommunityFlair;
  readonly community?: Community;
  // 동적으로 추가되는 사용자 관련 정보
  /** @deprecated userVote 사용 권장 */
  readonly userLiked?: boolean;
  /** 사용자의 투표 상태 (upvote/downvote/null) */
  readonly userVote?: VoteType;
}

/**
 * 커뮤니티 댓글 인터페이스
 */
export interface CommunityComment {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly parentCommentId?: string;  // 백엔드 응답 필드명과 일치
  readonly content: string;
  readonly content_markdown?: string;
  readonly likeCount: number;
  /** 싫어요 수 (Reddit 스타일 다운보트) */
  readonly dislikeCount: number;
  readonly replyCount: number;
  readonly isDeleted: boolean;
  readonly deletedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author?: {
    readonly id: string;
    readonly username: string;
    readonly profileImage?: string;
  };
  readonly replies?: CommunityComment[];
  // 동적으로 추가되는 사용자 관련 정보
  /** 사용자가 좋아요 했는지 여부 */
  readonly userLiked?: boolean;
  /** 사용자가 싫어요 했는지 여부 */
  readonly userDisliked?: boolean;
  /** 작성자의 커뮤니티 역할 */
  readonly authorRole?: CommunityRoleType;
}

// =====================================================
// 정렬 타입 추가
// =====================================================

/**
 * 댓글 정렬
 */
export const CommunityCommentSortBy = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  TOP: 'top',
} as const;

export type CommunityCommentSortByType = typeof CommunityCommentSortBy[keyof typeof CommunityCommentSortBy];

/**
 * 커뮤니티 규칙 인터페이스
 */
export interface CommunityRule {
  readonly id: string;
  readonly communityId: string;
  readonly title: string;
  readonly description?: string;
  readonly displayOrder: number;
  readonly createdAt: string;
}

/**
 * 커뮤니티 플레어 인터페이스
 */
export interface CommunityFlair {
  readonly id: string;
  readonly communityId: string;
  readonly name: string;
  readonly type: FlairTypeType;
  readonly backgroundColor?: string;
  readonly textColor?: string;
  readonly isModOnly: boolean;
  readonly isEnabled: boolean;
  readonly displayOrder: number;
  readonly createdAt: string;
}

/**
 * 커뮤니티 차단 인터페이스
 */
export interface CommunityBan {
  readonly id: string;
  readonly communityId: string;
  readonly userId: string;
  readonly bannedById: string;
  readonly reason?: string;
  readonly expiresAt?: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly user?: {
    readonly id: string;
    readonly username: string;
    readonly profileImage?: string;
  };
  readonly bannedBy?: {
    readonly id: string;
    readonly username: string;
  };
}

/**
 * 커뮤니티 초대 인터페이스
 */
export interface CommunityInvite {
  readonly id: string;
  readonly communityId: string;
  readonly token: string;
  readonly maxUses: number;
  readonly useCount: number;
  readonly remainingUses: number | null;
  readonly expiresAt: string;
  readonly isActive: boolean;
  readonly isValid: boolean;
  readonly createdAt: string;
  readonly createdBy?: {
    readonly id: string;
    readonly username: string;
  };
  readonly community?: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly description?: string;
    readonly iconUrl?: string;
    readonly iconImageFit?: 'cover' | 'contain';
    readonly memberCount: number;
  };
}

/**
 * 가입 대기 중인 신청 (관리자용)
 */
export interface PendingApplication {
  readonly id: string;
  readonly userId: string;
  readonly applicationMessage?: string | null;
  readonly joinedAt: string;
  readonly user?: {
    readonly id: string;
    readonly username: string;
    readonly profileImage?: string | null;
  };
}

// =====================================================
// API 요청 DTO 인터페이스
// =====================================================

/**
 * 커뮤니티 생성 DTO
 */
export interface CreateCommunityDto {
  slug: string;
  name: string;
  description?: string;
  iconUrl?: string;
  iconImageFit?: 'cover' | 'contain';
  bannerUrl?: string;
  bannerImageFit?: 'cover' | 'contain';
  joinPolicy?: JoinPolicyType;
  isNsfw?: boolean;
  isPublic?: boolean;
  isPostDiscoverable?: boolean;
}

/**
 * 커뮤니티 수정 DTO
 */
export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  iconUrl?: string | null;
  iconImageFit?: 'cover' | 'contain';
  bannerUrl?: string | null;
  bannerImageFit?: 'cover' | 'contain';
  joinPolicy?: JoinPolicyType;
  isNsfw?: boolean;
  isPublic?: boolean;
  isPostDiscoverable?: boolean;
}

/**
 * 커뮤니티 게시물 생성 DTO
 */
export interface CreateCommunityPostDto {
  title: string;
  content: string;
  contentMarkdown?: string;
  flairId?: string;
  thumbnailImageId?: string;
  isNsfw?: boolean;
  isSpoiler?: boolean;
  tags?: string[];
  isPublished?: boolean;
}

/**
 * 커뮤니티 게시물 수정 DTO
 */
export interface UpdateCommunityPostDto {
  title?: string;
  content?: string;
  contentMarkdown?: string;
  flairId?: string;
  thumbnailImageId?: string;
  isNsfw?: boolean;
  isSpoiler?: boolean;
  tags?: string[];
  status?: CommunityPostStatusType;
  isPinned?: boolean;
  isLocked?: boolean;
}

/**
 * 커뮤니티 댓글 생성 DTO
 */
export interface CreateCommunityCommentDto {
  content: string;
  contentMarkdown?: string;
  parentCommentId?: string;  // 백엔드 DTO와 필드명 일치
}

/**
 * 커뮤니티 규칙 생성 DTO
 */
export interface CreateCommunityRuleDto {
  title: string;
  description?: string;
  displayOrder?: number;
}

/**
 * 커뮤니티 규칙 수정 DTO
 */
export interface UpdateCommunityRuleDto {
  title?: string;
  description?: string;
  displayOrder?: number;
}

/**
 * 커뮤니티 플레어 생성 DTO
 */
export interface CreateCommunityFlairDto {
  name: string;
  type?: FlairTypeType;
  backgroundColor?: string;
  textColor?: string;
  isModOnly?: boolean;
  isEnabled?: boolean;
  displayOrder?: number;
}

/**
 * 커뮤니티 플레어 수정 DTO
 */
export interface UpdateCommunityFlairDto {
  name?: string;
  backgroundColor?: string;
  textColor?: string;
  isModOnly?: boolean;
  isEnabled?: boolean;
  displayOrder?: number;
}

/**
 * 멤버 차단 DTO
 */
export interface BanMemberDto {
  reason?: string;
  durationDays?: number;
}

/**
 * 멤버 역할 변경 DTO
 */
export interface UpdateMemberRoleDto {
  role: CommunityRoleType;
}

/**
 * 가입 신청 DTO (RESTRICTED 커뮤니티용)
 */
export interface JoinApplicationDto {
  message?: string;
}

/**
 * 가입 신청 처리 DTO
 */
export interface HandleApplicationDto {
  reason?: string;
}

/**
 * 초대 링크 생성 DTO
 */
export interface CreateInviteDto {
  maxUses?: number;
  expiresInHours?: number;
}

// =====================================================
// API 쿼리 파라미터 인터페이스
// =====================================================

/**
 * 커뮤니티 목록 쿼리 (커서 페이지네이션)
 *
 * @description 커서 기반 페이지네이션으로 변경
 * - cursor: 마지막 조회 아이템의 정렬 기준값
 * - cursorId: 동일 정렬값 구분을 위한 ID
 */
export interface GetCommunitiesQuery {
  cursor?: string;
  cursorId?: string;
  limit?: number;
  search?: string;
  sortBy?: CommunitySortByType;
  includeNsfw?: boolean;
  joinedOnly?: boolean;
}

/**
 * 커뮤니티 게시물 목록 쿼리
 */
export interface GetCommunityPostsQuery {
  limit?: number;
  search?: string;
  sortBy?: CommunityPostSortByType;
  flairId?: string;
  authorId?: string;
  pinnedOnly?: boolean;
  cursor?: string;
}

/**
 * 커뮤니티 댓글 목록 쿼리
 */
export interface GetCommunityCommentsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'top';
}

// =====================================================
// API 응답 인터페이스
// =====================================================

/**
 * 페이지네이션 응답 (오프셋 기반)
 * @deprecated 새 API는 CursorPaginationResponse 사용
 */
export interface PaginatedCommunityResponse<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

/**
 * 커서 페이지네이션 응답
 *
 * @description 무한 스크롤에 최적화된 커서 기반 페이지네이션
 * - nextCursor: 다음 페이지 요청 시 사용할 커서
 * - nextCursorId: 다음 페이지 요청 시 사용할 ID
 * - hasNext: 다음 페이지 존재 여부
 */
export interface CursorPaginationResponse<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
  readonly nextCursorId: string | null;
  readonly hasNext: boolean;
}

/**
 * 커뮤니티 게시물 목록 응답 (고정 게시물 포함)
 */
export interface CommunityPostListResponse extends CursorPaginationResponse<CommunityPost> {
  readonly pinnedPosts?: CommunityPost[];
}

/**
 * 투표 응답
 */
export interface VoteResponse {
  readonly action: 'added' | 'removed' | 'changed';
  readonly userVote: VoteType | null;
  readonly upvoteCount: number;
  readonly downvoteCount: number;
  readonly score: number;
  /** @deprecated liked 대신 userVote 사용 */
  readonly liked?: boolean;
  /** @deprecated likeCount 대신 upvoteCount 사용 */
  readonly likeCount?: number;
}

/**
 * 좋아요 토글 응답 (레거시)
 * @deprecated VoteResponse 사용 권장
 */
export interface LikeToggleResponse {
  readonly liked: boolean;
  readonly likeCount: number;
}

/**
 * API 성공 응답 래퍼
 */
export interface CommunityApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
}

// =====================================================
// 헬퍼 함수
// =====================================================

/**
 * 매니저 이상 권한 확인 (MODERATOR, ADMIN, OWNER)
 */
export function isModeratorOrAbove(role?: CommunityRoleType): boolean {
  return (
    role === CommunityRole.OWNER ||
    role === CommunityRole.ADMIN ||
    role === CommunityRole.MODERATOR
  );
}

/**
 * ADMIN 이상 권한 확인 (ADMIN, OWNER)
 */
export function isAdminOrAbove(role?: CommunityRoleType): boolean {
  return role === CommunityRole.OWNER || role === CommunityRole.ADMIN;
}

/**
 * ADMIN 권한 확인
 */
export function isAdmin(role?: CommunityRoleType): boolean {
  return role === CommunityRole.ADMIN;
}

/**
 * 오너 권한 확인
 */
export function isOwner(role?: CommunityRoleType): boolean {
  return role === CommunityRole.OWNER;
}

/**
 * 활성 멤버 여부 확인
 */
export function isActiveMember(membership?: { status?: MembershipStatusType }): boolean {
  return membership?.status === MembershipStatus.ACTIVE;
}

/**
 * 커뮤니티 가입 가능 여부 확인
 */
export function canJoinCommunity(
  community: Community,
  userMembership?: Community['userMembership'],
): boolean {
  // 이미 멤버인 경우
  if (userMembership?.isMember) {
    return false;
  }
  // 비공개 커뮤니티는 초대만 가능
  if (community.joinPolicy === JoinPolicy.PRIVATE) {
    return false;
  }
  return true;
}

/**
 * 커뮤니티 게시물 작성 가능 여부 확인
 */
export function canCreatePost(userMembership?: Community['userMembership']): boolean {
  return (
    userMembership?.isMember === true &&
    userMembership?.status === MembershipStatus.ACTIVE
  );
}

// =====================================================
// 권한 관련 헬퍼 함수 (Reddit 스타일)
// =====================================================

/**
 * 운영진(Staff) 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns 운영진이면 true (moderatorOrder가 설정된 경우)
 */
export function isStaff(member?: CommunityMember | null): boolean {
  if (!member) return false;
  return member.moderatorOrder !== null && member.moderatorOrder !== undefined && member.moderatorOrder > 0;
}

/**
 * Top-Mod 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns Top-Mod이면 true (moderatorOrder === 1)
 */
export function isTopMod(member?: CommunityMember | null): boolean {
  if (!member) return false;
  return member.moderatorOrder === 1;
}

/**
 * 특정 권한 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @param permission 확인할 권한
 * @returns 해당 권한이 있으면 true
 */
export function hasPermission(
  member?: CommunityMember | null,
  permission?: ModeratorPermissionType,
): boolean {
  if (!member || !permission) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  // ALL 권한이 있으면 모든 권한 보유
  if (member.permissions.includes(ModeratorPermission.ALL)) return true;

  return member.permissions.includes(permission);
}

/**
 * 전체 관리 권한(ALL) 보유 여부 확인
 *
 * @param member 커뮤니티 멤버
 * @returns ALL 권한이 있으면 true
 */
export function hasAllPermission(member?: CommunityMember | null): boolean {
  if (!member) return false;
  if (!member.permissions || member.permissions.length === 0) return false;

  return member.permissions.includes(ModeratorPermission.ALL);
}

/**
 * 다른 운영진 관리 가능 여부 확인 (Reddit 스타일 순서 기반)
 *
 * @param actor 행위자 (관리하려는 운영진)
 * @param target 대상 (관리 대상 멤버)
 * @returns 관리 가능하면 true
 */
export function canManageModerator(
  actor?: CommunityMember | null,
  target?: CommunityMember | null,
): boolean {
  if (!actor || !target) return false;

  // ALL 권한이 없으면 운영진 관리 불가
  if (!hasAllPermission(actor)) return false;

  // 대상이 운영진이 아니면 관리 가능
  if (!isStaff(target)) return true;

  // 자신보다 아래 순서의 운영진만 관리 가능
  return (
    actor.moderatorOrder !== null &&
    actor.moderatorOrder !== undefined &&
    target.moderatorOrder !== null &&
    target.moderatorOrder !== undefined &&
    actor.moderatorOrder < target.moderatorOrder
  );
}

/**
 * 권한 목록을 사람이 읽을 수 있는 문자열로 변환
 *
 * @param permissions 권한 목록
 * @returns 한국어 권한 목록 문자열
 */
export function formatPermissions(
  permissions?: ModeratorPermissionType[] | null,
): string {
  if (!permissions || permissions.length === 0) return '권한 없음';

  // ALL 권한이 있으면 전체 관리자
  if (permissions.includes(ModeratorPermission.ALL)) return '전체 관리';

  return permissions.map((p) => ModeratorPermissionLabel[p] || p).join(', ');
}
