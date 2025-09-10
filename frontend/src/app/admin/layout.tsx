'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Shield, AlertCircle } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const MAX_LOGIN_ATTEMPTS = 5;
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

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
        // Admin이어도 재인증 필요 (2중 보안)
        // 항상 로그인 화면을 보여줌
        setIsAuthenticated(false);
        setIsAdmin(false);
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
        toast.error('관리자 권한이 필요합니다. 일반 사용자는 접근할 수 없습니다.');
        // 일반 사용자는 홈으로 리다이렉트
        setTimeout(() => {
          router.push('/');
        }, 1500);
        return;
      }
      
      // Do NOT store sensitive data in localStorage
      // Session is managed via HttpOnly cookies
      
      toast.success('관리자 로그인 성공!');
      setIsAuthenticated(true);
      setIsAdmin(true);
      
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
            {loginAttempts >= MAX_LOGIN_ATTEMPTS && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  Too many failed login attempts. Please contact system administrator.
                </div>
              </div>
            )}
            {loginAttempts > 2 && loginAttempts < MAX_LOGIN_ATTEMPTS && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
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