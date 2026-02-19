/**
 * 커뮤니티 관련 API 서비스
 *
 * @description Reddit 스타일 커뮤니티 시스템의 API 호출을 담당
 *
 * **기능:**
 * - 커뮤니티 CRUD (생성, 조회, 수정, 삭제)
 * - 멤버십 관리 (가입, 탈퇴, 역할 변경)
 * - 게시물 CRUD 및 좋아요
 * - 댓글 CRUD 및 좋아요
 * - 규칙/플레어 관리
 * - 모더레이션 (차단, 고정 등)
 */

import type {
  Community,
  CommunityPost,
  CommunityComment,
  CommunityMember,
  CommunityRule,
  CommunityFlair,
  CommunityBan,
  CommunityInvite,
  PendingApplication,
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
  CreateCommunityCommentDto,
  CreateCommunityRuleDto,
  UpdateCommunityRuleDto,
  CreateCommunityFlairDto,
  UpdateCommunityFlairDto,
  BanMemberDto,
  UpdateMemberRoleDto,
  JoinApplicationDto,
  HandleApplicationDto,
  CreateInviteDto,
  GetCommunitiesQuery,
  GetCommunityPostsQuery,
  GetCommunityCommentsQuery,
  PaginatedCommunityResponse,
  CursorPaginationResponse,
  CommunityPostListResponse,
  LikeToggleResponse,
  VoteResponse,
  CommunityApiResponse,
  FlairTypeType,
  CommunityRoleType,
  CommunityLockDto,
  CommunityRecoverySnapshot,
  CommunitySnapshotReasonDto,
  CommunitySidebarWidget,
  CreateCommunityWidgetInput,
  UpdateCommunityWidgetInput,
  ReorderCommunityWidgetsInput,
} from '@/types/community';
import type { VoteType } from '@/types';
import { getViewerId } from '@/lib/viewer-id';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * API 응답 처리 헬퍼
 * - { success: true, data: ... } 형식 처리
 * - 에러 시 적절한 메시지와 함께 예외 발생
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage =
      error.message || `Request failed with status ${response.status}`;
    const requestError = new Error(errorMessage);
    (requestError as Error & { status?: number }).status = response.status;
    throw requestError;
  }

  const result = await response.json();
  return result.data ?? result;
}

/**
 * 쿼리 파라미터 빌드
 */
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =====================================================
// 커뮤니티 CRUD
// =====================================================

/**
 * 커뮤니티 목록 조회 (커서 페이지네이션)
 *
 * @description 커서 기반 무한 스크롤을 위한 API
 * - 첫 요청: cursor 없이 호출
 * - 다음 페이지: nextCursor, nextCursorId 사용
 */
