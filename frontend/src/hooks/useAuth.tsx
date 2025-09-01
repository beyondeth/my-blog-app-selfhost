"use client";

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  User, 
  AuthResponse,
  AuthContextType,
  LoginForm, 
  RegisterForm,
  Role
} from '../types/index';
import { apiClient } from '../lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: any, defaultMessage: string) => {
    console.error(defaultMessage, error);
    
    let errorMessage = defaultMessage;
    
    if (error.statusCode === 401) {
      errorMessage = '인증에 실패했습니다. 다시 로그인해주세요.';
    } else if (error.statusCode === 409) {
      // 409 에러는 서버에서 구체적인 메시지를 보내므로 그대로 사용
      errorMessage = error.message || '이미 사용 중인 정보입니다.';
    } else if (error.statusCode === 400) {
      errorMessage = '입력 정보를 확인해주세요.';
    } else if (error.statusCode === 500) {
      errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.statusCode === 429) {
      errorMessage = '너무 많은 시도를 했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    throw new Error(errorMessage);
  }, []);

  const checkAuth = useCallback(async () => {
    if (!mounted) return;

    try {
      // API 호출로 실제 인증 상태 확인
      try {
        const userData = await apiClient.getProfile();
        setUser(userData);
        
        // 사용자 정보는 메모리에만 저장 (보안)
      } catch (apiError: any) {
        // 401 에러면 인증되지 않은 상태
        if (apiError.statusCode === 401) {
          setUser(null);
          if (mounted) {
            // 기존 토큰 정리 (legacy)
            if (mounted && typeof window !== 'undefined') {
              localStorage.removeItem('access_token');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          }
        } else {
          // 네트워크 에러 등의 경우 localStorage 데이터 유지
          console.error('Auth check failed with non-401 error:', apiError);
          // 이미 user 상태가 있으면 유지 (localStorage에서 로드한 상태)
          // 없을 때만 null로 설정
          if (!user) {
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // 네트워크 에러시 기존 상태 유지
      if (!user) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [mounted, user]);

  useEffect(() => {
    checkAuth();
  }, [mounted]);

  const login = useCallback(async (credentials: LoginForm) => {
    try {
      clearError();
      setIsLoading(true);
      
      const response = await apiClient.login(credentials);
      setUser(response.user);
      
      // 로그인 성공 - 메모리에만 저장
      
      // 로그인 성공 후 블로그 정보 새로고침을 위한 이벤트 발생
      setTimeout(() => {
        window.dispatchEvent(new Event('userBlogRefresh'));
      }, 500);
    } catch (error) {
      handleError(error, '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [mounted, clearError, handleError]);

  const register = useCallback(async (userData: RegisterForm) => {
    try {
      clearError();
      setIsLoading(true);
      
      const response = await apiClient.register(userData);
      setUser(response.user);
      
      // 로그인 성공 - 메모리에만 저장
      
      // 회원가입 성공 후 블로그 정보 새로고침을 위한 이벤트 발생
      // 약간의 지연을 두어 블로그 생성이 완료되도록 함
      setTimeout(() => {
        window.dispatchEvent(new Event('userBlogRefresh'));
      }, 1000);
    } catch (error) {
      handleError(error, '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [mounted, clearError, handleError]);

  const logout = useCallback(async (redirectTo?: string) => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      if (mounted) {
        // 기존 데이터 정리
        if (mounted && typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        if (redirectTo) {
          window.location.href = redirectTo;
        }
      }
    }
  }, [mounted]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiClient.getProfile();
      setUser(userData);
      
      // 메모리에만 저장
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  }, [mounted, logout]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === Role.ADMIN,
    login,
    register,
    logout,
    refreshUser,
    checkAuth,
    clearError,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 