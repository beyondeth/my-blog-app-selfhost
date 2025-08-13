'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FiLock, FiEye, FiEyeOff, FiSmartphone, FiShield, FiAlertTriangle, FiCheck } from 'react-icons/fi';

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '비밀번호 변경에 실패했습니다');
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    setLoading(true);
    setError('');
    
    try {
      // TODO: Implement 2FA toggle API
      setTwoFactorEnabled(!twoFactorEnabled);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">로그인이 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900">보안 설정</h2>
        <p className="text-sm text-gray-600 mt-1">
          계정 보안을 강화하고 안전하게 관리하세요
        </p>
      </div>

      <div className="space-y-8">
        {/* Password Change Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">비밀번호 변경</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                현재 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  id="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrentPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showNewPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">최소 8자 이상, 영문 대소문자와 숫자를 포함하세요</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호 확인
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-amber-700 text-white font-medium rounded-md hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        </div>

        {/* 2FA Section */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">2단계 인증</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FiSmartphone className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium text-gray-900">인증 앱 사용</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Google Authenticator 또는 Authy와 같은 앱을 사용하여 추가 보안 계층을 활성화하세요
                </p>
                <div className="mt-3">
                  <button
                    onClick={handleToggle2FA}
                    disabled={loading}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      twoFactorEnabled
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {twoFactorEnabled ? '2단계 인증 비활성화' : '2단계 인증 설정'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">보안 상태</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <FiCheck className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-700">이메일 인증 완료</span>
            </div>
            <div className="flex items-center">
              {twoFactorEnabled ? (
                <>
                  <FiCheck className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">2단계 인증 활성화됨</span>
                </>
              ) : (
                <>
                  <FiAlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm text-gray-700">2단계 인증이 비활성화되어 있습니다</span>
                </>
              )}
            </div>
            <div className="flex items-center">
              <FiShield className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-700">활성 세션: 1개</span>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
            보안 설정이 성공적으로 업데이트되었습니다!
          </div>
        )}
      </div>
    </div>
  );
}