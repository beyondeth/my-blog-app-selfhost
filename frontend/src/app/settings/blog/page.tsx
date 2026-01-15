'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { useCheckAlias, useUpdateAlias } from '@/hooks/useBlogs';
import { useRouter } from 'next/navigation';
import { useBlogRefresh } from '@/hooks/useBlogRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { getBlogBySlug } from '@/lib/api';
import { FiGlobe, FiMessageSquare, FiLink, FiCalendar, FiSettings, FiCopy, FiCheck, FiX, FiAlertCircle, FiPlus } from 'react-icons/fi';
import BlogBrandingSettings from '@/components/settings/BlogBrandingSettings';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Blog, SocialLink } from '@/types';
import { Switch } from '@/components/ui/switch';
import { SETTINGS_CARD_CLASS, SETTINGS_INPUT_CLASS, SETTINGS_PRIMARY_BUTTON_CLASS } from '@/app/settings/theme';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';

export default function BlogSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { blog, loading: blogLoading, refresh: refreshBlog } = useUserBlogV2();
  const router = useRouter();
  const refreshBlogPage = useBlogRefresh();
  const queryClient = useQueryClient();
  const refreshAcrossPages = useCallback(async () => {
    const result = await refreshBlog();
    const refreshedBlog = result?.data ?? blog ?? null;
    const slugSource = refreshedBlog ?? blog;
    const normalizedSlug = ((slugSource?.alias ?? slugSource?.slug) || '').replace('@', '');
    const candidateKeys = Array.from(new Set([user?.id || 'anonymous', 'anonymous']));

    if (normalizedSlug) {
      const slugIdentifier = slugSource?.alias?.replace('@', '') || slugSource?.slug || normalizedSlug;
      const requestSlug = slugSource?.alias ? `@${slugIdentifier}` : slugIdentifier;

      await Promise.all(
        candidateKeys.map(async (key) => {
          try {
            await queryClient.prefetchQuery({
              queryKey: ['blog', normalizedSlug, key],
              queryFn: () => getBlogBySlug(requestSlug),
            });
          } catch (error) {
            console.error('[BlogSettings] Failed to prefetch blog cache', error);
            await queryClient.invalidateQueries({
              queryKey: ['blog', normalizedSlug, key],
              exact: true,
            });
          }
        })
      );
    }

    refreshBlogPage();
  }, [refreshBlog, blog, user?.id, queryClient, refreshBlogPage]);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaveSuccess, setGeneralSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    allowComments: true,
  });
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialLinksSaving, setSocialLinksSaving] = useState(false);
  const [socialLinksSuccess, setSocialLinksSuccess] = useState(false);
  const [socialLinksError, setSocialLinksError] = useState('');
  const [socialLinksTouched, setSocialLinksTouched] = useState(false);
  const [socialLinksLimitNotice, setSocialLinksLimitNotice] = useState('');
  type PrivacyFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;
  const [privacyFeedback, setPrivacyFeedback] = useState<{ public: PrivacyFeedback; comments: PrivacyFeedback }>({
    public: null,
    comments: null,
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
  const updatePrivacyFeedback = useCallback((key: 'public' | 'comments', payload: PrivacyFeedback) => {
    setPrivacyFeedback(prev => ({
      ...prev,
      [key]: payload,
    }));
  }, []);

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

  const normalizedUserSocialLinks = useMemo(() => {
    return (user?.socialLinks ?? [])
      .filter(
        (link): link is SocialLink =>
          Boolean(link && typeof link === 'object' && !Array.isArray(link))
      )
      .slice(0, 3);
  }, [user?.socialLinks]);

  useEffect(() => {
    setSocialLinksTouched(false);
  }, [user?.id]);

  useEffect(() => {
    if (socialLinksTouched) return;
    if (user?.socialLinks === undefined) return;
    setSocialLinks(normalizedUserSocialLinks);

    if (process.env.NODE_ENV === 'development') {
      console.log('[BlogSettings] Loaded social links', normalizedUserSocialLinks);
    }
  }, [user?.socialLinks, normalizedUserSocialLinks, socialLinksTouched]);

  const handleGeneralSave = async () => {
    if (!blog) return;
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError('블로그 이름을 입력해주세요.');
      return;
    }

    const payload: Record<string, any> = {};
    if (trimmedName !== (blog.name || '')) {
      payload.name = trimmedName;
    }
    if ((formData.description || '') !== (blog.description || '')) {
      payload.description = formData.description;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setGeneralSaving(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/${blog.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        setError('로그아웃되었습니다. 다시 로그인해주세요.');
        router.push('/login?next=/settings/blog');
        setGeneralSaving(false);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '블로그 정보를 업데이트하지 못했습니다');
      }

      await refreshAcrossPages();
      setGeneralSaveSuccess(true);
      setTimeout(() => setGeneralSaveSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setGeneralSaving(false);
    }
  };

  const normalizeSocialLinksPayload = (links: SocialLink[]) => {
    const normalized: SocialLink[] = [];
    const seenPlatforms = new Set<string>();

    links.forEach((link) => {
      const rawPlatform = link.platform?.trim().toLowerCase() || '';
      const rawUrl = link.url?.trim() || '';

      if (!rawPlatform || !rawUrl) return;

      const platform = rawPlatform.replace(/[^a-z0-9._-]/g, '');
      if (!platform || seenPlatforms.has(platform)) return;

      let url = rawUrl;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return;
        url = parsed.toString();
      } catch {
        return;
      }

      normalized.push({ platform, url });
      seenPlatforms.add(platform);
    });

    return normalized.slice(0, 3);
  };

  const handleSocialLinkChange = (index: number, field: keyof SocialLink, value: string) => {
    setSocialLinksTouched(true);
    setSocialLinksLimitNotice('');
    setSocialLinks((prev) =>
      prev.map((link, idx) => (idx === index ? { ...link, [field]: value } : link))
    );
  };

  const handleAddSocialLink = () => {
    setSocialLinksTouched(true);
    setSocialLinksLimitNotice('');
    setSocialLinks((prev) => {
      if (prev.length >= 3) {
        setSocialLinksLimitNotice('최대 3개의 소셜 링크만 추가할 수 있습니다.');
        return prev;
      }
      return [...prev, { platform: '', url: '' }];
    });
  };

  const handleRemoveSocialLink = (index: number) => {
    setSocialLinksTouched(true);
    setSocialLinksLimitNotice('');
    setSocialLinks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSocialLinksSave = async () => {
    if (!user) return;

    setSocialLinksSaving(true);
    setSocialLinksError('');
    setSocialLinksSuccess(false);

    const payloadLinks = normalizeSocialLinksPayload(socialLinks);
    if (process.env.NODE_ENV === 'development') {
      console.log('[BlogSettings] Saving social links', payloadLinks);
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ socialLinks: payloadLinks }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.error('[BlogSettings] Failed to save social links', error);
        }
        throw new Error(error.message || '소셜 링크 업데이트에 실패했습니다');
      }

      await refreshUser();
      await refreshAcrossPages();
      setSocialLinks(payloadLinks);
      setSocialLinksLimitNotice('');
      setSocialLinksTouched(false);
      setSocialLinksSuccess(true);
      setTimeout(() => setSocialLinksSuccess(false), 2000);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[BlogSettings] Social links save error', err);
      }
      setSocialLinksError(err.message || '오류가 발생했습니다');
    } finally {
      setSocialLinksSaving(false);
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
        refreshAcrossPages();
        setNewAlias('');
        setDebouncedAlias('');
        setAliasCheckEnabled(false);
      },
      onError: (err: any) => {
        setError(err.message || 'Alias 변경에 실패했습니다.');
      }
    });
  }, [newAlias, aliasCheck, updateAlias, refreshAcrossPages]);

  /**
   * 블로그 공개 설정 변경 핸들러
   * 토글 변경 시 즉시 API 호출하여 백엔드 업데이트
   */
  const handlePublicSettingChange = async (isPublic: boolean) => {
    updatePrivacyFeedback('public', { type: 'info', text: '설정을 저장하고 있습니다...' });
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

      await refreshAcrossPages();
      updatePrivacyFeedback(
        'public',
        {
          type: 'success',
          text: isPublic ? '블로그를 공개 상태로 전환했습니다.' : '블로그를 비공개로 전환했습니다.',
        }
      );
    } catch (err: any) {
      setError(err.message || '블로그 공개 설정 업데이트 중 오류가 발생했습니다');
      // 에러 발생 시 이전 상태로 되돌리기
      if (blog) {
        setFormData(prev => ({ ...prev, isPublic: blog.isPublic ?? true }));
      }
      updatePrivacyFeedback(
        'public',
        {
          type: 'error',
          text: err.message || '블로그 공개 설정 업데이트에 실패했습니다.',
        }
      );
    }
  };

  /**
   * 댓글 허용 설정 변경 핸들러
   * 토글 변경 시 즉시 API 호출하여 백엔드 업데이트
   */
  const handleCommentsSettingChange = async (allowComments: boolean) => {
    updatePrivacyFeedback('comments', { type: 'info', text: '설정을 저장하고 있습니다...' });
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

      await refreshAcrossPages();
      updatePrivacyFeedback(
        'comments',
        {
          type: 'success',
          text: allowComments ? '댓글을 허용하도록 설정했습니다.' : '댓글을 비활성화했습니다.',
        }
      );
    } catch (err: any) {
      setError(err.message || '댓글 허용 설정 업데이트 중 오류가 발생했습니다');
      // 에러 발생 시 이전 상태로 되돌리기
      if (blog) {
        setFormData(prev => ({ ...prev, allowComments: blog.allowComments ?? true }));
      }
      updatePrivacyFeedback(
        'comments',
        {
          type: 'error',
          text: err.message || '댓글 허용 설정 업데이트에 실패했습니다.',
        }
      );
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 text-center text-gray-600`}>
          로그인이 필요합니다
        </div>
      </div>
    );
  }

  // 블로그 데이터 로딩 중일 때 스켈레톤 UI 표시
  if (blogLoading) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 space-y-4 animate-pulse`}>
          <div className="h-7 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-100 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded" />
          <div className="h-24 w-full bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // 로딩이 완료되었는데 블로그가 없을 때만 에러 표시
  if (!blogLoading && !blog) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 text-center space-y-4`}>
          <FiSettings className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-medium text-gray-900">블로그가 없습니다</h3>
          <p className="text-sm text-gray-600">블로그를 찾을 수 없습니다. 새로고침을 시도해보세요.</p>
          <button onClick={() => window.location.reload()} className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-auto`}>
            새로고침
          </button>
        </div>
      </div>
    );
  }

  const originalName = blog?.name || '';
  const originalDescription = blog?.description || '';
  const isGeneralDirty =
    formData.name.trim() !== originalName || formData.description !== originalDescription;
  const isSocialLinksDirty =
    JSON.stringify(socialLinks) !== JSON.stringify(normalizedUserSocialLinks);

  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-2 pt-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">블로그 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">블로그의 기본 정보와 설정을 관리하세요</p>
      </div>

      <div className="space-y-6">
        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-6`}>
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
              블로그 이름
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={50}
              className={SETTINGS_INPUT_CLASS}
            />
            <p className="text-xs text-gray-500 dark:text-gray-300">2-50자, 한글/영문/숫자/공백 사용 가능</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-gray-50">
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
              className={`${SETTINGS_INPUT_CLASS} min-h-[120px]`}
              placeholder="블로그를 소개해주세요..."
            />
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
              <span>소개 문구는 블로그 홈에 표시됩니다</span>
              <span>{formData.description.length}/1000</span>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-[#2F3440] pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className={`text-xs font-medium ${
                generalSaveSuccess
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : generalSaving
                  ? 'text-gray-500 dark:text-gray-300'
                  : isGeneralDirty
                  ? 'text-gray-600 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {generalSaveSuccess
                ? '기본 정보가 저장되었습니다.'
                : generalSaving
                ? '저장 중...'
                : isGeneralDirty
                ? '변경 사항이 있습니다.'
                : '최신 상태입니다.'}
            </div>
            <button
              type="button"
              onClick={handleGeneralSave}
              disabled={!isGeneralDirty || generalSaving}
              className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
            >
              {generalSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                '변경 사항 저장'
              )}
            </button>
          </div>
        </section>

        {/* Blog Info */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-4`}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">블로그 정보</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center">
              <FiCalendar className="mr-2 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-300">생성일</span>
              <span className="ml-2 text-gray-900 dark:text-gray-50">
                {blog?.createdAt && format(new Date(blog.createdAt), 'yyyy년 MM월 dd일', { locale: ko })}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start sm:items-center min-w-0 flex-1">
                <FiLink className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-gray-600 dark:text-gray-300 block sm:inline">전체 URL:</span>
                  <a
                    href={`/${blog?.alias || blog?.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-0 sm:ml-2 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-gray-50 break-all block sm:inline"
                  >
                    {typeof window !== 'undefined' ? `${window.location.origin}/${blog?.alias || blog?.slug}` : `/${blog?.alias || blog?.slug}`}
                  </a>
                </div>
              </div>
              <button
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  navigator.clipboard.writeText(`${window.location.origin}/${blog?.alias || blog?.slug}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="min-w-[44px] min-h-[44px] p-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2F3A] rounded-md transition-colors flex items-center justify-center flex-shrink-0"
                title="주소 복사"
              >
                {copied ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-300 whitespace-nowrap">복사됨!</span>
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Blog Alias Settings */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-5`}>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">블로그 주소 설정</h3>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              주소를 변경하면 이전 주소는 자동으로 리다이렉트되어 SEO가 보호됩니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center text-sm p-3 bg-gray-50 dark:bg-[#2A2F3A] rounded-lg">
              <FiLink className="mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-300">현재 주소:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">
                @{blog?.alias || blog?.slug}
              </span>
            </div>

            <div className="space-y-2">
              <label htmlFor="newAlias" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                새로운 주소
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-300 text-sm">@</span>
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
                  className={`${SETTINGS_INPUT_CLASS} pl-8 pr-10`}
                />
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
                  <div className="flex items-start text-gray-500 dark:text-gray-300">
                    <FiAlertCircle className="mr-1 mt-0.5 flex-shrink-0" />
                    <span>최소 3자 이상 입력해주세요</span>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                3-30자, 영문 소문자/숫자/하이픈/언더스코어만 사용 가능
              </p>

              <button
                type="button"
                onClick={handleAliasUpdate}
                disabled={isUpdatingAlias || !aliasCheck?.available || newAlias.length < 3}
                className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
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
        </section>

        {/* Social Links */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-5`}>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">프로필 소셜 링크</h3>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              블로그 프로필 카드에 표시됩니다. 최대 3개까지 연결할 수 있습니다.
            </p>
          </div>

          <div className="space-y-4">
            {socialLinks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-300">
                아직 연결된 링크가 없습니다. 아래 버튼으로 추가해보세요.
              </div>
            ) : (
              <div className="space-y-4">
                {socialLinks.map((link, index) => (
                  <div
                    key={`${link.platform}-${index}`}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_auto] items-start"
                  >
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        플랫폼
                      </label>
                      <input
                        type="text"
                        list="social-platform-options"
                        value={link.platform}
                        onChange={(e) =>
                          handleSocialLinkChange(index, 'platform', e.target.value)
                        }
                        placeholder="instagram"
                        className={SETTINGS_INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        URL
                      </label>
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) =>
                          handleSocialLinkChange(index, 'url', e.target.value)
                        }
                        placeholder="https://"
                        className={SETTINGS_INPUT_CLASS}
                      />
                    </div>
                    <div className="flex items-center justify-end pt-6 sm:pt-7">
                      <button
                        type="button"
                        onClick={() => handleRemoveSocialLink(index)}
                        className="min-w-[44px] min-h-[44px] p-2 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#2A2F3A] rounded-md transition-colors"
                        aria-label="소셜 링크 삭제"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <datalist id="social-platform-options">
              <option value="instagram" />
              <option value="x" />
              <option value="github" />
              <option value="linkedin" />
              <option value="youtube" />
            </datalist>
          </div>

          <div className="border-t border-gray-100 dark:border-[#2F3440] pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAddSocialLink}
                disabled={socialLinks.length >= 3}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white disabled:opacity-50"
              >
                <FiPlus className="w-4 h-4" />
                링크 추가
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                https:// 주소만 저장됩니다. 저장 시 자동으로 https가 추가됩니다.
              </p>
              {socialLinksLimitNotice && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  {socialLinksLimitNotice}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className={`text-xs font-medium ${
                  socialLinksSuccess
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : socialLinksSaving
                    ? 'text-gray-500 dark:text-gray-300'
                    : isSocialLinksDirty
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {socialLinksSuccess
                  ? '소셜 링크가 저장되었습니다.'
                  : socialLinksSaving
                  ? '저장 중...'
                  : isSocialLinksDirty
                  ? '변경 사항이 있습니다.'
                  : '최신 상태입니다.'}
              </div>
              <button
                type="button"
                onClick={handleSocialLinksSave}
                disabled={!isSocialLinksDirty || socialLinksSaving}
                className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
              >
                {socialLinksSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  '소셜 링크 저장'
                )}
              </button>
            </div>
          </div>

          {socialLinksError && (
            <div className={`p-3 text-sm rounded-md ${DESTRUCTIVE_SURFACE_CLASS}`}>
              {socialLinksError}
            </div>
          )}
        </section>

        {/* Privacy Settings */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-5`}>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">공개 설정</h3>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              방문 권한과 댓글 허용 여부를 제어합니다.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center">
                <FiGlobe className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div>
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    블로그 공개
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">모든 사람이 블로그를 볼 수 있습니다</p>
                </div>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={async (newValue) => {
                  setFormData({ ...formData, isPublic: newValue });
                  await handlePublicSettingChange(newValue);
                }}
              />
            </div>
            {privacyFeedback.public && (
              <p
                className={`text-xs ${
                  privacyFeedback.public.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : privacyFeedback.public.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {privacyFeedback.public.text}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center">
                <FiMessageSquare className="mr-2 mt-0.5 sm:mt-0 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div>
                  <label htmlFor="allowComments" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    댓글 허용
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">방문자가 글에 댓글을 남길 수 있습니다</p>
                </div>
              </div>
              <Switch
                checked={formData.allowComments}
                onCheckedChange={async (newValue) => {
                  setFormData({ ...formData, allowComments: newValue });
                  await handleCommentsSettingChange(newValue);
                }}
              />
            </div>
            {privacyFeedback.comments && (
              <p
                className={`text-xs ${
                  privacyFeedback.comments.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : privacyFeedback.comments.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {privacyFeedback.comments.text}
              </p>
            )}
          </div>
        </section>

        {/* Branding Settings */}
        {blog && (
          <BlogBrandingSettings
            blog={blog}
            onRefresh={refreshAcrossPages}
          />
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className={`p-3 text-sm rounded-md ${DESTRUCTIVE_SURFACE_CLASS}`}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
