'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiMail, FiCalendar, FiShield, FiUser, FiAlertTriangle, FiLoader, FiBell } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
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
      setError('허용 크기를 초과했습니다 (최대 5MB)');
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다');
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
        throw new Error(error.message || '이미지 업로드에 실패했습니다');
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
      setError(err.message || '이미지 업로드 중 오류가 발생했습니다');
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
        throw new Error(error.message || '프로필 이미지 변경에 실패했습니다');
      }

      // 로컬 상태 업데이트 (즉시 반영)
      setProfileImageUrl(characterPath);

      // 사용자 정보 새로고침 (백그라운드에서 진행)
      await refreshUser();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '캐릭터 선택 중 오류가 발생했습니다');
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
        throw new Error(error.message || '마케팅 정보 수신 설정 업데이트에 실패했습니다');
      }

      await refreshUser();
      setMarketingPreferences((prev) => ({ ...prev, [key]: nextValue }));
      pushMarketingFeedback(
        key,
        'success',
        `${label}이(가) ${nextValue ? '활성화되었습니다.' : '비활성화되었습니다.'}`
      );
    } catch (err: any) {
      if (user) {
        setMarketingPreferences({
          marketingOptIn: user.marketingOptIn || false,
          newsletterOptIn: user.newsletterOptIn || false,
        });
      }
      pushMarketingFeedback(key, 'error', `${label} 변경에 실패했습니다. 잠시 후 다시 시도하세요.`);
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;

    setError('');
    setUsernameError('');
    setSuccess(false);
    setProfileSaveSuccess(false);

    if (formData.username && formData.username.length < 2) {
      setUsernameError('닉네임은 최소 2자 이상 입력하세요');
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
        if (error.message && error.message.includes('닉네임')) {
          setUsernameError(error.message);
        } else {
          setError(error.message || '프로필 업데이트에 실패했습니다');
        }
        throw new Error(error.message || '프로필 업데이트에 실패했습니다');
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
        setError(err.message || '오류가 발생했습니다');
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
        throw new Error(error.message || '계정 삭제에 실패했습니다');
      }

      // 로그아웃 처리 및 홈으로 이동
      await logout('/');
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
      setDeleteLoading(false);
    }
  };

  const joinedAt =
    user?.createdAt ? format(new Date(user.createdAt), 'yyyy년 M월 d일', { locale: ko }) : null;

  const marketingOptions = [
    {
      key: 'marketingOptIn' as const,
      title: '마케팅 정보 수신',
      description: '새로운 기능과 이벤트 소식을 이메일로 받아보세요.',
      icon: <FiBell className="h-4 w-4 text-gray-400" />,
    },
    {
      key: 'newsletterOptIn' as const,
      title: '뉴스레터 수신',
      description: '주간 업데이트와 커뮤니티 주요 소식을 알려드립니다.',
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
            로딩 중...
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 pt-2">
        <section className={`${SETTINGS_CARD_CLASS} p-6 text-center`}>
          <p className="text-sm text-gray-600 dark:text-gray-300">로그인이 필요합니다.</p>
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
        {error && !error.includes('크기') && !error.includes('닉네임') && (
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
                  {formData.username || '프로필'}
                  <LevelBadge userId={user?.id} />
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FiMail className="h-4 w-4 text-gray-400" />
                  <span>{formData.email}</span>
                  {user.isEmailVerified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-[#1f352a] dark:text-emerald-300">
                      <FiCheck className="mr-1 h-3 w-3" /> 인증됨
                    </span>
                  )}
                </div>
                {joinedAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                    <FiCalendar className="h-4 w-4 text-gray-400" />
                    가입일 {joinedAt}
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
                {uploadingImage ? '업로드 중...' : '이미지 변경'}
              </button>
              <button
                type="button"
                onClick={() => setShowCharacterSelector(true)}
                disabled={uploadingImage}
                className={SETTINGS_SUBTLE_BUTTON_CLASS}
              >
                캐릭터 선택
              </button>
            </div>
          </div>
          {error && error.includes('크기') && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </section>

        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-6`}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                닉네임 <span className="text-gray-400 text-xs">(필수)</span>
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
                    setUsernameError('닉네임은 최소 2자 이상 입력하세요');
                  } else if (value && value.length > 30) {
                    setUsernameError('닉네임은 최대 30자까지 입력할 수 있습니다');
                  } else {
                    setUsernameError('');
                  }
                }}
                className={`${SETTINGS_INPUT_CLASS} ${
                  usernameError
                    ? 'border-red-300 dark:border-red-500 focus:ring-red-200 dark:focus:ring-red-500/40'
                    : ''
                }`}
                placeholder="실명이 아닌 별명을 사용하세요"
              />
              {usernameError && (
                <p className="text-xs text-red-500 dark:text-red-400">{usernameError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                직업 <span className="text-gray-400 text-xs">(선택)</span>
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
                placeholder="예: 프론트엔드 엔지니어, 작가 등"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
              소개 <span className="text-gray-400 text-xs">(선택)</span>
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
              placeholder="자신을 소개하거나 앞으로의 계획을 적어보세요"
            />
            <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <span>{formData.bio.length}/{BIO_MAX_LENGTH}</span>
              <span>닉네임·직업·소개는 공개 프로필에 표시됩니다</span>
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-[#2F3440] pt-4 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-xs font-medium ${profileSaveSuccess ? 'text-emerald-600 dark:text-emerald-300' : profileSaveLoading ? 'text-gray-500 dark:text-gray-300' : 'text-gray-500 dark:text-gray-300'}`}>
              {profileSaveSuccess
                ? '프로필이 저장되었습니다.'
                : profileSaveLoading
                ? '저장 중...'
                : isProfileDirty
                ? '변경 사항이 있습니다.'
                : '최신 상태입니다.'}
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
                '저장 완료'
              ) : (
                '변경 사항 저장'
              )}
            </button>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className={`${SUMMARY_CARD_CLASS} p-6 space-y-4`}>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">계정 정보</p>
            <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
              <FiShield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">이메일/비밀번호 계정 사용 중</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">{formData.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                <FiCheck className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium">인증 상태</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    {user.isEmailVerified ? '이메일 인증 완료' : '이메일 인증이 필요합니다'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                <FiBell className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium">최근 로그인</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    {user.lastLoginProvider ? user.lastLoginProvider : 'local'} 계정
                  </p>
                </div>
              </div>
            </div>

          <div className={`${SUMMARY_CARD_CLASS} p-6 space-y-5`}>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">마케팅 및 알림</p>
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
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50">계정 삭제</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                계정을 삭제하면 모든 블로그 게시물, 댓글, 파일이 영구적으로 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors bg-gray-900 hover:bg-gray-800 dark:bg-[#5f63f3] dark:hover:bg-[#7377ff]"
            >
              계정 삭제
            </button>
          </div>
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1F2332] border border-gray-100 dark:border-[#2F3440] rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-red-600 dark:text-red-400 w-6 h-6 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">계정 삭제 확인</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 다음 항목들이 모두 삭제됩니다:
            </p>

            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-1">
              <li>모든 블로그 게시물</li>
              <li>모든 댓글</li>
              <li>업로드한 모든 파일</li>
              <li>API 키</li>
              <li>프로필 정보</li>
            </ul>

            <div className="mb-6">
              <label htmlFor="deleteConfirmText" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                확인을 위해 <strong className="text-red-600 dark:text-red-400">&quot;계정 삭제&quot;</strong>를 입력하세요
              </label>
              <input
                type="text"
                id="deleteConfirmText"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`${SETTINGS_INPUT_CLASS} focus:ring-red-200 dark:focus:ring-red-400`}
                placeholder="계정 삭제"
                autoFocus
              />
            </div>

            {(user?.lastLoginProvider === 'local' ||
              (!user?.lastLoginProvider && user?.authProvider === 'local')) && (
              <div className="mb-6">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className={`${SETTINGS_INPUT_CLASS} focus:ring-red-200 dark:focus:ring-red-400`}
                  placeholder="비밀번호를 입력하세요"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                  로컬 계정으로 마지막 로그인하셨습니다. 보안을 위해 비밀번호를 확인합니다.
                </p>
              </div>
            )}

            {user?.lastLoginProvider && user.lastLoginProvider !== 'local' && (
              <div className="mb-6 p-3 bg-blue-50 dark:bg-[#1B2C3F] border border-blue-100 dark:border-[#234668] rounded-xl">
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  {user.lastLoginProvider.charAt(0).toUpperCase() + user.lastLoginProvider.slice(1)} 계정으로 로그인하셨습니다.
                  비밀번호 입력 없이 계정을 삭제할 수 있습니다.
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
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteConfirmText !== '계정 삭제' ||
                  ((user?.lastLoginProvider === 'local' ||
                    (!user?.lastLoginProvider && user?.authProvider === 'local')) &&
                    !deletePassword)
                }
                className="flex-1 px-4 py-2 rounded-lg font-semibold text-gray-900 dark:text-gray-50 bg-gray-100 dark:bg-[#2A2F3A] hover:bg-gray-200 dark:hover:bg-[#353C49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '영구 삭제'}
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
