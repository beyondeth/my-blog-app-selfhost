'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiMail, FiCalendar, FiShield, FiUser, FiAlertTriangle, FiLoader, FiBell } from 'react-icons/fi';
import { format } from 'date-fns';
import Image from 'next/image';
import { normalizeImageUrl } from '@/utils/imageUtils';
import CharacterSelector from '@/components/settings/CharacterSelector';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';
import { cn } from '@/lib/utils';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';
import { Switch } from '@/components/ui/switch';
import { LevelBadge } from '@/components/ui/LevelBadge';

const BIO_MAX_LENGTH = 500;
type MarketingPreferenceKey = 'marketingOptIn' | 'newsletterOptIn';

const SUMMARY_CARD_CLASS =
  'rounded-[32px] border border-gray-100 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-[#262626] dark:border-[#4B5563] dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)]';

export default function ProfileSettingsPage() {
  const { user, isLoading: authLoading, refreshUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
    jobTitle: '',
  });
  const [marketingPreferences, setMarketingPreferences] = useState({
    marketingOptIn: false,
    newsletterOptIn: false,
  });
  const [marketingFeedback, setMarketingFeedback] = useState<Partial<Record<MarketingPreferenceKey, { type: 'success' | 'error'; message: string }>>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState(''); // Task 26: 계정 삭제 확인 텍스트
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const marketingFeedbackTimers = useRef<Partial<Record<MarketingPreferenceKey, NodeJS.Timeout>>>({});

  useEffect(() => {
    // user가 있고 실제 데이터(email)가 있을 때만 업데이트 (깜빡임 방지)
    if (user?.email) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
        jobTitle: user.jobTitle || '',
      });
      setMarketingPreferences({
        marketingOptIn: user.marketingOptIn || false,
        newsletterOptIn: user.newsletterOptIn || false,
      });
      if (user.profileImage) {
        // normalizeImageUrl 사용 (CDN 지원)
        setProfileImageUrl(normalizeImageUrl(user.profileImage));
      }
    }
  }, [user]);

  // 컴포넌트 언마운트 시 에러 상태 초기화
  useEffect(() => {
    return () => {
      setError('');
      setUsernameError('');
    };
  }, []);

  useEffect(() => {
    const timersRef = marketingFeedbackTimers.current;
    return () => {
      Object.values(timersRef).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
    // timersRef intentionally captures current reference for cleanup
  }, []);

  const pushMarketingFeedback = (key: MarketingPreferenceKey, type: 'success' | 'error', message: string) => {
    if (marketingFeedbackTimers.current[key]) {
      clearTimeout(marketingFeedbackTimers.current[key]);
    }

    setMarketingFeedback((prev) => ({
      ...prev,
      [key]: { type, message },
    }));

    marketingFeedbackTimers.current[key] = setTimeout(() => {
      setMarketingFeedback((prev) => {
        if (!prev[key] || prev[key]?.message !== message) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
      marketingFeedbackTimers.current[key] = undefined;
    }, 4000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('Only image files can be uploaded.');
      return;
    }

    setUploadingImage(true);
    setError('');
    setUsernameError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/files/v2/profile/avatar`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload the image.');
      }

      const result = await response.json();

      // CDN URL 또는 S3 키 처리
      if (result.s3Key) {
        setProfileImageUrl(normalizeImageUrl(result.s3Key));
      }

      // 사용자 정보 새로고침 (백그라운드에서 진행)
      // refreshUser가 호출되면 useEffect가 실행되어 새로운 이미지가 자동으로 설정됨
      await refreshUser();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong while uploading the image.');
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * 캐릭터 선택 핸들러
   * 사용자가 CharacterSelector에서 캐릭터를 선택하면 프로필 이미지 업데이트
   */
  const handleSelectCharacter = async (characterPath: string) => {
    setError('');
    setUsernameError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            profileImage: characterPath,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update the profile image.');
      }

      // 로컬 상태 업데이트 (즉시 반영)
      setProfileImageUrl(characterPath);

      // 사용자 정보 새로고침 (백그라운드에서 진행)
      await refreshUser();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong while selecting an avatar.');
      throw err; // CharacterSelector에서 에러 처리
    }
  };

  /**
   * 마케팅 정보 수신 설정 변경 핸들러
   * 토글 변경 시 즉시 API 호출하여 백엔드 업데이트
   */
  const handleMarketingPreferenceChange = async (key: MarketingPreferenceKey, nextValue: boolean, label: string) => {
    const payload = {
      [key]: nextValue,
    } as Partial<typeof marketingPreferences>;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/marketing-preferences`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Marketing preference update failed:', error.message);
        throw new Error(error.message || 'Failed to update your email preference.');
      }

      await refreshUser();
      setMarketingPreferences((prev) => ({ ...prev, [key]: nextValue }));
      pushMarketingFeedback(
        key,
        'success',
        `${label} ${nextValue ? 'enabled' : 'disabled'}.`
      );
    } catch (err: any) {
      if (user) {
        setMarketingPreferences({
          marketingOptIn: user.marketingOptIn || false,
          newsletterOptIn: user.newsletterOptIn || false,
        });
      }
      pushMarketingFeedback(key, 'error', `Could not update ${label}. Please try again.`);
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;

    setError('');
    setUsernameError('');
    setSuccess(false);
    setProfileSaveSuccess(false);

    if (formData.username && formData.username.length < 2) {
      setUsernameError('Username must be at least 2 characters.');
      return;
    }

    const normalizedJobTitle =
      formData.jobTitle.trim().length > 0 ? formData.jobTitle.trim() : null;
    const currentJobTitle = user.jobTitle || null;
    const payload: Record<string, any> = {};

    if (formData.username !== (user.username || '')) {
      payload.username = formData.username;
    }

    if ((formData.bio || '') !== (user.bio || '')) {
      payload.bio = formData.bio;
    }

    if (normalizedJobTitle !== currentJobTitle) {
      payload.jobTitle = normalizedJobTitle;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setProfileSaveLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.message && error.message.toLowerCase().includes('username')) {
          setUsernameError(error.message);
        } else {
          setError(error.message || 'Failed to update your profile.');
        }
        throw new Error(error.message || 'Failed to update your profile.');
      }

      await refreshUser();

      queryClient.invalidateQueries({ queryKey: ['blog'] });
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });

      if (payload.jobTitle !== undefined) {
        setFormData((prev) => ({ ...prev, jobTitle: normalizedJobTitle ?? '' }));
      }

      setSuccess(true);
      setProfileSaveSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setProfileSaveSuccess(false);
      }, 2000);
    } catch (err: any) {
      if (!usernameError) {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      setProfileSaveLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError('');
    setUsernameError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete the account.');
      }

      // 로그아웃 처리 및 홈으로 이동
      await logout('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setDeleteLoading(false);
    }
  };

  const joinedAt = user?.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : null;

  const marketingOptions = [
    {
      key: 'marketingOptIn' as const,
      title: 'Product updates',
      description: 'Receive feature launches and event announcements by email.',
      icon: <FiBell className="h-4 w-4 text-gray-400" />,
    },
    {
      key: 'newsletterOptIn' as const,
      title: 'Newsletter',
      description: 'Get weekly updates and notable community highlights.',
      icon: <FiMail className="h-4 w-4 text-gray-400" />,
    },
  ];

  // 로딩 중이거나 사용자 정보가 없을 때
  if (authLoading) {
    return (
      <div className="space-y-6 pt-2">
        <section className={`${SETTINGS_CARD_CLASS} p-6 text-center`}>
          <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-gray-300">
            <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
            Loading...
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 pt-2">
        <section className={`${SETTINGS_CARD_CLASS} p-6 text-center`}>
          <p className="text-sm text-gray-600 dark:text-gray-300">You need to sign in to view this page.</p>
        </section>
      </div>
    );
  }

  const originalUsername = user.username || '';
  const originalBio = user.bio || '';
  const originalJobTitle = user.jobTitle || '';
  const isProfileDirty =
    formData.username !== originalUsername ||
    formData.bio !== originalBio ||
    formData.jobTitle !== originalJobTitle;

  return (
    <>
      <div className="space-y-6 pt-2">
        {error && !error.toLowerCase().includes('size') && !error.toLowerCase().includes('username') && (
          <div className={cn('p-3 text-sm rounded-xl', DESTRUCTIVE_SURFACE_CLASS)}>
            {error}
          </div>
        )}

        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-6`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full border border-gray-200 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1A1F2B] overflow-hidden flex-shrink-0 shadow-sm">
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="Profile"
                    fill
                    sizes="80px"
                    className="object-cover"
                    priority
                    unoptimized
                    onError={() => setProfileImageUrl(null)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FiUser className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <FiLoader className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  {formData.username || 'Profile'}
                  <LevelBadge userId={user?.id} />
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FiMail className="h-4 w-4 text-gray-400" />
                  <span>{formData.email}</span>
                  {user.isEmailVerified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-[#1f352a] dark:text-emerald-300">
                      <FiCheck className="mr-1 h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                {joinedAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                    <FiCalendar className="h-4 w-4 text-gray-400" />
                    Joined {joinedAt}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className={SETTINGS_SUBTLE_BUTTON_CLASS}
              >
                {uploadingImage ? 'Uploading...' : 'Change image'}
              </button>
              <button
                type="button"
                onClick={() => setShowCharacterSelector(true)}
                disabled={uploadingImage}
                className={SETTINGS_SUBTLE_BUTTON_CLASS}
              >
                Choose avatar
              </button>
            </div>
          </div>
          {error && error.toLowerCase().includes('size') && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </section>

        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-6`}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                Username <span className="text-gray-400 text-xs">(Required)</span>
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, username: value });

                  if (value && value.length < 2) {
                    setUsernameError('Username must be at least 2 characters.');
                  } else if (value && value.length > 30) {
                    setUsernameError('Username must be 30 characters or fewer.');
                  } else {
                    setUsernameError('');
                  }
                }}
                className={`${SETTINGS_INPUT_CLASS} ${
                  usernameError
                    ? 'border-red-300 dark:border-red-500 focus:ring-red-200 dark:focus:ring-red-500/40'
                    : ''
                }`}
                placeholder="Choose the name people will see publicly"
              />
              {usernameError && (
                <p className="text-xs text-red-500 dark:text-red-400">{usernameError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                Job title <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                id="jobTitle"
                value={formData.jobTitle}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 30) {
                    setFormData((prev) => ({ ...prev, jobTitle: value }));
                  }
                }}
                className={SETTINGS_INPUT_CLASS}
                placeholder="Example: Frontend engineer, writer"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
              Bio <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= BIO_MAX_LENGTH) {
                  setFormData((prev) => ({ ...prev, bio: value }));
                }
              }}
              maxLength={BIO_MAX_LENGTH}
              rows={5}
              className={`${SETTINGS_INPUT_CLASS} resize-none`}
              placeholder="Introduce yourself or share what you are working on"
            />
            <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <span>{formData.bio.length}/{BIO_MAX_LENGTH}</span>
              <span>Your username, job title, and bio appear on your public profile.</span>
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-[#2F3440] pt-4 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-xs font-medium ${profileSaveSuccess ? 'text-emerald-600 dark:text-emerald-300' : profileSaveLoading ? 'text-gray-500 dark:text-gray-300' : 'text-gray-500 dark:text-gray-300'}`}>
              {profileSaveSuccess
                ? 'Profile saved.'
                : profileSaveLoading
                ? 'Saving...'
                : isProfileDirty
                ? 'You have unsaved changes.'
                : 'Everything is up to date.'}
            </div>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={!isProfileDirty || profileSaveLoading || usernameError !== ''}
              className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
            >
              {profileSaveLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : profileSaveSuccess ? (
                'Saved'
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className={`${SUMMARY_CARD_CLASS} p-6 space-y-4`}>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">Account overview</p>
            <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
              <FiShield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">You are using an email/password account</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">{formData.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                <FiCheck className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium">Verification</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    {user.isEmailVerified ? 'Email verified' : 'Email verification required'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                <FiBell className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium">Last sign-in method</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    {user.lastLoginProvider ? user.lastLoginProvider : 'local'} account
                  </p>
                </div>
              </div>
            </div>

          <div className={`${SUMMARY_CARD_CLASS} p-6 space-y-5`}>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">Email preferences</p>
            <div className="space-y-4">
                {marketingOptions.map((option) => (
                  <div
                    key={option.key}
                    className="rounded-2xl border border-gray-100 dark:border-[#2F3440] px-4 py-3 space-y-2"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-700 dark:text-gray-200">
                      <div className="flex items-start gap-3">
                        <span className="text-gray-400 mt-0.5">{option.icon}</span>
                        <div>
                          <p className="font-medium">{option.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-300">{option.description}</p>
                        </div>
                      </div>
                        <Switch
                          checked={marketingPreferences[option.key]}
                          onCheckedChange={(checked) =>
                            handleMarketingPreferenceChange(option.key, checked, option.title)
                          }
                        />
                    </div>
                    {marketingFeedback[option.key] && (
                      <p
                        className={`text-xs font-medium ${
                          marketingFeedback[option.key]?.type === 'success'
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {marketingFeedback[option.key]?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        <section className={`${SETTINGS_CARD_CLASS} p-6`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50">Delete account</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Deleting your account permanently removes your posts, comments, uploads, and profile data. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors bg-gray-900 hover:bg-gray-800 dark:bg-[#5f63f3] dark:hover:bg-[#7377ff]"
            >
              Delete account
            </button>
          </div>
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1F2332] border border-gray-100 dark:border-[#2F3440] rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-red-600 dark:text-red-400 w-6 h-6 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Confirm account deletion</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This action is permanent. If you continue, the following data will be deleted:
            </p>

            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-1">
              <li>All blog posts</li>
              <li>All comments</li>
              <li>All uploaded files</li>
              <li>All API keys</li>
              <li>Your profile data</li>
            </ul>

            <div className="mb-6">
              <label htmlFor="deleteConfirmText" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Type <strong className="text-red-600 dark:text-red-400">&quot;DELETE ACCOUNT&quot;</strong> to confirm
              </label>
              <input
                type="text"
                id="deleteConfirmText"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`${SETTINGS_INPUT_CLASS} focus:ring-red-200 dark:focus:ring-red-400`}
                placeholder="DELETE ACCOUNT"
                autoFocus
              />
            </div>

            {(user?.lastLoginProvider === 'local' ||
              (!user?.lastLoginProvider && user?.authProvider === 'local')) && (
              <div className="mb-6">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Password confirmation
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className={`${SETTINGS_INPUT_CLASS} focus:ring-red-200 dark:focus:ring-red-400`}
                  placeholder="Enter your password"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                  Your last sign-in used a local account, so password confirmation is required.
                </p>
              </div>
            )}

            {user?.lastLoginProvider && user.lastLoginProvider !== 'local' && (
              <div className="mb-6 p-3 bg-blue-50 dark:bg-[#1B2C3F] border border-blue-100 dark:border-[#234668] rounded-xl">
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  You last signed in with {user.lastLoginProvider.charAt(0).toUpperCase() + user.lastLoginProvider.slice(1)}.
                  You can delete the account without entering a password.
                </p>
              </div>
            )}

            {error && (
              <div className={cn('mb-4 p-3 text-sm rounded-xl', DESTRUCTIVE_SURFACE_CLASS)}>
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteConfirmText('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-[#2A2F3A] text-gray-800 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#353C49] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteConfirmText !== 'DELETE ACCOUNT' ||
                  ((user?.lastLoginProvider === 'local' ||
                    (!user?.lastLoginProvider && user?.authProvider === 'local')) &&
                    !deletePassword)
                }
                className="flex-1 px-4 py-2 rounded-lg font-semibold text-gray-900 dark:text-gray-50 bg-gray-100 dark:bg-[#2A2F3A] hover:bg-gray-200 dark:hover:bg-[#353C49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CharacterSelector
        isOpen={showCharacterSelector}
        onClose={() => setShowCharacterSelector(false)}
        currentProfileImage={profileImageUrl}
        onSelectCharacter={handleSelectCharacter}
      />
    </>
  );
}
