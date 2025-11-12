/**
 * 통합 API 클라이언트
 * @description 모든 API 통신을 담당하는 핵심 클라이언트 클래스
 * 팩토리 패턴을 사용하여 각 사용자별 독립적인 인스턴스 생성 가능
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiLogger } from '@/utils/logger';
import type {
  ApiClientConfig,
  ApiError,
  RefreshTokenResponse
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * API 클라이언트 클래스
 * @description SaaS 플랫폼을 위한 멀티 테넌트 지원 API 클라이언트
 * 각 사용자별로 독립적인 인스턴스를 생성하여 격리된 환경 제공
 */
export class ApiClient {
  private client: AxiosInstance;
  private userId?: string;
  private refreshPromise: Promise<void> | null = null;

  /**
   * ApiClient 생성자
   * @param config - API 클라이언트 설정
   */
  constructor(config: ApiClientConfig = {}) {
    this.userId = config.userId;

    // Axios 인스턴스 생성
    this.client = axios.create({
      baseURL: config.baseURL || API_BASE_URL,
      timeout: config.timeout || 10000,
      withCredentials: config.withCredentials !== false, // 기본값 true (쿠키 인증)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 인터셉터 설정
    this.setupInterceptors();
  }

  /**
   * 요청/응답 인터셉터 설정
   * @description 자동 토큰 갱신 및 에러 처리를 위한 인터셉터 구성
   */
  private setupInterceptors(): void {
    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        // 보안 로깅 - 민감한 정보 제외
        apiLogger.apiRequest(
          config.method?.toUpperCase() || 'GET',
          config.url || ''
        );
        return config;
      },
      (error) => {
        apiLogger.error('요청 인터셉터 오류', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        apiLogger.apiResponse(
          response.status,
          response.config.url || ''
        );
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 토큰 갱신을 건너뛰어야 하는 경우
        const skipRefreshUrls = [
          '/auth/login',
          '/auth/register',
          '/auth/refresh',
          '/auth/logout',
        ];

        const shouldSkipRefresh =
          skipRefreshUrls.some(url => originalRequest.url?.includes(url)) ||
          originalRequest._retry ||
          error.response?.status !== 401;

        if (shouldSkipRefresh) {
          return Promise.reject(error);
        }

        // 401 오류 - 토큰 갱신 시도
        return this.handleTokenRefresh(originalRequest, error);
      }
    );
  }

  /**
   * 토큰 갱신 처리
   * @param originalRequest - 원본 요청 설정
   * @param error - 발생한 에러
   * @returns 재시도된 요청 또는 에러
   */
  private async handleTokenRefresh(
    originalRequest: any,
    error: any
  ): Promise<any> {
    originalRequest._retry = true;

    try {
      // 이미 갱신 중이면 대기
      if (this.refreshPromise) {
        await this.refreshPromise;
        return this.client(originalRequest);
      }

      // 토큰 갱신 시작
      this.refreshPromise = this.performTokenRefresh();
      await this.refreshPromise;
      this.refreshPromise = null;

      // 원본 요청 재시도
      return this.client(originalRequest);
    } catch (refreshError) {
      this.refreshPromise = null;
      // 토큰 갱신 실패 - 원본 에러 반환
      return Promise.reject(error);
    }
  }

  /**
   * 실제 토큰 갱신 수행
   * @returns 갱신 완료 Promise
   */
  private async performTokenRefresh(): Promise<void> {
    try {
      await this.client.post<RefreshTokenResponse>('/auth/refresh');
      apiLogger.debug('토큰 갱신 성공');
      // 쿠키가 자동으로 업데이트됨
    } catch (error) {
      apiLogger.error('토큰 갱신 실패');
      throw error;
    }
  }

  /**
   * 에러 처리 및 표준화
   * @param error - Axios 에러 객체
   * @returns 표준화된 API 에러
   */
  private handleError(error: any): ApiError {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // 409 Conflict for check-alias is an expected validation error, not a system error.
    const isAliasCheckConflict = status === 409 && url.includes('/blogs/check-alias/');

    // 401, 404는 정상적인 비즈니스 로직이므로 로그 제외
    if (status !== 401 && status !== 404 && !isAliasCheckConflict) {
      apiLogger.error('API 오류', {
        url: error.config?.url,
        method: error.config?.method,
        status: status,
        response: error.response?.data,
        message: error.response?.data?.message || error.message,
        // 개발 환경에서는 더 상세한 정보
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          config: {
            params: error.config?.params,
            data: error.config?.data,
          }
        })
      });
    }

    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || '오류가 발생했습니다',
      statusCode: status || 500,
      error: error.response?.data?.error,
      details: error.response?.data?.details,
    };

    return apiError;
  }

  /**
   * 범용 요청 메서드
   * @param config - Axios 요청 설정
   * @returns 응답 데이터
   * @throws ApiError
   */
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * GET 요청 헬퍼 메서드
   * @param url - 요청 URL
   * @param config - 추가 설정
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  /**
   * POST 요청 헬퍼 메서드
   * @param url - 요청 URL
   * @param data - 요청 바디 데이터
   * @param config - 추가 설정
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  /**
   * PUT 요청 헬퍼 메서드
   * @param url - 요청 URL
   * @param data - 요청 바디 데이터
   * @param config - 추가 설정
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  /**
   * PATCH 요청 헬퍼 메서드
   * @param url - 요청 URL
   * @param data - 요청 바디 데이터
   * @param config - 추가 설정
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  /**
   * DELETE 요청 헬퍼 메서드
   * @param url - 요청 URL
   * @param config - 추가 설정
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  /**
   * 현재 사용자 ID 반환
   * @returns 사용자 ID 또는 undefined
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Axios 클라이언트 인스턴스 반환 (고급 사용 케이스용)
   * @returns AxiosInstance
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

/**
 * API 클라이언트 팩토리 함수
 * @param config - API 클라이언트 설정
 * @returns 새로운 ApiClient 인스턴스
 */
export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  return new ApiClient(config);
}

/**
 * 기본 API 클라이언트 인스턴스
 * @description 비로그인 사용자 또는 공통 API 호출용
 * 주의: SaaS 환경에서는 가급적 사용자별 인스턴스 사용 권장
 */
export const defaultApiClient = createApiClient();