'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiClient, createApiClient, defaultApiClient } from '@/lib/api-client-factory';
import { useAuth } from '@/providers/AuthProviderV2';

interface ApiClientContextType {
  apiClient: ApiClient;
  isUserSpecific: boolean;
}

const ApiClientContext = createContext<ApiClientContextType>({
  apiClient: defaultApiClient,
  isUserSpecific: false,
});

/**
 * ApiClient Provider
 * 사용자별로 독립적인 ApiClient 인스턴스를 제공
 */
export function ApiClientProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [apiClient, setApiClient] = useState<ApiClient>(defaultApiClient);
  const [isUserSpecific, setIsUserSpecific] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (user?.id) {
        // 로그인한 사용자 - 전용 인스턴스 생성
        const userApiClient = createApiClient(user.id);
        setApiClient(userApiClient);
        setIsUserSpecific(true);
      } else {
        // 비로그인 사용자 - 기본 인스턴스 사용
        setApiClient(defaultApiClient);
        setIsUserSpecific(false);
      }
    }
  }, [user?.id, isLoading]);

  return (
    <ApiClientContext.Provider value={{ apiClient, isUserSpecific }}>
      {children}
    </ApiClientContext.Provider>
  );
}

/**
 * ApiClient Context Hook
 * @returns {ApiClientContextType} ApiClient 인스턴스와 메타데이터
 */
export function useApiClient(): ApiClientContextType {
  const context = useContext(ApiClientContext);

  if (!context) {
    throw new Error('useApiClient must be used within an ApiClientProvider');
  }

  return context;
}

/**
 * 편의 함수 - ApiClient 인스턴스만 반환
 * @returns {ApiClient} ApiClient 인스턴스
 */
export function useApi(): ApiClient {
  const { apiClient } = useApiClient();
  return apiClient;
}