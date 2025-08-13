'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { FiCheck, FiX, FiMail, FiCalendar, FiShield } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

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
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-800">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                이미지 변경
              </button>
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
            {user.emailVerified ? (
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
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="자신을 소개해주세요..."
          />
        </div>

        {/* Account Info */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">계정 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <FiCalendar className="mr-2 text-gray-400" />
              <span className="text-gray-600">가입일:</span>
              <span className="ml-2 text-gray-900">{format(new Date(user.createdAt), 'yyyy년 MM월 dd일', { locale: ko })}</span>
            </div>
            <div className="flex items-center text-sm">
              <FiShield className="mr-2 text-gray-400" />
              <span className="text-gray-600">역할:</span>
              <span className="ml-2 text-gray-900">{user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
            </div>
            <div className="flex items-center text-sm">
              <FiMail className="mr-2 text-gray-400" />
              <span className="text-gray-600">인증 방법:</span>
              <span className="ml-2 text-gray-900">{user.provider || 'Email'}</span>
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
            className="px-4 py-2 bg-amber-700 text-white font-medium rounded-md hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}