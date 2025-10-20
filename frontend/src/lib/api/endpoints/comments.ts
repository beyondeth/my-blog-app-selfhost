/**
 * 댓글 관련 API 엔드포인트
 * @description 포스트 댓글 CRUD 및 좋아요/싫어요 기능
 */

import type { ApiClient } from '../client';
import type { Comment, CommentForm } from '../types';

/**
 * 댓글 좋아요/싫어요 응답
 */
export interface CommentReactionResponse {
  liked?: boolean;
  disliked?: boolean;
  likesCount: number;
  dislikesCount: number;
}

/**
 * 페이지네이션된 댓글 응답
 */
export interface PaginatedCommentsResponse {
  comments: Comment[];
  nextCursor: string | null;
  hasNextPage: boolean;
  totalCount?: number;
  snapshotTimestamp?: string;
}

/**
 * 댓글 페이지네이션 쿼리 파라미터
 */
export interface GetCommentsParams {
  cursor?: string;
  limit?: number;
  sort?: 'recent' | 'popular';
  snapshotTimestamp?: string;
}

/**
 * 답글 페이지네이션 쿼리 파라미터
 */
export interface GetRepliesParams {
  cursor?: string;
  limit?: number;
}

/**
 * 댓글 API 클래스
 * @description 댓글 관련 모든 API 메서드
 */
export class CommentsAPI {
  constructor(private client: ApiClient) {}

  /**
   * 포스트의 댓글 목록 조회
   * @param postId - 포스트 ID
   * @returns 댓글 목록
   * @description 계층형 댓글 구조 지원
   */
  async getComments(postId: string): Promise<Comment[]> {
    return this.client.get<Comment[]>(`/comments/post/${postId}`);
  }

  /**
   * 댓글 작성
   * @param data - 댓글 작성 데이터
   * @returns 생성된 댓글
   * @description 로그인한 사용자만 작성 가능
   */
  async createComment(data: CommentForm): Promise<Comment> {
    return this.client.post<Comment>('/comments', data);
  }

  /**
   * 댓글 수정
   * @param id - 수정할 댓글 ID
   * @param content - 수정할 내용
   * @returns 수정된 댓글
   * @description 본인의 댓글만 수정 가능
   */
  async updateComment(id: string, content: string): Promise<Comment> {
    return this.client.put<Comment>(`/comments/${id}`, { content });
  }

  /**
   * 댓글 삭제
   * @param id - 삭제할 댓글 ID
   * @description 본인의 댓글만 삭제 가능
   */
  async deleteComment(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}`);
  }

  /**
   * 댓글 좋아요 토글
   * @param id - 댓글 ID
   * @returns 좋아요 상태 및 카운트
   * @description 좋아요와 싫어요는 상호 배타적
   */
  async toggleCommentLike(id: string): Promise<CommentReactionResponse> {
    return this.client.post<CommentReactionResponse>(`/comments/${id}/like`);
  }

  /**
   * 댓글 싫어요 토글
   * @param id - 댓글 ID
   * @returns 싫어요 상태 및 카운트
   * @description 좋아요와 싫어요는 상호 배타적
   */
  async toggleCommentDislike(id: string): Promise<CommentReactionResponse> {
    return this.client.post<CommentReactionResponse>(`/comments/${id}/dislike`);
  }

  // ============================================================
  // 페이지네이션 API (5,000명+ 커뮤니티 최적화)
  // ============================================================

  /**
   * 부모 댓글 페이지네이션 조회
   * @param postId - 포스트 ID
   * @param params - 페이지네이션 파라미터
   * @returns 페이지네이션된 댓글 목록
   * @description 커서 기반 무한 스크롤 지원
   */
  async getCommentsPaginated(
    postId: string,
    params?: GetCommentsParams,
  ): Promise<PaginatedCommentsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.snapshotTimestamp) queryParams.append('snapshotTimestamp', params.snapshotTimestamp);

    const queryString = queryParams.toString();
    const url = `/comments/post/${postId}/paginated${queryString ? `?${queryString}` : ''}`;

    return this.client.get<PaginatedCommentsResponse>(url);
  }

  /**
   * 답글 페이지네이션 조회
   * @param commentId - 부모 댓글 ID
   * @param params - 페이지네이션 파라미터
   * @returns 페이지네이션된 답글 목록
   * @description 특정 부모 댓글의 답글만 조회
   */
  async getRepliesPaginated(
    commentId: string,
    params?: GetRepliesParams,
  ): Promise<PaginatedCommentsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/comments/${commentId}/replies${queryString ? `?${queryString}` : ''}`;

    return this.client.get<PaginatedCommentsResponse>(url);
  }
}

/**
 * CommentsAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns CommentsAPI 인스턴스
 */
export function createCommentsAPI(client: ApiClient): CommentsAPI {
  return new CommentsAPI(client);
}