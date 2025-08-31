'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserBlog } from '@/hooks/useUserBlog';
import { useRouter } from 'next/navigation';
import { FiGlobe, FiLock, FiMessageSquare, FiLink, FiCalendar, FiEdit3 } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Blog } from '@/types';

export default function BlogSettingsPage() {
  const { user } = useAuth();
  const { blog, refresh: refreshBlog } = useUserBlog();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    allowComments: true,
  });

  useEffect(() => {
    if (blog) {
      setFormData({
        name: blog.name || '',
        description: blog.description || '',
        isPublic: blog.isPublic !== false,
        allowComments: blog.allowComments !== false,
      });
    }
  }, [blog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/${blog?.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '블로그 업데이트에 실패했습니다');
      }

      await refreshBlog();
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

  if (!blog) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <FiEdit3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">블로그가 없습니다</h3>
          <p className="text-sm text-gray-600 mb-4">
            블로그를 찾을 수 없습니다. 새로고침을 시도해보세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900">블로그 설정</h2>
        <p className="text-sm text-gray-600 mt-1">
          블로그의 기본 정보와 설정을 관리하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Blog Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            블로그 이름
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        {/* Blog Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            블로그 설명
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="블로그를 소개해주세요..."
          />
        </div>

        {/* Blog URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            블로그 주소
          </label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
              {window.location.origin}/blog/
            </span>
            <input
              type="text"
              value={blog.slug}
              disabled
              className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            블로그 주소는 변경할 수 없습니다
          </p>
        </div>

        {/* Privacy Settings */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">공개 설정</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiGlobe className="mr-2 text-gray-400" />
                <div>
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                    블로그 공개
                  </label>
                  <p className="text-xs text-gray-500">모든 사람이 블로그를 볼 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiMessageSquare className="mr-2 text-gray-400" />
                <div>
                  <label htmlFor="allowComments" className="text-sm font-medium text-gray-700">
                    댓글 허용
                  </label>
                  <p className="text-xs text-gray-500">방문자가 글에 댓글을 남길 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="allowComments"
                  checked={formData.allowComments}
                  onChange={(e) => setFormData({ ...formData, allowComments: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Blog Info */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">블로그 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <FiCalendar className="mr-2 text-gray-400" />
              <span className="text-gray-600">생성일:</span>
              <span className="ml-2 text-gray-900">
                {blog.createdAt && format(new Date(blog.createdAt), 'yyyy년 MM월 dd일', { locale: ko })}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <FiLink className="mr-2 text-gray-400" />
              <span className="text-gray-600">전체 URL:</span>
              <a 
                href={`/blog/${blog.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-gray-700 hover:text-black"
              >
                {window.location.origin}/blog/{blog.slug}
              </a>
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
            블로그 설정이 성공적으로 업데이트되었습니다!
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
    </div>
  );
}