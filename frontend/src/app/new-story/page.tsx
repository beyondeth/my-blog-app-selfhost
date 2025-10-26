"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreatePost } from '@/hooks/usePosts';
import { useMyBlogs } from '@/hooks/useBlogs';
import type { UploadedImageInfo } from '@/editor';
import Spinner from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Plus } from 'lucide-react';
import React from 'react';
import CategoryAutocomplete from '@/components/ui/CategoryAutocomplete';

// Dynamic import for editor - 초기 로딩 속도 개선
const BlogRichTextEditor = dynamic(
  () => import('@/editor').then(mod => mod.BlogRichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] border rounded-lg bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-sm text-gray-500">에디터 로딩 중...</p>
        </div>
      </div>
    )
  }
);

// Zod 스키마 정의
const postSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  category: z.string().min(1, '카테고리를 입력해주세요.'),
  content: z.string().min(1, '내용을 입력해주세요.'),
  tags: z.array(z.string()).optional(),
  fileIds: z.array(z.string()).optional(),
});

type PostFormData = z.infer<typeof postSchema>;

export default function NewStoryPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useAuth();
  const { data: blogs, isLoading: isBlogsLoading } = useMyBlogs();
  const createPostMutation = useCreatePost();
  
  // 사용자의 첫 번째 블로그 가져오기 (한 사용자당 하나의 블로그)
  const blog = blogs && blogs.length > 0 ? blogs[0] : null;
  
  // 상태를 여기서 중앙 관리 (기존과 동일)
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');
  const [isUploadValid, setIsUploadValid] = useState<boolean>(true);
  const [uploadValidationReason, setUploadValidationReason] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 중복 제출 방지를 위한 ref (타이밍 이슈 방지)
  const isSubmittingRef = useRef<boolean>(false);

  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      category: '',
      content: '',
      tags: [],
      fileIds: [],
    },
  });
  
  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isUserLoading && !user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login?redirect=/new-story');
    }
  }, [user, isUserLoading, router]);
  
  // 블로그가 없는 경우 처리
  useEffect(() => {
    if (!isBlogsLoading && user && !blog) {
      // 블로그가 없으면 홈으로 리다이렉트 (또는 블로그 생성 페이지로)
      toast.error('블로그를 먼저 생성해주세요.');
      router.push('/');
    }
  }, [blog, isBlogsLoading, user, router]);
  
  // 이미지 목록이 변경될 때마다 form의 fileIds를 업데이트
  useEffect(() => {
    const fileIds = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .map(img => img.id);
    form.setValue('fileIds', fileIds);

    const allImageIds = images.filter(img => !img.isUploading).map(img => img.id);

    if (allImageIds.length > 0) {
      const currentSelectionValid = selectedThumbnailId && allImageIds.includes(selectedThumbnailId);

      if (!currentSelectionValid) {
        setSelectedThumbnailId(allImageIds[0]);
      }
    } else if (selectedThumbnailId) {
      setSelectedThumbnailId('');
    }
  }, [images, selectedThumbnailId, form]);

  // Upload validation handler (기존과 동일)
  const handleUploadValidationChange = (isValid: boolean, reason?: string) => {
    setIsUploadValid(isValid);
    setUploadValidationReason(reason);
  };
  
  // 폼 제출 핸들러 (중복 제출 방지 강화)
  const onSubmit = async (data: PostFormData) => {
    if (!isUploadValid) {
      toast.error(`업로드 제한 초과: ${uploadValidationReason}`);
      return;
    }

    // Ref 기반 중복 방지 (타이밍 이슈에도 안전)
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const postData: any = {
        title: data.title,
        category: data.category,
        content: data.content,
        tags: data.tags,
        attachedFileIds: data.fileIds,
      };
      
      // 썸네일 처리 (기존과 동일)
      if (selectedThumbnailId) {
        if (selectedThumbnailId.startsWith('yt_thumb_')) {
          const selectedImage = images.find(img => img.id === selectedThumbnailId);
          if (selectedImage) {
            postData.thumbnail = selectedImage.url;
          }
        } else {
          postData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
        }
      }
      
      const result = await createPostMutation.mutateAsync(postData);

      // 성공 시 해당 블로그의 포스트로 이동 (blog는 항상 존재)
      router.push(`/${blog!.slug}/${result.slug}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('포스트 저장에 실패했습니다.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Loading states
  if (isBlogsLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  // 로그인하지 않은 경우 (이미 useEffect에서 리다이렉트되지만 안전장치)
  if (!user) {
    return null;
  }

  // 블로그가 없는 경우 (이미 useEffect에서 리다이렉트되지만 안전장치)
  if (!blog) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="space-y-4 pt-16">
              {/* 제목 */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => {
                  // React Hook Form의 ref와 커스텀 ref 분리
                  const { ref: hookFormRef, ...restField } = field;
                  const [isFocused, setIsFocused] = React.useState(false);
                  const [textareaHeight, setTextareaHeight] = React.useState(0);
                  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
                  const showLabel = isFocused || field.value;

                  React.useEffect(() => {
                    if (textareaRef.current) {
                      setTextareaHeight(textareaRef.current.scrollHeight);
                    }
                  }, [field.value]);

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          {/* 라벨: 모바일=상단, 데스크톱=왼쪽 */}
                          {showLabel && (
                            <>
                              {/* 모바일 라벨 (상단) */}
                              <div className="mb-2 lg:hidden">
                                <span className="text-xs text-gray-500 dark:text-gray-400">제목</span>
                              </div>
                              {/* 데스크톱 라벨 (왼쪽) */}
                              <div className="hidden lg:flex absolute -left-24 top-0 items-start gap-2" style={{ height: textareaHeight + 'px' }}>
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>제목</span>
                                </div>
                                <div className="w-px bg-gray-300 dark:bg-gray-600" style={{ height: '100%' }} />
                              </div>
                            </>
                          )}

                          {/* 제목 입력 영역 */}
                          <Textarea
                            ref={(el) => {
                              hookFormRef(el);              // React Hook Form의 ref
                              (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                            }}
                            placeholder=" 일단 쓰시죠..."
                            {...restField}
                            disabled={isSubmitting || createPostMutation.isPending}
                            onFocus={(e) => {
                              setIsFocused(true);
                              field.onBlur();
                            }}
                            onBlur={(e) => {
                              setIsFocused(false);
                              field.onBlur();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault(); // 엔터 키로 줄바꿈 방지
                              }
                            }}
                            rows={1}
                            className="!text-lg border-0 border-b border-gray-300 dark:border-gray-600 rounded-none px-0 resize-none overflow-hidden focus-visible:ring-0 focus-visible:border-gray-900 dark:focus-visible:border-gray-100 min-h-0 py-1 w-full placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
                            style={{
                              height: 'auto',
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                              setTextareaHeight(target.scrollHeight);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* 카테고리 */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => {
                  const [isFocused, setIsFocused] = React.useState(false);
                  const showLabel = isFocused || field.value;

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          {/* 라벨: 모바일=상단, 데스크톱=왼쪽 */}
                          {showLabel && (
                            <>
                              {/* 모바일 라벨 (상단) */}
                              <div className="mb-2 lg:hidden">
                                <span className="text-xs text-gray-500 dark:text-gray-400">카테고리</span>
                              </div>
                              {/* 데스크톱 라벨 (왼쪽) */}
                              <div className="hidden lg:block absolute -left-24 top-0">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>카테고리</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* 카테고리 입력 영역 (자동완성) */}
                          <div className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2">
                            <CategoryAutocomplete
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={() => {
                                setIsFocused(false);
                                field.onBlur();
                              }}
                              disabled={isSubmitting || createPostMutation.isPending}
                              placeholder=" 카테고리 입력 (필수)"
                              className="!border-0 focus-visible:ring-0 !px-0 text-lg h-auto py-1 w-auto min-w-[235px] !bg-transparent !rounded-none"
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* 태그 */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => {
                  const [inputValue, setInputValue] = React.useState('');
                  const [isFocused, setIsFocused] = React.useState(false);
                  const [isComposing, setIsComposing] = React.useState(false);
                  const tags = field.value || [];
                  const showLabel = isFocused || tags.length > 0 || inputValue;

                  const handleInputChange = (value: string) => {
                    // 콤마가 입력되면 태그로 변환
                    if (value.endsWith(',')) {
                      const newTag = value.slice(0, -1).trim();
                      if (newTag && !tags.includes(newTag)) {
                        field.onChange([...tags, newTag]);
                      }
                      setInputValue('');
                    } else {
                      setInputValue(value);
                    }
                  };

                  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                    // 한글 입력 중일 때는 Enter 키 처리 안함
                    if (e.key === 'Enter' && !isComposing) {
                      e.preventDefault();
                      const newTag = inputValue.trim();
                      if (newTag && !tags.includes(newTag)) {
                        field.onChange([...tags, newTag]);
                        setInputValue('');
                      }
                    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
                      // 입력값이 없을 때 Backspace로 마지막 태그 삭제
                      field.onChange(tags.slice(0, -1));
                    }
                  };

                  const removeTag = (indexToRemove: number) => {
                    field.onChange(tags.filter((_: string, index: number) => index !== indexToRemove));
                  };

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          {/* 라벨: 모바일=상단, 데스크톱=왼쪽 */}
                          {showLabel && (
                            <>
                              {/* 모바일 라벨 (상단) */}
                              <div className="mb-2 lg:hidden">
                                <span className="text-xs text-gray-500 dark:text-gray-400">태그</span>
                              </div>
                              {/* 데스크톱 라벨 (왼쪽) */}
                              <div className="hidden lg:block absolute -left-24 top-0">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>태그</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* 태그 표시 및 입력 영역 */}
                          <div className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {tags.map((tag: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                                >
                                  <span>#{tag}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeTag(index)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <Input
                              value={inputValue}
                              onChange={(e) => handleInputChange(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onCompositionStart={() => setIsComposing(true)}
                              onCompositionEnd={() => setIsComposing(false)}
                              onFocus={() => setIsFocused(true)}
                              onBlur={() => setIsFocused(false)}
                              disabled={isSubmitting || createPostMutation.isPending}
                              placeholder={!inputValue ? " 태그 입력 후 콤마(,) 또는 Enter" : ""}
                              className="!border-0 focus-visible:ring-0 !px-0 text-lg h-auto py-1 w-auto min-w-[235px] !bg-transparent !rounded-none"
                              style={{ width: inputValue ? `${Math.max(235, inputValue.length * 14)}px` : '235px' }}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </CardContent>
          </Card>

          {/* 내용 */}
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent>
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => {
                  const showLabel = field.value && field.value.length > 0;

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          {/* 라벨: 모바일=상단, 데스크톱=왼쪽 */}
                          {showLabel && (
                            <>
                              {/* 모바일 라벨 (상단) */}
                              <div className="mb-2 lg:hidden">
                                <span className="text-xs text-gray-500 dark:text-gray-400">내용</span>
                              </div>
                              {/* 데스크톱 라벨 (왼쪽) */}
                              <div className="hidden lg:block absolute -left-24 top-0">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>내용</span>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="min-h-[300px] lg:min-h-[400px]">
                            <BlogRichTextEditor
                              content={field.value}
                              onChange={field.onChange}
                              onFilesChange={(fileIds) => {
                                // File IDs are handled via images state
                              }}
                              onThumbnailSelect={setSelectedThumbnailId}
                              selectedThumbnailId={selectedThumbnailId}
                              onImagesChange={setImages}
                              onValidationChange={handleUploadValidationChange}
                              enableImageManager={true}
                              maxImages={10}
                              placeholder=" 내용을 입력하세요..."
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </CardContent>
          </Card>

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={
                isSubmitting ||
                createPostMutation.isPending ||
                form.formState.isSubmitting
              }
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={
                !isUploadValid ||
                isSubmitting ||
                createPostMutation.isPending ||
                !form.formState.isValid ||
                form.formState.isSubmitting
              }
              className="flex items-center justify-center gap-2 min-w-[120px]"
              title={!isUploadValid ? uploadValidationReason : undefined}
            >
              {isSubmitting || createPostMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  저장중...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  저장
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}