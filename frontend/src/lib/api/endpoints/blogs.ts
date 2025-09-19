/**
 * 블로그 관련 API 엔드포인트
 * @description 블로그 CRUD 및 관리 기능
 */

import type { ApiClient } from '../client';
import type { PaginatedResponse } from '../types';

/**
 * 블로그 타입 정의
 */
export interface Blog {
  id: string;
  name: string;
  slug: string;
  description?: string;
  userId: string;
  isPrivate: boolean;
  allowComments: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    profileImage?: string;
  };
  _count?: {
    posts: number;
  };
}

/**
 * 블로그 생성/수정 폼
 */
export interface BlogForm {
  name: string;
  slug: string;
  description?: string;
  isPrivate?: boolean;
  allowComments?: boolean;
}

/**
 * 블로그 조회 파라미터
 */
export interface GetBlogsParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * 블로그 API 클래스
 * @description 블로그 관련 모든 API 메서드
 */
export class BlogsAPI {
  constructor(private client: ApiClient) {}

  /**
   * 블로그 목록 조회
   * @param params - 조회 파라미터
   * @returns 페이지네이션된 블로그 목록
   */
  async getBlogs(params?: GetBlogsParams): Promise<PaginatedResponse<Blog>> {
    return this.client.get<PaginatedResponse<Blog>>('/blogs', { params });
  }

  /**
   * 블로그 생성
   * @param data - 블로그 생성 데이터
   * @returns 생성된 블로그
   * @description 사용자당 하나의 블로그만 생성 가능
   */
  async createBlog(data: BlogForm): Promise<Blog> {
    return this.client.post<Blog>('/blogs', data);
  }

  /**
   * 내 블로그 목록 조회
   * @returns 로그인한 사용자의 블로그 목록
   * @description 현재는 사용자당 1개 블로그만 가능
   */
  async getMyBlogs(): Promise<Blog[]> {
    return this.client.get<Blog[]>('/blogs/my-blogs');
  }

  /**
   * 슬러그로 블로그 조회
   * @param slug - 블로그 슬러그
   * @returns 블로그 상세 정보
   * @description 비공개 블로그는 소유자만 조회 가능
   */
  async getBlogBySlug(slug: string): Promise<Blog> {
    return this.client.get<Blog>(`/blogs/slug/${slug}`);
  }

  /**
   * 블로그 수정
   * @param id - 수정할 블로그 ID
   * @param data - 수정할 데이터
   * @returns 수정된 블로그
   * @description 본인의 블로그만 수정 가능
   */
  async updateBlog(id: string, data: Partial<BlogForm>): Promise<Blog> {
    return this.client.patch<Blog>(`/blogs/${id}`, data);
  }

  /**
   * 블로그 삭제
   * @param id - 삭제할 블로그 ID
   * @description 블로그 삭제 시 모든 포스트도 함께 삭제됨
   */
  async deleteBlog(id: string): Promise<void> {
    await this.client.delete(`/blogs/${id}`);
  }
}

/**
 * BlogsAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns BlogsAPI 인스턴스
 */
export function createBlogsAPI(client: ApiClient): BlogsAPI {
  return new BlogsAPI(client);
}