'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Globe,
  Shield,
  Lock,
  AlertCircle,
  CheckCircle2,
  Camera,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreateCommunity, communityQueryKeys } from '@/hooks/community/useCommunities';
import { uploadCommunityImage } from '@/services/api/community.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CreateCommunityDto, JoinPolicyType } from '@/types/community';
import { JoinPolicy } from '@/types/community';

// 슬러그 유효성 검사 정규식 (소문자, 숫자, 언더스코어만 허용)
const SLUG_REGEX = /^[a-z0-9_]+$/;
const RESERVED_SLUGS = ['create', 'settings', 'admin', 'mod', 'api', 'new', 'edit', 'delete'];

/**
 * 커뮤니티 생성 페이지 (/community/create)
 * - 커뮤니티 이름 및 슬러그
 * - 설명
 * - 아이콘 및 배너 이미지
 * - 가입 정책
 * - NSFW 설정
 */
export default function CreateCommunityPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // 폼 상태
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicyType>(JoinPolicy.OPEN);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isPostDiscoverable, setIsPostDiscoverable] = useState(true);
  const [visibilityResetPending, setVisibilityResetPending] = useState(false);

  // 이미지 상태
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // 유효성 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // 이미지 업로드 상태
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Mutations
  const createCommunityMutation = useCreateCommunity();

  const isVisibilityLocked = joinPolicy === JoinPolicy.PRIVATE;

  useEffect(() => {
    if (joinPolicy === JoinPolicy.PRIVATE) {
      setIsPublic(false);
      setIsPostDiscoverable(false);
      setVisibilityResetPending(true);
      return;
    }

    if (visibilityResetPending) {
      setIsPublic(true);
      setIsPostDiscoverable(true);
      setVisibilityResetPending(false);
    }
  }, [joinPolicy, visibilityResetPending]);

  // 인증 확인 (로그인 필요)
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login?redirect=/c/create');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // 슬러그 자동 생성 (이름에서)
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    // 이름에서 슬러그 자동 생성 (공백 -> 언더스코어, 소문자 변환)
    const autoSlug = value
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30);
    setSlug(autoSlug);
  }, []);

  // 슬러그 직접 변경
  const handleSlugChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    setSlug(sanitized);
    setIsSlugAvailable(null);
  }, []);

  // 슬러그 유효성 검사
  const slugError = useMemo(() => {
    if (!slug) return null;
    if (slug.length < 3) return 'Slug must be at least 3 characters.';
    if (slug.length > 30) return 'Slug must be 30 characters or fewer.';
    if (!SLUG_REGEX.test(slug)) return 'Use lowercase letters, numbers, and underscores only.';
    if (RESERVED_SLUGS.includes(slug)) return 'This slug is reserved.';
    return null;
  }, [slug]);

  // 아이콘 이미지 선택
  const handleIconSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 검사 (최대 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, icon: 'Image size must be 5MB or less.' }));
        return;
      }
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, icon: '' }));
    }
  }, []);

  // 배너 이미지 선택
  const handleBannerSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 검사 (최대 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, banner: 'Image size must be 10MB or less.' }));
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, banner: '' }));
    }
  }, []);

  // 아이콘 제거
  const handleRemoveIcon = useCallback(() => {
    setIconFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
  }, [iconPreview]);

  // 배너 제거
  const handleRemoveBanner = useCallback(() => {
    setBannerFile(null);
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
    }
  }, [bannerPreview]);

  // 클린업
  useEffect(() => {
    return () => {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [iconPreview, bannerPreview]);

  // 폼 제출
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Enter a community name.';
    } else if (name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters.';
    } else if (name.length > 50) {
      newErrors.name = 'Name must be 50 characters or fewer.';
    }

    if (slugError) {
      newErrors.slug = slugError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      // 1. 커뮤니티 먼저 생성 (이미지 URL 없이)
      const communityData: CreateCommunityDto = {
        name: name.trim(),
        slug: slug,
        description: description.trim() || undefined,
        joinPolicy,
        isNsfw,
        isPublic,
        isPostDiscoverable,
      };

      const result = await createCommunityMutation.mutateAsync(communityData);

      // 2. 커뮤니티 생성 후 이미지 업로드 (V2 ContextualFile)
      // 커뮤니티 ID가 필요하므로 생성 후 업로드
      if (iconFile || bannerFile) {
        setIsUploadingImages(true);

        try {
          // 병렬로 아이콘과 배너 업로드 - 개별 결과 추적
          const uploadResults: { type: 'icon' | 'banner'; success: boolean; error?: string }[] = [];

          const uploadTasks: Promise<void>[] = [];

          if (iconFile) {
            uploadTasks.push(
              uploadCommunityImage(result.slug, 'icon', iconFile)
                .then(() => {
                  uploadResults.push({ type: 'icon', success: true });
                })
                .catch((err: Error) => {
                  uploadResults.push({ type: 'icon', success: false, error: err.message });
                })
            );
          }

          if (bannerFile) {
            uploadTasks.push(
              uploadCommunityImage(result.slug, 'banner', bannerFile)
                .then(() => {
                  uploadResults.push({ type: 'banner', success: true });
                })
                .catch((err: Error) => {
                  uploadResults.push({ type: 'banner', success: false, error: err.message });
                })
            );
          }

          // 모든 업로드 완료 대기 (실패해도 계속 진행)
          await Promise.all(uploadTasks);

          // 이미지 업로드 완료 후 캐시 무효화 (최신 이미지 URL 반영)
          // 서버에서 새로운 이미지 URL을 가져오도록 함
          await queryClient.invalidateQueries({
            queryKey: communityQueryKeys.detail(result.slug)
          });

          // 업로드 실패한 항목이 있으면 사용자에게 알림
          const failedUploads = uploadResults.filter(r => !r.success);
          if (failedUploads.length > 0) {
            const failedTypes = failedUploads
              .map(f => f.type === 'icon' ? 'icon' : 'banner')
              .join(', ');
            const errorDetails = failedUploads
              .map(f => `${f.type}: ${f.error}`)
              .join('\n');

            console.error('Image upload failed:', errorDetails);

            // 사용자에게 알림 (커뮤니티는 생성됨)
            alert(
              `Failed to upload the following images: ${failedTypes}.\n` +
              `You can upload them again from community settings.\n\n` +
              `Error details:\n${errorDetails}`
            );
          }
        } catch (uploadError) {
          // 예상치 못한 에러 처리
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
          console.error('Unexpected error during image upload:', errorMessage);
          alert(`An error occurred while uploading images: ${errorMessage}`);
        } finally {
          setIsUploadingImages(false);
        }
      }

      // 생성된 커뮤니티로 이동
      router.push(`/c/${result.slug}`);
    } catch {
      // 커뮤니티 생성 에러는 mutation에서 처리
    }
  }, [name, slug, slugError, description, joinPolicy, isNsfw, isPublic, isPostDiscoverable, iconFile, bannerFile, createCommunityMutation, router, queryClient]);

  // 가입 정책 옵션
  const joinPolicyOptions = [
    {
      value: JoinPolicy.OPEN,
      label: 'Open',
      description: 'Anyone can join instantly.',
      icon: Globe,
    },
    {
      value: JoinPolicy.RESTRICTED,
      label: 'Restricted',
      description: 'New members must be approved by moderators.',
      icon: Shield,
    },
    {
      value: JoinPolicy.PRIVATE,
      label: 'Private',
      description: 'Only invited users can join.',
      icon: Lock,
    },
  ];

  // 로딩 상태
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-[500px] bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isSubmitting = createCommunityMutation.isPending || isUploadingImages;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 - sticky 제거 (메인 헤더와 z-index 충돌 방지) */}
      <header className="bg-white dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Create community
              </h1>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !slug || !!slugError}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* 폼 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 배너 이미지 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Banner image</Label>
            <div className="relative">
              <div
                className={cn(
                  'relative h-32 sm:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600',
                  !bannerPreview && 'flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity'
                )}
                onClick={() => !bannerPreview && document.getElementById('banner-input')?.click()}
              >
                {bannerPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBanner();
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Add a banner image</p>
                    <p className="text-xs text-gray-400">Recommended: 1500x500px</p>
                  </div>
                )}
              </div>
              <input
                id="banner-input"
                type="file"
                accept="image/*"
                onChange={handleBannerSelect}
                className="hidden"
              />
            </div>
            {errors.banner && (
              <span className="text-xs text-red-500">{errors.banner}</span>
            )}
          </div>

          {/* 아이콘 이미지 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Icon</Label>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600',
                  !iconPreview && 'flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity'
                )}
                onClick={() => !iconPreview && document.getElementById('icon-input')?.click()}
              >
                {iconPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={iconPreview}
                      alt="Icon preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveIcon();
                      }}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <Camera className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('icon-input')?.click()}
                >
                  {iconPreview ? 'Change' : 'Upload'}
                </Button>
                <p className="text-xs text-gray-400 mt-1">Recommended: 256x256px</p>
              </div>
              <input
                id="icon-input"
                type="file"
                accept="image/*"
                onChange={handleIconSelect}
                className="hidden"
              />
            </div>
            {errors.icon && (
              <span className="text-xs text-red-500">{errors.icon}</span>
            )}
          </div>

          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Community name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. builders_hub"
              maxLength={50}
              className={cn(errors.name && 'border-red-500')}
              disabled={isSubmitting}
            />
            <div className="flex justify-between text-xs">
              {errors.name ? (
                <span className="text-red-500">{errors.name}</span>
              ) : (
                <span className="text-gray-400">This is the public display name.</span>
              )}
              <span className="text-gray-400">{name.length}/50</span>
            </div>
          </div>

          {/* 슬러그 */}
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm font-medium">
              Slug (URL) <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">c/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="programming_kr"
                maxLength={30}
                className={cn(
                  'flex-1',
                  (errors.slug || slugError) && 'border-red-500',
                  isSlugAvailable === true && 'border-green-500'
                )}
                disabled={isSubmitting}
              />
              {slug && !slugError && (
                <div className="flex-shrink-0">
                  {isCheckingSlug ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : isSlugAvailable === true ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : isSlugAvailable === false ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs">
              {errors.slug || slugError ? (
                <span className="text-red-500">{errors.slug || slugError}</span>
              ) : isSlugAvailable === false ? (
                <span className="text-red-500">That slug is already taken.</span>
              ) : (
                <span className="text-gray-400">Lowercase letters, numbers, and underscores only.</span>
              )}
              <span className="text-gray-400">{slug.length}/30</span>
            </div>
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              maxLength={500}
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
            />
            <div className="flex justify-end text-xs">
              <span className="text-gray-400">{description.length}/500</span>
            </div>
          </div>

          {/* 가입 정책 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Join policy</Label>
            <div className="grid gap-3">
              {joinPolicyOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = joinPolicy === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setJoinPolicy(option.value)}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border text-left transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                    disabled={isSubmitting}
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                        isSelected
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {option.label}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 추가 옵션 */}
          <div className="space-y-4 bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">NSFW community</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  For adult or sensitive content.
                </p>
              </div>
              <Switch
                checked={isNsfw}
                onCheckedChange={setIsNsfw}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Show community in lists and search</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  If disabled, people can only access it with a direct link.
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={isSubmitting || isVisibilityLocked}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Show posts across discovery surfaces</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Posts can appear on the home feed, search, and trending surfaces.
                </p>
              </div>
              <Switch
                checked={isPostDiscoverable}
                onCheckedChange={setIsPostDiscoverable}
                disabled={isSubmitting || isVisibilityLocked}
              />
            </div>
            {isVisibilityLocked && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Private communities are member-only, so discovery toggles are disabled.
              </p>
            )}
          </div>

          {/* 하단 버튼 (모바일용) */}
          <div className="flex gap-3 pt-4 sm:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !name.trim() || !slug || !!slugError}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
