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
      setIsLoading(true);
      
      // 쿠키 기반 인증이므로 localStorage 토큰 확인 제거
      // 대신 직접 API를 호출하여 인증 상태 확인
      try {
        const userData = await apiClient.getProfile();
        setUser(userData);
        
        // 사용자 정보만 localStorage에 저장 (UI 성능을 위해)
        if (mounted) {
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (apiError: any) {
        // 401 에러면 인증되지 않은 상태 (정상적인 상황)
        if (apiError.statusCode === 401) {
          setUser(null);
          if (mounted) {
            localStorage.removeItem('user');
            // localStorage에 저장된 기존 토큰들도 제거
            localStorage.removeItem('access_token');
            localStorage.removeItem('token');
          }
          // 401 에러는 로그하지 않음 (정상적인 로그아웃 상태)
        } else {
          // 다른 에러면 저장된 사용자 정보로 복원 시도
          console.error('Auth check failed with non-401 error:', apiError);
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
            } catch (parseError) {
              console.error('Failed to parse stored user data:', parseError);
              setUser(null);
            }
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    checkAuth();
  }, [mounted]);

  const login = useCallback(async (credentials: LoginForm) => {
    try {
      clearError();
      setIsLoading(true);
      
      const response = await apiClient.login(credentials);
      setUser(response.user);
      
      // 사용자 정보만 localStorage에 저장 (쿠키는 백엔드에서 자동 설정)
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      
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
      
      // 사용자 정보만 localStorage에 저장
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      
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
        localStorage.removeItem('user');
        localStorage.removeItem('access_token'); // 기존 토큰 제거
        localStorage.removeItem('token'); // 기존 토큰 제거
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
      
      if (mounted) {
        localStorage.setItem('user', JSON.stringify(userData));
      }
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