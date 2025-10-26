'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { useRouter } from 'next/navigation';
import { FiGlobe, FiLock, FiMessageSquare, FiLink, FiCalendar, FiSettings, FiCopy } from 'react-icons/fi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Blog } from '@/types';

export default function BlogSettingsPage() {
  const { user } = useAuth();
  const { blog, loading: blogLoading, refresh: refreshBlog } = useUserBlogV2();
  const router = useRouter();
  const [nameLoading, setNameLoading] = useState(false);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [descriptionSuccess, setDescriptionSuccess] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
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

  /**
   * 블로그 이름 업데이트 핸들러
   * 블로그 이름 필드의 저장 버튼 클릭 시 호출
   */
  const handleNameUpdate = async () => {
    setNameLoading(true);
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
          body: JSON.stringify({
            name: formData.name,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '블로그 이름 업데이트에 실패했습니다');
      }

      await refreshBlog();
      setNameLoading(false);
      setNameSuccess(true);
      setSuccess(true);
      setTimeout(() => {
        setNameSuccess(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
      setNameLoading(false);
    }
  };

  /**
   * 블로그 설명 업데이트 핸들러
   * 블로그 설명 필드의 저장 버튼 클릭 시 호출
   */
  const handleDescriptionUpdate = async () => {
    setDescriptionLoading(true);
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
          body: JSON.stringify({
            description: formData.description,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '블로그 설명 업데이트에 실패했습니다');
      }

      await refreshBlog();
      setDescriptionLoading(false);
      setDescriptionSuccess(true);
      setSuccess(true);
      setTimeout(() => {
        setDescriptionSuccess(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
      setDescriptionLoading(false);
    }
  };

  /**
   * 블로그 공개 설정 변경 핸들러
   * 토글 변경 시 즉시 API 호출하여 백엔드 업데이트
   */
  const handlePublicSettingChange = async (isPublic: boolean) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/${blog?.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ isPublic }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '블로그 공개 설정 업데이트에 실패했습니다');
      }

      await refreshBlog();
    } catch (err: any) {
      setError(err.message || '블로그 공개 설정 업데이트 중 오류가 발생했습니다');
      // 에러 발생 시 이전 상태로 되돌리기
      if (blog) {
        setFormData(prev => ({ ...prev, isPublic: blog.isPublic ?? true }));
      }
    }
  };

  /**
   * 댓글 허용 설정 변경 핸들러
   * 토글 변경 시 즉시 API 호출하여 백엔드 업데이트
   */
  const handleCommentsSettingChange = async (allowComments: boolean) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/${blog?.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ allowComments }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '댓글 허용 설정 업데이트에 실패했습니다');
      }

      await refreshBlog();
    } catch (err: any) {
      setError(err.message || '댓글 허용 설정 업데이트 중 오류가 발생했습니다');
      // 에러 발생 시 이전 상태로 되돌리기
      if (blog) {
        setFormData(prev => ({ ...prev, allowComments: blog.allowComments ?? true }));
      }
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">로그인이 필요합니다</p>
      </div>
    );
  }

  // 블로그 데이터 로딩 중일 때 스켈레톤 UI 표시
  if (blogLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
        </div>
        <div className="space-y-6">
          <div>
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
          <div>
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-24 w-full bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
          <div>
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // 로딩이 완료되었는데 블로그가 없을 때만 에러 표시
  if (!blogLoading && !blog) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <FiSettings className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">블로그가 없습니다</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            블로그를 찾을 수 없습니다. 새로고침을 시도해보세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600"
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">블로그 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          블로그의 기본 정보와 설정을 관리하세요
        </p>
      </div>

      <div className="space-y-6">
        {/* Blog Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            블로그 이름
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
            <button
              type="button"
              onClick={handleNameUpdate}
              disabled={nameLoading || nameSuccess}
              className="w-[60px] h-[40px] px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {nameLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : nameSuccess ? (
                '완료'
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>

        {/* Blog Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            블로그 설명
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setFormData({ ...formData, description: e.target.value });
              }
            }}
            rows={4}
            maxLength={1000}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            placeholder="블로그를 소개해주세요..."
          />
          <div className="mt-1 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <span>블로그를 소개하는 글을 작성해주세요</span>
            <span>{formData.description.length}/1000</span>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleDescriptionUpdate}
              disabled={descriptionLoading || descriptionSuccess}
              className="w-[60px] h-[40px] px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {descriptionLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : descriptionSuccess ? (
                '완료'
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>

        {/* Blog Info */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">블로그 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <FiCalendar className="mr-2 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">생성일:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {blog?.createdAt && format(new Date(blog.createdAt), 'yyyy년 MM월 dd일', { locale: ko })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <FiLink className="mr-2 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">전체 URL:</span>
                <a
                  href={`/${blog?.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-gray-100"
                >
                  {window.location.origin}/{blog?.slug}
                </a>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${blog?.slug}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="주소 복사"
              >
                {copied ? (
                  <span className="text-xs text-green-600 dark:text-green-400">복사됨!</span>
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">공개 설정</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiGlobe className="mr-2 text-gray-400 dark:text-gray-500" />
                <div>
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    블로그 공개
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">모든 사람이 블로그를 볼 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={async (e) => {
                    const newValue = e.target.checked;
                    setFormData({ ...formData, isPublic: newValue });
                    await handlePublicSettingChange(newValue);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white peer-checked:after:bg-gray-800 dark:peer-checked:after:bg-white after:border-gray-300 peer-checked:after:border-gray-800 dark:peer-checked:after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-100 dark:peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiMessageSquare className="mr-2 text-gray-400 dark:text-gray-500" />
                <div>
                  <label htmlFor="allowComments" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    댓글 허용
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">방문자가 글에 댓글을 남길 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="allowComments"
                  checked={formData.allowComments}
                  onChange={async (e) => {
                    const newValue = e.target.checked;
                    setFormData({ ...formData, allowComments: newValue });
                    await handleCommentsSettingChange(newValue);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white peer-checked:after:bg-gray-800 dark:peer-checked:after:bg-white after:border-gray-300 peer-checked:after:border-gray-800 dark:peer-checked:after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-100 dark:peer-checked:bg-blue-600"></div>
              </label>
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
            블로그 설정이 성공적으로 업데이트되었습니다!
          </div>
        )}
      </div>
    </div>
  );
}