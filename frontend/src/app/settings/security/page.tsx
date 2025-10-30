'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiLock, FiEye, FiEyeOff, FiShield, FiCheck, FiAlertCircle } from 'react-icons/fi';

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1차 방어: 이미 처리 중이면 무시
    if (loading) {
      return;
    }

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


  if (!user) {
    return (
      <div className="p-4 sm:p-6 md:p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">로그인이 필요합니다</p>
      </div>
    );
  }

  // 인증 제공자별 아이콘과 이름 매핑
  const getAuthProviderInfo = () => {
    // authProvider가 없거나 null인 경우 처리
    const provider = user.authProvider || 'local';
    
    switch (provider.toLowerCase()) {
      case 'google':
        return {
          icon: (
            <img 
              src="/assets/auth_icons/google/web_light_rd_na.svg" 
              alt="Google" 
              width={24} 
              height={24}
              className="rounded-full"
            />
          ),
          name: 'Google',
          color: 'text-[#4285F4]'
        };
      case 'kakao':
        return {
          icon: (
            <img 
              src="/assets/auth_icons/kakao/kakaologin.png" 
              alt="Kakao" 
              width={24} 
              height={24}
              className="rounded-full"
            />
          ),
          name: 'Kakao',
          color: 'text-[#3A1D1D]'
        };
      case 'github':
        return {
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#24292e">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          ),
          name: 'GitHub',
          color: 'text-[#24292e]'
        };
      case 'local':
      default:
        return {
          icon: <FiLock className="h-5 w-5 text-gray-600" />,
          name: '이메일/비밀번호',
          color: 'text-gray-600'
        };
    }
  };

  const authInfo = getAuthProviderInfo();

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">보안 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          계정 보안을 강화하고 안전하게 관리하세요
        </p>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Authentication Info Section */}
        <div className="bg-gray-50 dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">인증 정보</h3>
          <div className="flex items-start sm:items-center gap-3">
            {authInfo.icon}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {authInfo.name} 계정 사용 중
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Password Change Section - Only for local users */}
        {(!user.authProvider || user.authProvider === 'local') ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">비밀번호 변경</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                현재 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  id="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-12 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center"
                  aria-label={showCurrentPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
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
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                새 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-12 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center"
                  aria-label={showNewPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showNewPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">최소 8자 이상, 영문 대소문자와 숫자를 포함하세요</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                새 비밀번호 확인
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-12 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center"
                  aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                onClick={(e) => {
                  // 2차 방어: 버튼 클릭 시 중복 방지
                  if (loading) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="w-full sm:w-auto sm:ml-auto min-h-[44px] px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        </div>
        ) : (
          /* OAuth Users Security Info */
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-start space-x-3">
              <FiAlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  소셜 로그인 사용 중
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  {authInfo.name} 계정으로 로그인하셨습니다.
                  비밀번호는 {authInfo.name}에서 관리됩니다.
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">보안 강화 팁:</p>
                  <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>{authInfo.name} 계정에서 2단계 인증을 활성화하세요</li>
                    <li>정기적으로 {authInfo.name} 보안 설정을 검토하세요</li>
                    <li>의심스러운 로그인 활동이 있는지 확인하세요</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Status */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">보안 상태</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <FiCheck className="h-5 w-5 text-primary mr-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">이메일 인증 완료</span>
            </div>
            <div className="flex items-center">
              <FiShield className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">활성 세션: 1개</span>
            </div>
            {user.authProvider && user.authProvider !== 'local' && (
              <div className="flex items-center">
                {authInfo.icon}
                <span className="text-sm text-gray-700 dark:text-gray-300 ml-2">{authInfo.name} 계정 연결됨</span>
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md">
            보안 설정이 성공적으로 업데이트되었습니다!
          </div>
        )}
      </div>
    </div>
  );
}