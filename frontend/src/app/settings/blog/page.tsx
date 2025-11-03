'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { useCheckAlias, useUpdateAlias } from '@/hooks/useBlogs';
import { useRouter } from 'next/navigation';
import { FiGlobe, FiLock, FiMessageSquare, FiLink, FiCalendar, FiSettings, FiCopy, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
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

  // Alias 관련 state (체크포인트 2)
  const [newAlias, setNewAlias] = useState('');
  const [debouncedAlias, setDebouncedAlias] = useState('');
  const [aliasCheckEnabled, setAliasCheckEnabled] = useState(false);

  // Alias 변경 mutation
  const { mutate: updateAlias, isPending: isUpdatingAlias } = useUpdateAlias();

  // Alias 중복 확인 (debounced)
  const { data: aliasCheck, isLoading: isCheckingAlias, error: aliasCheckError } = useCheckAlias(
    debouncedAlias,
    aliasCheckEnabled
  );

  // Alias 입력 debounce 처리 (500ms)
  useEffect(() => {
    if (newAlias && newAlias.length >= 3) {
      const timer = setTimeout(() => {
        setDebouncedAlias(newAlias);
        setAliasCheckEnabled(true);
      }, 500);

      return () => {
        clearTimeout(timer);
        setAliasCheckEnabled(false);
      };
    } else {
      setDebouncedAlias('');
      setAliasCheckEnabled(false);
    }
  }, [newAlias]);

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
   * Alias 변경 핸들러 (체크포인트 2)
   *
   * @description
   * 사용자가 새로운 alias를 입력하고 저장 버튼을 클릭하면 호출됩니다.
   * - 형식 검증 (3-30자, 영문/숫자/하이픈/언더스코어)
   * - 중복 확인 필수
   * - 성공 시 블로그 캐시 갱신 및 페이지 새로고침
   */
  const handleAliasUpdate = useCallback(() => {
    if (!newAlias || newAlias.length < 3) {
      setError('주소는 최소 3자 이상이어야 합니다.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(newAlias)) {
      setError('주소는 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용 가능합니다.');
      return;
    }

    if (!aliasCheck?.available) {
      setError('사용할 수 없는 주소입니다. 다른 주소를 입력해주세요.');
      return;
    }

    updateAlias(newAlias, {
      onSuccess: () => {
        // 성공 시 블로그 정보 갱신 및 입력 필드 초기화
        refreshBlog();
        setNewAlias('');
        setDebouncedAlias('');
        setAliasCheckEnabled(false);
      },
      onError: (err: any) => {
        setError(err.message || 'Alias 변경에 실패했습니다.');
      }
    });
  }, [newAlias, aliasCheck, updateAlias, refreshBlog]);

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
      <div className="p-4 sm:p-6 md:p-8">
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
      <div className="p-4 sm:p-6 md:p-8">
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
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 sm:mb-8">
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
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="flex-1 px-3 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
            <button
              type="button"
              onClick={handleNameUpdate}
              disabled={nameLoading || nameSuccess}
              className="w-full sm:w-[60px] min-h-[44px] px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
          <div className="mt-1 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>블로그를 소개하는 글을 작성해주세요</span>
            <span>{formData.description.length}/1000</span>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={handleDescriptionUpdate}
              disabled={descriptionLoading || descriptionSuccess}
              className="w-full sm:w-[60px] min-h-[44px] sm:ml-auto px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
              <div className="flex items-start sm:items-center min-w-0 flex-1">
                <FiLink className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-gray-600 dark:text-gray-400 block sm:inline">전체 URL:</span>
                  <a
                    href={`/${blog?.alias || blog?.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-0 sm:ml-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-gray-100 break-all block sm:inline"
                  >
                    {window.location.origin}/{blog?.alias || blog?.slug}
                </a>
              </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${blog?.alias || blog?.slug}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="min-w-[44px] min-h-[44px] p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center flex-shrink-0"
                title="주소 복사"
              >
                {copied ? (
                  <span className="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">복사됨!</span>
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Blog Alias Settings (체크포인트 2) */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">블로그 주소 설정</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            블로그 주소를 변경할 수 있습니다. 이전 주소는 자동으로 리다이렉트됩니다. (SEO 보호)
          </p>

          <div className="space-y-4">
            {/* 현재 주소 */}
            <div className="flex items-center text-sm p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
              <FiLink className="mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">현재 주소:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">
                @{blog?.alias || blog?.slug}
              </span>
            </div>

            {/* 새 주소 입력 */}
            <div>
              <label htmlFor="newAlias" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                새로운 주소
              </label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">@</span>
                  </div>
                  <input
                    type="text"
                    id="newAlias"
                    value={newAlias}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                      setNewAlias(value);
                    }}
                    placeholder="영문, 숫자 조합"
                    maxLength={30}
                    className="w-full pl-8 pr-10 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                  />
                  {/* 검증 아이콘 */}
                  {newAlias.length >= 3 && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {isCheckingAlias ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : aliasCheck?.available ? (
                        <FiCheck className="w-5 h-5 text-green-500" />
                      ) : aliasCheckError ? (
                        <FiX className="w-5 h-5 text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>

                {/* 실시간 피드백 */}
                <div className="min-h-[20px] mt-1 text-xs">
                  {aliasCheckError ? (
                    <div className="flex items-start text-red-600 dark:text-red-400">
                      <FiX className="mr-1 mt-0.5 flex-shrink-0" />
                      <span>{(aliasCheckError as any)?.message || '사용할 수 없는 주소입니다.'}</span>
                    </div>
                  ) : newAlias.length >= 3 && aliasCheck?.available ? (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <FiCheck className="mr-1 flex-shrink-0" />
                      <span>사용 가능한 주소입니다</span>
                      {isCheckingAlias && (
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-2" />
                      )}
                    </div>
                  ) : newAlias.length > 0 && newAlias.length < 3 ? (
                    <div className="flex items-start text-gray-500 dark:text-gray-400">
                      <FiAlertCircle className="mr-1 mt-0.5 flex-shrink-0" />
                      <span>최소 3자 이상 입력해주세요</span>
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  3-30자, 영문 소문자/숫자/하이픈/언더스코어만 사용 가능
                </p>

                {/* 저장 버튼 */}
                <button
                  type="button"
                  onClick={handleAliasUpdate}
                  disabled={isUpdatingAlias || !aliasCheck?.available || newAlias.length < 3}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-2 bg-gray-800 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isUpdatingAlias ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      변경 중...
                    </>
                  ) : (
                    '주소 변경'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">공개 설정</h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center">
                <FiGlobe className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div>
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    블로그 공개
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">모든 사람이 블로그를 볼 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-8 sm:ml-0">
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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center">
                <FiMessageSquare className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div>
                  <label htmlFor="allowComments" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    댓글 허용
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">방문자가 글에 댓글을 남길 수 있습니다</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-8 sm:ml-0">
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