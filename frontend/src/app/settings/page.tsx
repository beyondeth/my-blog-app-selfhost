'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import { FiCheck, FiX, FiMail, FiCalendar, FiShield, FiUser, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import Image from 'next/image';
import { normalizeImageUrl } from '@/utils/imageUtils';

export default function ProfileSettingsPage() {
  const { user, isLoading: authLoading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState(''); // Task 26: 계정 삭제 확인 텍스트
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // user가 있고 실제 데이터(email)가 있을 때만 업데이트 (깜빡임 방지)
    if (user?.email) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
      });
      if (user.profileImage) {
        // normalizeImageUrl 사용 (CDN 지원)
        setProfileImageUrl(normalizeImageUrl(user.profileImage));
      }
    }
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다');
      return;
    }

    setUploadingImage(true);
    setError('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          bio: formData.bio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '프로필 업데이트에 실패했습니다');
      }

      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError('');

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
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">프로필 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          기본 프로필 정보를 관리하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            프로필 이미지
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt="Profile"
                  fill
                  sizes="80px"
                  className="object-contain"
                  priority
                  unoptimized
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
            <div>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? '업로드 중...' : '이미지 변경'}
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                JPG, PNG, GIF (최대 5MB)
              </p>
            </div>
          </div>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            사용자 이름
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
            required
          />
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
            placeholder="자신을 소개해주세요..."
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>자신을 소개하는 글을 작성해주세요</span>
            <span>{formData.bio.length}/1000</span>
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
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md">
            프로필이 성공적으로 업데이트되었습니다!
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </form>

      {/* 회원 탈퇴 섹션 */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">계정 삭제</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            계정을 삭제하면 모든 블로그 게시물, 댓글, 파일이 영구적으로 삭제되며 복구할 수 없습니다.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
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

            {(!user?.authProvider || user?.authProvider === 'local') && (
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
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteConfirmText !== '계정 삭제' || // Task 27: "계정 삭제" 텍스트가 정확히 일치해야만 활성화
                  ((!user?.authProvider || user?.authProvider === 'local') && !deletePassword)
                }
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white font-medium rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '영구 삭제'}
              </button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}