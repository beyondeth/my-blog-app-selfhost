'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { FiCheck, FiX, FiMail, FiCalendar, FiShield, FiUser, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import Image from 'next/image';

export default function ProfileSettingsPage() {
  const { user, refreshUser, logout } = useAuth();
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
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
      });
      if (user.profileImage) {
        console.log('User profileImage:', user.profileImage);
        let imageUrl = user.profileImage;
        
        // 절대 URL이 아닌 경우 처리
        if (!user.profileImage.startsWith('http://') && !user.profileImage.startsWith('https://')) {
          // /api/로 시작하는 경우
          if (user.profileImage.startsWith('/api/')) {
            imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${user.profileImage.replace('/api/v1', '')}`;
          } 
          // /로 시작하는 경우
          else if (user.profileImage.startsWith('/')) {
            imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${user.profileImage}`;
          }
          // v2/users/... 같은 상대 경로인 경우 (S3 키)
          else {
            // proxy 엔드포인트 사용
            imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/files/proxy/${user.profileImage}`;
          }
        }
        
        setProfileImageUrl(imageUrl);
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
      console.log('Upload result:', result);
      
      // 사용자 정보 새로고침
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
        <h2 className="text-xl font-semibold text-gray-900">프로필 설정</h2>
        <p className="text-sm text-gray-600 mt-1">
          기본 프로필 정보를 관리하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            프로필 이미지
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? '업로드 중...' : '이미지 변경'}
              </button>
              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG, GIF (최대 5MB)
              </p>
            </div>
          </div>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            사용자 이름
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            이메일
          </label>
          <div className="flex items-center">
            <input
              type="email"
              id="email"
              value={formData.email}
              disabled
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            {user.isEmailVerified ? (
              <span className="ml-3 inline-flex items-center text-sm text-green-600">
                <FiCheck className="mr-1" /> 인증됨
              </span>
            ) : (
              <span className="ml-3 inline-flex items-center text-sm text-gray-500">
                <FiX className="mr-1" /> 미인증
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            이메일은 보안상의 이유로 변경할 수 없습니다
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="자신을 소개해주세요..."
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>자신을 소개하는 글을 작성해주세요</span>
            <span>{formData.bio.length}/1000</span>
          </div>
        </div>

        {/* Account Info */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">계정 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <FiCalendar className="mr-2 text-gray-400" />
              <span className="text-gray-600">가입일:</span>
              <span className="ml-2 text-gray-900">
                {user.createdAt 
                  ? format(new Date(user.createdAt), 'yyyy년 MM월 dd일', { locale: ko })
                  : '정보 없음'}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <FiShield className="mr-2 text-gray-400" />
              <span className="text-gray-600">역할:</span>
              <span className="ml-2 text-gray-900">{user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
            </div>
            <div className="flex items-center text-sm">
              <FiMail className="mr-2 text-gray-400" />
              <span className="text-gray-600">인증 방법:</span>
              <span className="ml-2 text-gray-900">{user.authProvider || 'Email'}</span>
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
            프로필이 성공적으로 업데이트되었습니다!
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </form>

      {/* 회원 탈퇴 섹션 */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-2">계정 삭제</h4>
          <p className="text-sm text-gray-600 mb-4">
            계정을 삭제하면 모든 블로그 게시물, 댓글, 파일이 영구적으로 삭제되며 복구할 수 없습니다.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            계정 삭제
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-red-600 w-6 h-6 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">계정 삭제 확인</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 다음 항목들이 모두 삭제됩니다:
            </p>
            
            <ul className="list-disc list-inside text-sm text-gray-600 mb-6 space-y-1">
              <li>모든 블로그 게시물</li>
              <li>모든 댓글</li>
              <li>업로드한 모든 파일</li>
              <li>API 키</li>
              <li>프로필 정보</li>
            </ul>

            {(!user?.authProvider || user?.authProvider === 'local') && (
              <div className="mb-6">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="비밀번호를 입력하세요"
                  autoFocus
                />
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || ((!user?.authProvider || user?.authProvider === 'local') && !deletePassword)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '영구 삭제'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 transition-colors"
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