'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiX, FiMail, FiCalendar, FiShield, FiUser, FiAlertTriangle, FiLoader, FiBell } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import Image from 'next/image';
import { normalizeImageUrl } from '@/utils/imageUtils';
import CharacterSelector from '@/components/settings/CharacterSelector';

export default function ProfileSettingsPage() {
  const { user, isLoading: authLoading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
  });
  const [marketingPreferences, setMarketingPreferences] = useState({
    marketingOptIn: false,
    newsletterOptIn: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState(''); // Task 26: 계정 삭제 확인 텍스트
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);

  useEffect(() => {
    // user가 있고 실제 데이터(email)가 있을 때만 업데이트 (깜빡임 방지)
    if (user?.email) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
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
  const handleMarketingPreferenceChange = async (
    preferences: { marketingOptIn?: boolean; newsletterOptIn?: boolean }
  ) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/marketing-preferences`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(preferences),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        // 마케팅 설정 에러는 상단에 표시하지 않고 콘솔에만 기록
        console.error('Marketing preference update failed:', error.message);
        throw new Error(error.message || '마케팅 정보 수신 설정 업데이트에 실패했습니다');
      }

      // 사용자 정보 새로고침 (JWT 토큰에 반영)
      await refreshUser();
    } catch (err: any) {
      // 에러 발생 시 이전 상태로 되돌리기
      if (user) {
        setMarketingPreferences({
          marketingOptIn: user.marketingOptIn || false,
          newsletterOptIn: user.newsletterOptIn || false,
        });
      }
      // 마케팅 설정 에러는 전역 에러 상태에 저장하지 않음 (다른 섹션에 영향 주지 않기 위해)
    }
  };

  /**
   * 닉네임 업데이트 핸들러
   * 닉네임 필드의 저장 버튼 클릭 시 호출
   */
  const handleUsernameUpdate = async () => {
    setUsernameLoading(true);
    setError('');
    setUsernameError('');
    setSuccess(false);

    // 클라이언트 측에서 기본 유효성 검사
    if (formData.username && formData.username.length < 2) {
      setUsernameError('닉네임은 최소 2자 이상 입력하세요');
      setUsernameLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // 닉네임 관련 에러인 경우 별도로 표시
        if (error.message && error.message.includes('닉네임')) {
          setUsernameError(error.message);
        } else {
          setError(error.message || '닉네임 업데이트에 실패했습니다');
        }
        throw new Error(error.message || '닉네임 업데이트에 실패했습니다');
      }

      await refreshUser();
      setUsernameLoading(false);
      setUsernameSuccess(true);
      setSuccess(true);
      setUsernameError('');
      setTimeout(() => {
        setUsernameSuccess(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      // 이미 setError나 setUsernameError가 위에서 처리됨
      setUsernameLoading(false);
    }
  };

  /**
   * 소개(Bio) 업데이트 핸들러
   * Bio 필드의 저장 버튼 클릭 시 호출
   */
  const handleBioUpdate = async () => {
    setBioLoading(true);
    setError('');
    setUsernameError('');  // Bio 업데이트 시에도 닉네임 에러 초기화
    setSuccess(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bio: formData.bio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '소개 업데이트에 실패했습니다');
      }

      await refreshUser();

      // 블로그 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['blog'] });
      queryClient.invalidateQueries({ queryKey: ['my-blogs'] });

      setBioLoading(false);
      setBioSuccess(true);
      setSuccess(true);
      setTimeout(() => {
        setBioSuccess(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
      setBioLoading(false);
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

  // 로딩 중이거나 사용자 정보가 없을 때
  if (authLoading || !user) {
    return (
      <div className="p-8 text-center">
        {authLoading ? (
          <div className="flex flex-col items-center gap-3">
            <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">로그인이 필요합니다</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">프로필 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          기본 프로필 정보를 관리하세요
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            프로필 이미지
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt="Profile"
                  fill
                  sizes="80px"
                  className="object-cover"
                  priority
                  unoptimized
                  onError={(e) => {
                    console.error('[Settings] Failed to load profile image:', profileImageUrl);
                    setProfileImageUrl(null); // fallback to default avatar
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FiUser className="w-10 h-10 text-gray-400" />
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <FiLoader className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? '업로드 중...' : '이미지 변경'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCharacterSelector(true)}
                  disabled={uploadingImage}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  캐릭터 선택
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                JPG, PNG, GIF (최대 5MB) 또는 캐릭터 선택
              </p>
              {error && error.includes('크기') && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            닉네임
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, username: value });

                // 실시간 유효성 검사
                if (value && value.length < 2) {
                  setUsernameError('닉네임은 최소 2자 이상 입력하세요');
                } else if (value && value.length > 20) {
                  setUsernameError('닉네임은 최대 20자까지 입력할 수 있습니다');
                } else {
                  setUsernameError('');
                }
              }}
              className={`flex-1 px-3 py-2 min-h-[44px] border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none transition-colors ${
                usernameError
                  ? 'border-red-300 dark:border-red-600 focus:border-red-400 dark:focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500'
              }`}
              placeholder="실명이 아닌 별명을 사용하세요"
            />
            <button
              type="button"
              onClick={handleUsernameUpdate}
              disabled={usernameLoading || usernameSuccess || usernameError !== ''}
              className="w-full sm:w-[60px] min-h-[44px] px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {usernameLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : usernameSuccess ? (
                '완료'
              ) : (
                '저장'
              )}
            </button>
          </div>
          {/* 닉네임 에러 메시지 */}
          {usernameError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {usernameError}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            이메일
          </label>
          <div className="flex items-center">
            <input
              type="email"
              id="email"
              value={formData.email}
              disabled
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            />
            {user.isEmailVerified ? (
              <span className="ml-3 inline-flex items-center text-sm text-green-600 dark:text-green-400">
                <FiCheck className="mr-1" /> 인증됨
              </span>
            ) : (
              <span className="ml-3 inline-flex items-center text-sm text-gray-500 dark:text-gray-400">
                <FiX className="mr-1" /> 미인증
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            이메일은 보안상의 이유로 변경할 수 없습니다
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            소개
          </label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setFormData({ ...formData, bio: e.target.value });
              }
            }}
            rows={4}
            maxLength={1000}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            placeholder="자신을 소개해주세요..."
          />
          <div className="mt-1 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>자신을 소개하는 글을 작성해주세요</span>
            <span>{formData.bio.length}/1000</span>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={handleBioUpdate}
              disabled={bioLoading || bioSuccess}
              className="w-full sm:w-[60px] min-h-[44px] sm:ml-auto px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {bioLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : bioSuccess ? (
                '완료'
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">계정 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <FiCalendar className="mr-2 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">가입일:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {user.createdAt
                  ? format(new Date(user.createdAt), 'yyyy년 MM월 dd일', { locale: ko })
                  : '정보 없음'}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <FiShield className="mr-2 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">역할:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
            </div>
            <div className="flex items-center text-sm">
              <FiMail className="mr-2 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">인증 방법:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{user.authProvider || 'Email'}</span>
            </div>
          </div>

          {/* 마케팅 정보 수신 설정 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8 mt-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">마케팅 정보 수신</h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start sm:items-center">
                  <FiBell className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      마케팅 정보 수신
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      신규 기능, 이벤트, 프로모션 정보를 받아보세요
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-8 sm:ml-0">
                  <input
                    type="checkbox"
                    checked={marketingPreferences.marketingOptIn}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setMarketingPreferences({ ...marketingPreferences, marketingOptIn: newValue });
                      await handleMarketingPreferenceChange({ marketingOptIn: newValue });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white peer-checked:after:bg-gray-800 dark:peer-checked:after:bg-white after:border-gray-300 peer-checked:after:border-gray-800 dark:peer-checked:after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-100 dark:peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start sm:items-center">
                  <FiMail className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      뉴스레터 수신
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      주간/월간 뉴스레터와 추천 콘텐츠를 받아보세요
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-8 sm:ml-0">
                  <input
                    type="checkbox"
                    checked={marketingPreferences.newsletterOptIn}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setMarketingPreferences({ ...marketingPreferences, newsletterOptIn: newValue });
                      await handleMarketingPreferenceChange({ newsletterOptIn: newValue });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white peer-checked:after:bg-gray-800 dark:peer-checked:after:bg-white after:border-gray-300 peer-checked:after:border-gray-800 dark:peer-checked:after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-100 dark:peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && !error.includes('크기') && !error.includes('닉네임') && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md">
            프로필이 성공적으로 업데이트되었습니다!
          </div>
        )}
      </div>

      {/* 회원 탈퇴 섹션 */}
      <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
          <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">계정 삭제</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            계정을 삭제하면 모든 블로그 게시물, 댓글, 파일이 영구적으로 삭제되며 복구할 수 없습니다.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          >
            계정 삭제
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-red-600 dark:text-red-400 w-6 h-6 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">계정 삭제 확인</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 다음 항목들이 모두 삭제됩니다:
            </p>

            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1">
              <li>모든 블로그 게시물</li>
              <li>모든 댓글</li>
              <li>업로드한 모든 파일</li>
              <li>API 키</li>
              <li>프로필 정보</li>
            </ul>

            {/* Task 26: 계정 삭제 확인 텍스트 입력 필드 */}
            <div className="mb-6">
              <label htmlFor="deleteConfirmText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                확인을 위해 <strong className="text-red-600 dark:text-red-400">&quot;계정 삭제&quot;</strong>를 입력하세요
              </label>
              <input
                type="text"
                id="deleteConfirmText"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                placeholder="계정 삭제"
                autoFocus
              />
            </div>

            {/* 현재 로그인 방법이 로컬인 경우만 비밀번호 입력 */}
            {(user?.lastLoginProvider === 'local' ||
              (!user?.lastLoginProvider && user?.authProvider === 'local')) && (
              <div className="mb-6">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                  placeholder="비밀번호를 입력하세요"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  로컬 계정으로 마지막 로그인하셨습니다. 보안을 위해 비밀번호를 확인합니다.
                </p>
              </div>
            )}

            {/* 소셜 로그인 사용자 안내 */}
            {user?.lastLoginProvider && user.lastLoginProvider !== 'local' && (
              <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {user.lastLoginProvider.charAt(0).toUpperCase() + user.lastLoginProvider.slice(1)} 계정으로 로그인하셨습니다.
                  비밀번호 입력 없이 계정을 삭제할 수 있습니다.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteConfirmText(''); // Task 27: 모달 닫을 때 확인 텍스트도 초기화
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteConfirmText !== '계정 삭제' || // "계정 삭제" 텍스트가 정확히 일치해야만 활성화
                  // 로컬 로그인인 경우에만 비밀번호 필수
                  ((user?.lastLoginProvider === 'local' ||
                    (!user?.lastLoginProvider && user?.authProvider === 'local')) &&
                    !deletePassword)
                }
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white font-medium rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 선택 모달 */}
      <CharacterSelector
        isOpen={showCharacterSelector}
        onClose={() => setShowCharacterSelector(false)}
        currentProfileImage={profileImageUrl}
        onSelectCharacter={handleSelectCharacter}
      />
    </div>
  );
}