export async function getCommunities(
  query: GetCommunitiesQuery = {},
): Promise<CursorPaginationResponse<Community>> {
  const queryString = buildQueryString(query);

  const response = await fetch(`${API_URL}/community${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 커뮤니티 상세 조회
 */
export async function getCommunityBySlug(slug: string): Promise<Community> {
  const response = await fetch(`${API_URL}/community/${slug}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 커뮤니티 생성
 */
export async function createCommunity(dto: CreateCommunityDto): Promise<Community> {
  const response = await fetch(`${API_URL}/community`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 커뮤니티 수정
 */
export async function updateCommunity(
  slug: string,
  dto: UpdateCommunityDto,
): Promise<Community> {
  const response = await fetch(`${API_URL}/community/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 커뮤니티 삭제 (Site Admin 전용)
 *
 * @description Reddit 정책에 따라 커뮤니티 삭제는 플랫폼 관리자(Site Admin)만 가능합니다.
 * 일반 사용자(커뮤니티 Owner/Moderator 포함)는 이 API를 호출해도 403 에러가 발생합니다.
 *
 * @param slug - 삭제할 커뮤니티 slug
 * @throws 403 Forbidden - 플랫폼 관리자가 아닌 경우
 */
export async function deleteCommunity(slug: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete community');
  }
}

// =====================================================
// 멤버십 관리
// =====================================================

/**
 * 커뮤니티 가입
 */
export async function joinCommunity(slug: string): Promise<CommunityMember> {
  const response = await fetch(`${API_URL}/community/${slug}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 커뮤니티 탈퇴
 */
export async function leaveCommunity(slug: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to leave community');
  }
}

/**
 * 멤버 목록 조회
 */
export async function getCommunityMembers(
  slug: string,
  query: { page?: number; limit?: number; role?: CommunityRoleType } = {},
): Promise<PaginatedCommunityResponse<CommunityMember>> {
  const queryString = buildQueryString(query);
  const response = await fetch(`${API_URL}/community/${slug}/members${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 매니저 목록 조회
 */
export async function getCommunityModerators(slug: string): Promise<CommunityMember[]> {
  const response = await fetch(`${API_URL}/community/${slug}/moderators`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 멤버 역할 변경
 */
export async function updateMemberRole(
  slug: string,
  userId: string,
  dto: UpdateMemberRoleDto,
): Promise<CommunityMember> {
  const response = await fetch(`${API_URL}/community/${slug}/members/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 소유권 이전
 */
export async function transferOwnership(slug: string, newOwnerId: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/transfer-ownership/${newOwnerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to transfer ownership');
  }
}

// =====================================================
// 차단 관리
// =====================================================

/**
 * 멤버 차단
 */
export async function banMember(
  slug: string,
  userId: string,
  dto: BanMemberDto,
): Promise<CommunityBan> {
  const response = await fetch(`${API_URL}/community/${slug}/members/${userId}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 차단 해제
 */
export async function unbanMember(slug: string, userId: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/members/${userId}/ban`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to unban member');
  }
}

/**
 * 차단 목록 조회
 */
export async function getCommunityBans(
  slug: string,
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedCommunityResponse<CommunityBan>> {
  const queryString = buildQueryString(query);
  const response = await fetch(`${API_URL}/community/${slug}/bans${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

// =====================================================
// 가입 승인 관리 (RESTRICTED 커뮤니티)
// =====================================================

/**
 * 가입 신청 (RESTRICTED 커뮤니티용)
 */
export async function applyToJoin(
  slug: string,
  dto: JoinApplicationDto = {},
): Promise<{ status: string; role: string }> {
  const response = await fetch(`${API_URL}/community/${slug}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 대기 중인 가입 신청 목록 조회 (매니저용)
 */
export async function getPendingApplications(
  slug: string,
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedCommunityResponse<PendingApplication>> {
  const queryString = buildQueryString(query);
  const response = await fetch(`${API_URL}/community/${slug}/applications${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 가입 신청 승인
 */
export async function approveApplication(
  slug: string,
  userId: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/applications/${userId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to approve application');
  }
}

/**
 * 가입 신청 거부
 */
export async function rejectApplication(
  slug: string,
  userId: string,
  dto: HandleApplicationDto = {},
): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/applications/${userId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to reject application');
  }
}

// =====================================================
// 초대 링크 관리
// =====================================================

/**
 * 초대 링크 생성 (매니저용)
 */
export async function createInvite(
  slug: string,
  dto: CreateInviteDto = {},
): Promise<CommunityInvite> {
  const response = await fetch(`${API_URL}/community/${slug}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 초대 링크 목록 조회 (매니저용)
 */
export async function getInvites(
  slug: string,
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedCommunityResponse<CommunityInvite>> {
  const queryString = buildQueryString(query);
  const response = await fetch(`${API_URL}/community/${slug}/invites${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 초대 링크 비활성화 (매니저용)
 */
export async function revokeInvite(
  slug: string,
  inviteId: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to revoke invite');
  }
}

/**
 * 초대 정보 조회 (토큰 기반, 공개)
 */
export async function getInviteByToken(token: string): Promise<CommunityInvite | null> {
  const response = await fetch(`${API_URL}/community/invite/${token}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  const result = await response.json();
  if (!result.success) {
    return null;
  }
  return result.data;
}

/**
 * 초대 링크로 가입
 */
export async function acceptInvite(
  token: string,
): Promise<{ communityId: string; status: string; role: string }> {
  const response = await fetch(`${API_URL}/community/invite/${token}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

// =====================================================
// 규칙 관리
// =====================================================

/**
 * 규칙 목록 조회
 */
export async function getCommunityRules(slug: string): Promise<CommunityRule[]> {
  const response = await fetch(`${API_URL}/community/${slug}/rules`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 규칙 생성
 */
export async function createCommunityRule(
  slug: string,
  dto: CreateCommunityRuleDto,
): Promise<CommunityRule> {
  const response = await fetch(`${API_URL}/community/${slug}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 규칙 수정
 */
export async function updateCommunityRule(
  slug: string,
  ruleId: string,
  dto: UpdateCommunityRuleDto,
): Promise<CommunityRule> {
  const response = await fetch(`${API_URL}/community/${slug}/rules/${ruleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 규칙 삭제
 */
export async function deleteCommunityRule(slug: string, ruleId: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/rules/${ruleId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete rule');
  }
}

// =====================================================
// 플레어 관리
// =====================================================

/**
 * 플레어 목록 조회
 */
export async function getCommunityFlairs(
  slug: string,
  type?: FlairTypeType,
): Promise<CommunityFlair[]> {
  const queryString = type ? `?type=${type}` : '';
  const response = await fetch(`${API_URL}/community/${slug}/flairs${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 플레어 생성
 */
export async function createCommunityFlair(
  slug: string,
  dto: CreateCommunityFlairDto,
): Promise<CommunityFlair> {
  const response = await fetch(`${API_URL}/community/${slug}/flairs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 플레어 수정
 */
export async function updateCommunityFlair(
  slug: string,
  flairId: string,
  dto: UpdateCommunityFlairDto,
): Promise<CommunityFlair> {
  const response = await fetch(`${API_URL}/community/${slug}/flairs/${flairId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 플레어 삭제
 */
export async function deleteCommunityFlair(slug: string, flairId: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/flairs/${flairId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete flair');
  }
}

// =====================================================
// 게시물 CRUD
// =====================================================

/**
 * 게시물 목록 조회
 */
export async function getCommunityPosts(
  slug: string,
  query: GetCommunityPostsQuery = {},
): Promise<CommunityPostListResponse> {
  const queryString = buildQueryString(query);
  const response = await fetch(`${API_URL}/community/${slug}/posts${queryString}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 게시물 상세 조회
 */
export async function getCommunityPost(
  communitySlug: string,
  postSlug: string,
): Promise<CommunityPost> {
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postSlug}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 게시물 생성
 */
export async function createCommunityPost(
  slug: string,
  dto: CreateCommunityPostDto,
): Promise<CommunityPost> {
  const response = await fetch(`${API_URL}/community/${slug}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 게시물 수정
 */
export async function updateCommunityPost(
  communitySlug: string,
  postSlug: string,
  dto: UpdateCommunityPostDto,
): Promise<CommunityPost> {
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

/**
 * 게시물 삭제
 */
export async function deleteCommunityPost(
  communitySlug: string,
  postId: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete post');
  }
}

/**
 * 게시물 좋아요 토글
 * @deprecated votePost 사용 권장
 */
export async function togglePostLike(
  communitySlug: string,
  postSlug: string,
): Promise<LikeToggleResponse> {
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postSlug}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

/**
 * 게시물 투표 (Upvote/Downvote)
 *
 * @description Reddit 스타일 투표 시스템
 * - 같은 투표 다시 클릭: 취소
 * - 다른 투표 클릭: 변경
 *
 * @param communitySlug 커뮤니티 slug
 * @param postId 게시물 ID (UUID)
 * @param voteType 투표 타입 ('upvote' | 'downvote')
 * @returns VoteResponse
 */
export async function votePost(
  communitySlug: string,
  postId: string,
  voteType: NonNullable<VoteType>,
): Promise<VoteResponse> {
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type: voteType }),
  });

  return handleResponse(response);
}

/**
 * 게시물 조회수 증가
 */
export async function incrementPostView(
  communitySlug: string,
  postId: string,
): Promise<void> {
  const viewerId = getViewerId();
  const response = await fetch(`${API_URL}/community/${communitySlug}/posts/${postId}/view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(viewerId ? { 'X-Viewer-Id': viewerId } : {}),
    },
    credentials: 'include',
  });

  // 조회수 증가는 실패해도 크리티컬하지 않으므로 에러 무시
  if (!response.ok) {
    console.warn('Failed to increment post view');
  }
}
// =====================================================
// 배치 조회 (성능 최적화)
// =====================================================

/**
 * 커뮤니티별 최신 게시글 일괄 조회 (Batch API)
 */
export async function getRecentPostsBatch(
  communityIds: string[],
): Promise<Record<string, CommunityPost[]>> {
  if (!communityIds.length) {
    return {};
  }
  
  const ids = communityIds.join(',');
  const response = await fetch(`${API_URL}/community/batch/recent-posts?ids=${ids}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

// =====================================================
// 댓글 CRUD
// =====================================================

/**
 * 댓글 목록 조회
 */
export async function getCommunityComments(
  communitySlug: string,
  postId: string,
  query: GetCommunityCommentsQuery = {},
): Promise<PaginatedCommunityResponse<CommunityComment>> {
  const queryString = buildQueryString(query);
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments${queryString}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  return handleResponse(response);
}

/**
 * 댓글 생성
 */
export async function createCommunityComment(
  communitySlug: string,
  postId: string,
  dto: CreateCommunityCommentDto,
): Promise<CommunityComment> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    },
  );

  return handleResponse(response);
}

/**
 * 댓글 수정
 */
export async function updateCommunityComment(
  communitySlug: string,
  postId: string,
  commentId: string,
  content: string,
): Promise<CommunityComment> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments/${commentId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    },
  );

  return handleResponse(response);
}

/**
 * 댓글 삭제
 */
export async function deleteCommunityComment(
  communitySlug: string,
  postId: string,
  commentId: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments/${commentId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete comment');
  }
}

/**
 * 댓글 좋아요 토글
 *
 * @description Reddit 스타일 상호배타 로직
 * - 좋아요 클릭 → 새로 좋아요 추가
 * - 좋아요 다시 클릭 → 좋아요 취소
 * - 싫어요 상태에서 좋아요 → 싫어요 제거 + 좋아요 추가
 */
export async function toggleCommentLike(
  communitySlug: string,
  postId: string,
  commentId: string,
): Promise<{ liked: boolean; likeCount: number; dislikeCount: number }> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments/${commentId}/like`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  return handleResponse(response);
}

/**
 * 댓글 싫어요 토글
 *
 * @description Reddit 스타일 상호배타 로직
 * - 싫어요 클릭 → 새로 싫어요 추가
 * - 싫어요 다시 클릭 → 싫어요 취소
 * - 좋아요 상태에서 싫어요 → 좋아요 제거 + 싫어요 추가
 */
export async function toggleCommentDislike(
  communitySlug: string,
  postId: string,
  commentId: string,
): Promise<{ disliked: boolean; likeCount: number; dislikeCount: number }> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments/${commentId}/dislike`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  return handleResponse(response);
}

/**
 * 댓글 답글 목록 조회
 */
export async function getCommentReplies(
  communitySlug: string,
  postId: string,
  commentId: string,
  query: GetCommunityCommentsQuery = {},
): Promise<PaginatedCommunityResponse<CommunityComment>> {
  const queryString = buildQueryString(query);
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postId}/comments/${commentId}/replies${queryString}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  return handleResponse(response);
}

// =====================================================
// 이미지 업로드 (V2 ContextualFile)
// =====================================================

/**
 * 커뮤니티 이미지 업로드 (아이콘/배너)
 *
 * @description V2 ContextualFile 시스템을 사용하여 커뮤니티 이미지를 업로드
 * - 경로: v2/communities/{communityId}/branding/{icon|banner}/{timestamp}_{uuid}_{purpose}.webp
 * - 기존 이미지 자동 비활성화 (버전 관리)
 *
 * @param slug 커뮤니티 slug
 * @param purpose 이미지 용도 ('icon' | 'banner')
 * @param file 업로드할 파일
 * @returns 업로드 결과 (url, fileId, purpose)
 */
export async function uploadCommunityImage(
  slug: string,
  purpose: 'icon' | 'banner',
  file: File,
): Promise<{ url: string; fileId: string; purpose: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/community/${slug}/upload/${purpose}`, {
    method: 'POST',
    credentials: 'include',
    // Content-Type 헤더를 명시적으로 설정하지 않음 (FormData가 자동으로 boundary 설정)
    body: formData,
  });

  return handleResponse(response);
}

// =====================================================
// 모더레이션 액션
// =====================================================

/**
 * 게시물 고정/해제
 */
export async function togglePostPin(
  communitySlug: string,
  postId: string,
  isPinned: boolean,
): Promise<CommunityPost> {
  return updateCommunityPost(communitySlug, postId, { isPinned });
}

/**
 * 게시물 잠금/해제
 */
export async function togglePostLock(
  communitySlug: string,
  postId: string,
  isLocked: boolean,
): Promise<CommunityPost> {
  // update 엔드포인트를 통해 isLocked 필드 변경
  return updateCommunityPost(communitySlug, postId, { isLocked });
}

/**
 * 게시물 삭제 (매니저)
 */
export async function removePost(
  communitySlug: string,
  postSlug: string,
  reason?: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postSlug}/remove`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to remove post');
  }
}

/**
 * 게시물 복원
 */
export async function approvePost(communitySlug: string, postSlug: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/community/${communitySlug}/posts/${postSlug}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to approve post');
  }
}

// =====================================================
// 커뮤니티 잠금 & 복구 (Admin 전용)
// =====================================================

export async function lockCommunityAdmin(
  communityId: string,
  dto: CommunityLockDto = {},
): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_URL}/admin/communities/${communityId}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

export async function unlockCommunityAdmin(
  communityId: string,
  dto: CommunityLockDto = {},
): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_URL}/admin/communities/${communityId}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

export async function getCommunityRecoverySnapshots(
  communityId: string,
  limit = 20,
): Promise<CommunityRecoverySnapshot[]> {
  const query = buildQueryString({ limit });
  const response = await fetch(
    `${API_URL}/admin/communities/${communityId}/recovery-snapshots${query}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  return handleResponse(response);
}

export async function captureCommunityRecoverySnapshot(
  communityId: string,
  dto: CommunitySnapshotReasonDto,
): Promise<CommunityRecoverySnapshot> {
  const response = await fetch(
    `${API_URL}/admin/communities/${communityId}/recovery-snapshots`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    },
  );

  return handleResponse(response);
}

export async function restoreCommunitySnapshot(snapshotId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/admin/communities/recovery-snapshots/${snapshotId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    },
  );

  await handleResponse(response);
}

// =====================================================
// 커뮤니티 사이드바 위젯
// =====================================================

export async function getCommunityWidgetsApi(slug: string): Promise<CommunitySidebarWidget[]> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function getManageCommunityWidgetsApi(slug: string): Promise<CommunitySidebarWidget[]> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets/manage`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function createCommunityWidgetApi(
  slug: string,
  dto: CreateCommunityWidgetInput,
): Promise<CommunitySidebarWidget> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

export async function updateCommunityWidgetApi(
  slug: string,
  widgetId: string,
  dto: UpdateCommunityWidgetInput,
): Promise<CommunitySidebarWidget> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets/${widgetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  return handleResponse(response);
}

export async function deleteCommunityWidgetApi(slug: string, widgetId: string): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets/${widgetId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete widget');
  }
}

export async function reorderCommunityWidgetsApi(
  slug: string,
  dto: ReorderCommunityWidgetsInput,
): Promise<void> {
  const response = await fetch(`${API_URL}/community/${slug}/widgets/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to reorder widgets');
  }
}

export async function uploadCommunityWidgetImageApi(
  slug: string,
  widgetId: string,
  file: File,
): Promise<{ fileId: string; url: string; contextId: string; s3Key: string; version: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/community/${slug}/widgets/${widgetId}/images`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  return handleResponse(response);
}

// =====================================================
// 커뮤니티 서비스 객체 export
// =====================================================

/**
 * 커뮤니티 서비스 API 객체
 * 모든 커뮤니티 관련 API를 하나의 객체로 묶어서 export
 */
export const communityService = {
  // 커뮤니티 CRUD
  getCommunities,
  getCommunity: getCommunityBySlug,
  getCommunityBySlug,
  createCommunity,
  updateCommunity,
  deleteCommunity,

  // 멤버십
  joinCommunity,
  leaveCommunity,
  applyToJoin,

  // 가입 승인 관리 (RESTRICTED)
  getPendingApplications,
  approveApplication,
  rejectApplication,

  // 초대 링크 관리
  createInvite,
  getInvites,
  revokeInvite,
  getInviteByToken,
  acceptInvite,

  // 게시물
  getCommunityPosts,
  getCommunityPost,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
  togglePostLike,
  votePost,
  incrementPostView,
  // 별칭 (훅에서 사용)
  getPosts: getCommunityPosts,
  getPost: getCommunityPost,
  createPost: createCommunityPost,
  updatePost: updateCommunityPost,
  deletePost: deleteCommunityPost,

  // 댓글
  getCommunityComments,
  createCommunityComment,
  updateCommunityComment,
  deleteCommunityComment,
  toggleCommentLike,
  toggleCommentDislike,
  getCommentReplies,
  // 별칭 (훅에서 사용)
  getComments: getCommunityComments,
  createComment: createCommunityComment,
  updateComment: updateCommunityComment,
  deleteComment: deleteCommunityComment,

  // 규칙
  getCommunityRules,
  createCommunityRule,
  updateCommunityRule,
  deleteCommunityRule,

  // 플레어
  getCommunityFlairs,
  createCommunityFlair,
  updateCommunityFlair,
  deleteCommunityFlair,

  // 멤버 관리
  getCommunityMembers,
  updateMemberRole,
  transferOwnership,
  banMember,
  unbanMember,
  getCommunityBans,

  // 모더레이션
  togglePostPin,
  togglePostLock,
  removePost,
  approvePost,
  lockCommunityAdmin,
  unlockCommunityAdmin,
  getCommunityRecoverySnapshots,
  captureCommunityRecoverySnapshot,
  restoreCommunitySnapshot,

  // 이미지 업로드
  uploadCommunityImage,

  // 위젯
  getCommunityWidgets: getCommunityWidgetsApi,
  getManageCommunityWidgets: getManageCommunityWidgetsApi,
  createCommunityWidget: createCommunityWidgetApi,
  updateCommunityWidget: updateCommunityWidgetApi,
  deleteCommunityWidget: deleteCommunityWidgetApi,
  reorderCommunityWidgets: reorderCommunityWidgetsApi,
  uploadCommunityWidgetImage: uploadCommunityWidgetImageApi,
};
