'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiLock, FiEye, FiEyeOff, FiShield, FiCheck, FiAlertCircle } from 'react-icons/fi';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from '@/app/settings/theme';
import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthWidth, isCommonPassword, containsUserInfo } from '@/lib/password-utils';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';

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
  const [passwordStrength, setPasswordStrength] = useState<any>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // 비밀번호 실시간 검증
  useEffect(() => {
    if (passwordForm.newPassword) {
      const validation = validatePasswordStrength(passwordForm.newPassword);
      setPasswordStrength(validation);

      // 에러 메시지 수집
      const errors: string[] = [];

      // 기본 검증
      if (!validation.hasMinLength) {
        errors.push('At least 8 characters');
      }
      if (!validation.hasUpperCase) {
        errors.push('Uppercase letter');
      }
      if (!validation.hasLowerCase) {
        errors.push('Lowercase letter');
      }
      if (!validation.hasNumber) {
        errors.push('Number');
      }
      if (validation.hasForbiddenChars) {
        errors.push('Forbidden character');
      }

      // 추가 보안 검증
      if (isCommonPassword(passwordForm.newPassword)) {
        errors.push('Too common');
      }

      if (containsUserInfo(passwordForm.newPassword, user?.email, user?.username)) {
        errors.push('Contains personal info');
      }

      setPasswordErrors(errors);
    } else {
      setPasswordStrength(null);
      setPasswordErrors([]);
    }
  }, [passwordForm.newPassword, user]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1차 방어: 이미 처리 중이면 무시
    if (loading) {
      return;
    }

    // 비밀번호 일치 확인
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    // 비밀번호 강도 검증
    if (passwordForm.newPassword) {
      const validation = validatePasswordStrength(passwordForm.newPassword);

      // 백엔드와 동일한 기본 요구사항 확인 (대문자, 소문자, 숫자)
      if (!validation.hasMinLength) {
        setError('Your password must be at least 8 characters long.');
        return;
      }
      if (!validation.hasUpperCase || !validation.hasLowerCase || !validation.hasNumber) {
        setError('Your password must include at least one uppercase letter, one lowercase letter, and one number.');
        return;
      }
      if (validation.hasForbiddenChars) {
        setError('Your password contains unsupported characters: " \' \\ < > ` or spaces.');
        return;
      }

      // 추가 보안 검증
      if (isCommonPassword(passwordForm.newPassword)) {
        setError('This password is too common.');
        return;
      }

      if (containsUserInfo(passwordForm.newPassword, user?.email, user?.username)) {
        setError('Your password cannot include personal information.');
        return;
      }
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
        throw new Error(error.message || 'Failed to change the password.');
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordStrength(null);
      setPasswordErrors([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };


  if (!user) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300`}>
          Please sign in to continue.
        </div>
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
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/assets/auth_icons/google/web_light_rd_na.svg" 
                alt="Google" 
                width={24} 
                height={24}
                className="rounded-full"
              />
            </>
          ),
          name: 'Google',
          color: 'text-[#4285F4]'
        };
      case 'kakao':
        return {
          icon: (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/assets/auth_icons/kakao/kakaologin.png" 
                alt="Kakao" 
                width={24} 
                height={24}
                className="rounded-full"
              />
            </>
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
          icon: <FiLock className="h-5 w-5 text-gray-600 dark:text-gray-300" />,
          name: 'Email and password',
          color: 'text-gray-600 dark:text-gray-300'
        };
    }
  };

  const authInfo = getAuthProviderInfo();

  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-2 pt-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Security</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Strengthen and manage your account security.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6`}>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Sign-in method</h3>
          <div className="flex items-start sm:items-center gap-3">
            {authInfo.icon}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Using {authInfo.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300">{user.email}</p>
            </div>
          </div>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Security status</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <FiCheck className="h-4 w-4 text-emerald-500" />
              Email verified
            </div>
            <div className="flex items-center gap-2">
              <FiShield className="h-4 w-4 text-blue-500" />
              Active sessions: 1
            </div>
            {user.authProvider && user.authProvider !== 'local' && (
              <div className="flex items-center gap-2">
                {authInfo.icon}
                <span>{authInfo.name} connected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {(!user.authProvider || user.authProvider === 'local') ? (
        <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-4`}>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Change password</h3>
              <p className="text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300 mt-1">Set a stronger password for your account.</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    id="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className={`${SETTINGS_INPUT_CLASS} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center text-gray-400"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className={`${SETTINGS_INPUT_CLASS} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center text-gray-400"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>

                {passwordStrength && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300 mb-1">
                      <span>Password strength</span>
                      <span className="text-gray-700 dark:text-gray-300">{passwordStrength.scoreLabel}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-[#2F3440] rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${getPasswordStrengthColor(passwordStrength.scoreClass)}`}
                        style={{ width: `${getPasswordStrengthWidth(passwordStrength.scoreClass)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 p-3 rounded-xl border border-gray-100 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F2229]">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Password requirements</p>
                  <div className="space-y-1">
                    <div className={`flex items-center text-xs ${passwordStrength?.hasMinLength ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-300 dark:text-gray-300'}`}>
                      <FiCheck className={`mr-1 ${passwordStrength?.hasMinLength ? 'block' : 'hidden'}`} />
                      <span className={passwordStrength?.hasMinLength ? 'line-through' : ''}>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center text-xs ${passwordStrength?.hasUpperCase ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-300 dark:text-gray-300'}`}>
                      <FiCheck className={`mr-1 ${passwordStrength?.hasUpperCase ? 'block' : 'hidden'}`} />
                      <span className={passwordStrength?.hasUpperCase ? 'line-through' : ''}>Uppercase letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center text-xs ${passwordStrength?.hasLowerCase ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-300 dark:text-gray-300'}`}>
                      <FiCheck className={`mr-1 ${passwordStrength?.hasLowerCase ? 'block' : 'hidden'}`} />
                      <span className={passwordStrength?.hasLowerCase ? 'line-through' : ''}>Lowercase letter (a-z)</span>
                    </div>
                    <div className={`flex items-center text-xs ${passwordStrength?.hasNumber ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-300 dark:text-gray-300'}`}>
                      <FiCheck className={`mr-1 ${passwordStrength?.hasNumber ? 'block' : 'hidden'}`} />
                      <span className={passwordStrength?.hasNumber ? 'line-through' : ''}>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center text-xs ${passwordStrength?.hasSpecialChar ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-300 dark:text-gray-300'}`}>
                      <FiCheck className={`mr-1 ${passwordStrength?.hasSpecialChar ? 'block' : 'hidden'}`} />
                      <span className={passwordStrength?.hasSpecialChar ? 'line-through' : ''}>Special character (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>

                {passwordErrors.length > 0 && (
                  <div className={`mt-3 rounded-xl p-3 ${DESTRUCTIVE_SURFACE_CLASS}`}>
                    <p className="text-xs font-semibold text-[#7A271A] dark:text-red-200 mb-1">Needs attention</p>
                    <ul className="text-xs text-[#7A271A] dark:text-red-200 space-y-0.5">
                      {passwordErrors.map((error, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300">Use at least 8 characters with uppercase, lowercase, and numbers.</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className={`${SETTINGS_INPUT_CLASS} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center min-w-[44px] justify-center text-gray-400"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  onClick={(e) => {
                    if (loading) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
      ) : (
        <div className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6`}>
          <div className="flex items-start gap-3">
            <FiAlertCircle className="h-5 w-5 text-gray-500 dark:text-gray-300 dark:text-gray-300 mt-0.5" />
            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Social sign-in active</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 mt-1">
                  You signed in with {authInfo.name}. Your password is managed by {authInfo.name}.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F2229] p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Security tips</p>
                <ul className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300 space-y-1 list-disc list-inside">
                  <li>Enable two-factor authentication on your {authInfo.name} account.</li>
                  <li>Review your {authInfo.name} security settings regularly.</li>
                  <li>Watch for suspicious sign-in activity.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${DESTRUCTIVE_SURFACE_CLASS}`}>
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          Security settings were updated successfully.
        </div>
      )}
    </div>
  );
}
