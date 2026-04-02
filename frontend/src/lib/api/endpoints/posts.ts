/**
 * 포스트 관련 API 엔드포인트
 * @description 블로그 포스트 CRUD 및 좋아요 기능
 */

import { validate as isUUID } from 'uuid';
import type { ApiClient } from '../client';
import type {
  Post,
  PostForm,
  PaginatedResponse
} from '../types';
import type { VoteType, VoteResponse } from '@/types';

/**
 * 커서 페이지네이션 응답 타입
 */
export interface CursorResponse<T> {
  posts: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 포스트 조회 파라미터
 */
export interface GetPostsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  blogSlug?: string;  // 블로그 alias (@alias 형식)
  blogId?: string;    // 블로그 UUID
}

/**
 * 커서 페이지네이션 포스트 조회 파라미터
 */
export interface GetPostsCursorParams {
  cursor?: string;     // Base64 encoded cursor
  limit?: number;      // 페이지당 포스트 수 (기본값: 20, 최대: 50)
  sort?: 'recent' | 'popular' | 'trending';
  category?: string;   // 카테고리 필터
  tag?: string;        // 태그 필터
  blogSlug?: string;    // 블로그 alias 필터
  blogId?: string;      // 블로그 UUID 필터
  search?: string;     // 검색어
  postType?: 'blog' | 'product';  // 포스트 유형 필터
}

/**
 * 포스트 API 클래스
 * @description 포스트 관련 모든 API 메서드
 */
export class PostsAPI {
  constructor(private client: ApiClient) {}

  /**
   * 포스트 목록 조회
   * @param params - 조회 파라미터 (페이지, 검색어, 카테고리 등)
   * @returns 페이지네이션된 포스트 목록
   */
  async getPosts(params?: GetPostsParams): Promise<PaginatedResponse<Post>> {
    return this.client.get<PaginatedResponse<Post>>('/posts', { params });
  }

  /**
   * 커서 기반 포스트 목록 조회
   * @param params - 조회 파라미터 (커서, 정렬, 필터 등)
   * @returns 커서 페이지네이션된 포스트 목록
   */
  async getPostsCursor(params?: GetPostsCursorParams): Promise<CursorResponse<Post>> {
    return this.client.get<CursorResponse<Post>>('/posts/cursor', { params });
  }

  /**
   * ID로 포스트 조회
   * @param id - 포스트 ID
   * @returns 포스트 상세 정보
   */
  async getPost(id: string): Promise<Post> {
    return this.client.get<Post>(`/posts/${id}`);
  }

  /**
   * 슬러그 또는 ID로 포스트 조회
   * @param slugOrId - 포스트 슬러그 (URL 친화적 제목) 또는 UUID
   * @returns 포스트 상세 정보
   * @description UUID인 경우 /posts/:id, 슬러그인 경우 /posts/slug/:slug 엔드포인트 사용
   */
  async getPostBySlug(
    slugOrId: string,
    options?: { fresh?: boolean },
  ): Promise<Post> {
    const queryString = options?.fresh ? "?fresh=1" : "";

    // UUID 검증: UUID면 ID 엔드포인트, 아니면 slug 엔드포인트 사용
    if (isUUID(slugOrId)) {
      return this.client.get<Post>(`/posts/${slugOrId}${queryString}`);
    }
    return this.client.get<Post>(`/posts/slug/${slugOrId}${queryString}`);
  }

  /**
   * 포스트 생성
   * @param data - 포스트 생성 데이터
   * @returns 생성된 포스트
   * @description 로그인한 사용자의 블로그에 포스트 생성
   */
  async createPost(data: PostForm): Promise<Post> {
    return this.client.post<Post>('/posts', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 포스트 수정
   * @param id - 수정할 포스트 ID
   * @param data - 수정할 데이터 (부분 업데이트 가능)
   * @returns 수정된 포스트
   * @description 본인의 포스트만 수정 가능
   */
  async updatePost(id: string, data: Partial<PostForm>): Promise<Post> {
    // FormData 대신 JSON으로 전송 (NestJS 파싱 문제 해결)
    return this.client.patch<Post>(`/posts/${id}`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async updatePostVisibility(
    id: string,
    visibility: 'public' | 'private',
    version?: number,
  ): Promise<Post> {
    return this.client.patch<Post>(`/posts/${id}/visibility`, {
      visibility,
      ...(typeof version === 'number' ? { version } : {}),
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 포스트 삭제
   * @param id - 삭제할 포스트 ID
   * @description 본인의 포스트만 삭제 가능
   */
  async deletePost(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}`);
  }

  /**
   * 포스트 좋아요 토글
   * @param id - 포스트 ID
   * @returns 좋아요 상태 (queued: Redis 큐에 들어갔는지 여부, likeCount: 현재 좋아요 수)
   * @description 좋아요/좋아요 취소 토글 (Redis 큐 시스템 사용)
   * @deprecated vote 메서드 사용 권장
   */
  async toggleLike(id: string): Promise<{ liked: boolean; queued?: boolean; likeCount?: number }> {
    return this.client.post<{ liked: boolean; queued?: boolean; likeCount?: number }>(`/posts/${id}/like`);
  }

  /**
   * 포스트 투표 (Upvote/Downvote)
   * @param id - 포스트 ID
   * @param voteType - 투표 타입 ('upvote' | 'downvote')
   * @returns 투표 결과 (action, userVote, upvoteCount, downvoteCount, score)
   * @description Reddit 스타일 투표 시스템
   * - 같은 투표 다시 클릭: 취소
   * - 다른 투표 클릭: 변경
   */
  async vote(id: string, voteType: NonNullable<VoteType>): Promise<VoteResponse> {
    return this.client.post<VoteResponse>(`/posts/${id}/vote`, { type: voteType });
  }

  /**
   * 좋아요 상태 배치 업데이트
   * @param batch - 포스트 ID와 좋아요 상태 맵
   * @description 여러 포스트의 좋아요 상태를 한번에 서버로 전송
   * @todo 실제 백엔드 엔드포인트 구현 필요
   */
  async batchUpdateLikes(batch: Record<string, boolean>): Promise<void> {
    // TODO: 백엔드 구현 후 실제 API 호출로 변경
    // return this.client.post('/posts/likes/batch', { batch });

    // 현재는 임시로 빈 Promise 반환
    console.warn('batchUpdateLikes: 백엔드 구현 대기 중', batch);
    return Promise.resolve();
  }
}

/**
 * PostsAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns PostsAPI 인스턴스
 */
export function createPostsAPI(client: ApiClient): PostsAPI {
  return new PostsAPI(client);
}
