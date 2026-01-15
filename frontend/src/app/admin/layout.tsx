'use client';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Shield, AlertCircle } from 'lucide-react';

// Admin 재인증 세션 키 (브라우저 탭 닫으면 자동 삭제)
const ADMIN_SESSION_KEY = 'admin_reauth_verified';
const ADMIN_SESSION_TIMESTAMP_KEY = 'admin_session_timestamp';
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000; // 30분 타임아웃

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const MAX_LOGIN_ATTEMPTS = 5;
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/me`,
          {
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (!data) {
            setIsAuthenticated(false);
            setIsAdmin(false);
            return;
          }

          // Session Storage에서 재인증 플래그와 타임스탬프 확인
          const isReauthVerified = sessionStorage.getItem(ADMIN_SESSION_KEY);
          const sessionTimestamp = sessionStorage.getItem(ADMIN_SESSION_TIMESTAMP_KEY);

          // 세션 타임아웃 검사
          const now = Date.now();
          const isSessionExpired = sessionTimestamp &&
            (now - parseInt(sessionTimestamp)) > ADMIN_SESSION_TIMEOUT;

          if (isSessionExpired) {
            // 세션 만료 - 클린업하고 재인증 필요
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            sessionStorage.removeItem(ADMIN_SESSION_TIMESTAMP_KEY);
            setSessionExpired(true); // 세션 만료 상태 설정
          }

          if (data.role === 'admin' && isReauthVerified && !isSessionExpired) {
            // Admin 재인증 완료 상태 & 세션 유효 → 자동 접근 허용
            setIsAuthenticated(true);
            setIsAdmin(true);
          } else if (data.role === 'admin' && (!isReauthVerified || isSessionExpired)) {
            // Admin이지만 재인증 필요 (2중 보안) 또는 세션 만료
            setIsAuthenticated(false);
            setIsAdmin(false);
          } else {
            // 일반 사용자 → 조용히 홈으로 리다이렉트 (메시지 없이)
            router.push('/');
          }
        } else {
          // 로그인 안 된 경우 - 로그인 화면 표시
          setIsAuthenticated(false);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogin = async () => {
    // Check for too many failed attempts
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      toast.error('Too many failed attempts. Please try again later.');
      return;
    }

    // Basic client-side validation
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoginLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/login`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      // Server should verify admin role
      if (data.user.role !== 'admin') {
        // 일반 사용자는 조용히 홈으로 리다이렉트 (메시지 없이)
        router.push('/');
        return;
      }

      // Admin 재인증 성공 → Session Storage에 플래그와 타임스탬프 저장
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      sessionStorage.setItem(ADMIN_SESSION_TIMESTAMP_KEY, Date.now().toString());

      // Do NOT store sensitive data in localStorage
      // Session is managed via HttpOnly cookies

      toast.success('관리자 로그인 성공!');
      setIsAuthenticated(true);
      setIsAdmin(true);
      setSessionExpired(false); // 세션 만료 상태 리셋
      
      // Clear form data after successful login
      setEmail('');
      setPassword('');
      
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to login');
      
      // Increment failed login attempts
      setLoginAttempts(prev => prev + 1);
      
      // Clear password on failed login
      setPassword('');
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionExpired && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  관리자 세션이 만료되었습니다. 다시 로그인해주세요.
                </div>
              </div>
            )}
            {loginAttempts >= MAX_LOGIN_ATTEMPTS && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  Too many failed login attempts. Please contact system administrator.
                </div>
              </div>
            )}
            {loginAttempts > 2 && loginAttempts < MAX_LOGIN_ATTEMPTS && (
              <div className="bg-muted/50 border border-border rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-foreground">
                  {MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loginLoading || !email || !password || loginAttempts >= MAX_LOGIN_ATTEMPTS}
              className="w-full"
            >
              {loginLoading ? 'Logging in...' : 'Login as Admin'}
            </Button>
            <div className="text-xs text-gray-500 text-center">
              <p>Secure login with HttpOnly cookies</p>
              <p>Session expires after 24 hours</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
