"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreatePost, useUserCategories } from '@/hooks/usePosts';
import { useMyBlogs } from '@/hooks/useBlogs';
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

// Dynamic import for editor - 초기 로딩 속도 개선
const BlogSimpleEditor = dynamic(
  () => import('@/editor').then(mod => ({ default: mod.BlogSimpleEditor })),
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
  categories: z.array(
      z.string()
        .min(1, '카테고리는 최소 1글자 이상이어야 합니다.')
        .max(15, '카테고리는 최대 15글자까지 입력 가능합니다.')
    )
    .min(1, '카테고리를 최소 1개 입력해주세요.')
    .max(2, '카테고리는 최대 2개까지만 입력 가능합니다.')
    .refine(
      (arr) => arr.every(cat => !cat.includes('/')),
      { message: '카테고리에 슬래시(/)를 포함할 수 없습니다.' }
    ),
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

  // 중복 제출 방지용 플래그
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef(false);

  // 썸네일 이미지 ID 상태
  const [thumbnailImageId, setThumbnailImageId] = useState<string>('');

  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      categories: [],
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

  // 폼 제출 핸들러
  const onSubmit = async (data: PostFormData) => {
    // useRef를 통한 동기적 중복 제출 차단
    if (isSubmittingRef.current || createPostMutation.isPending) {
      return;
    }

    // 제출 시작 - Ref를 먼저 설정 (동기적, 즉시 적용)
    isSubmittingRef.current = true;
    setIsSubmitting(true); // UI 업데이트용

    try {
      // 카테고리 배열 → "메인/서브" 문자열로 변환 (백엔드 호환)
      const categoryString = data.categories.join('/');

      const postData: any = {
        title: data.title,
        category: categoryString,
        content: data.content,
        tags: data.tags,
        attachedFileIds: data.fileIds,
        // 썸네일 이미지 ID 추가 (선택된 경우에만)
        ...(thumbnailImageId && { thumbnailImageId }),
      };

      const result = await createPostMutation.mutateAsync(postData);

      // 성공 시 해당 블로그의 포스트로 이동 (페이지 이동하므로 플래그 초기화 불필요)
      router.push(`/${blog!.slug}/${result.slug}`);
    } catch (error) {
      // 에러 발생 시에만 플래그 초기화 (재시도 가능하도록)
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      console.error('Failed to create post:', error);
      toast.error('포스트 저장에 실패했습니다.');
    }
    // 성공 시 페이지가 이동되므로 finally 블록 불필요
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
                              <div className="hidden lg:flex absolute -left-24 top-1 items-start gap-2" style={{ height: textareaHeight + 'px' }}>
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>제목</span>
                                </div>
                                <div className="w-px bg-gray-300 dark:bg-gray-600" style={{ height: '100%' }} />
                              </div>
                            </>
                          )}

                          {/* 제목 입력 영역 */}
                          <div
                            className="cursor-text"
                            onClick={() => textareaRef.current?.focus()}
                          >
                            <Textarea
                              ref={(el) => {
                                hookFormRef(el);              // React Hook Form의 ref
                                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                              }}
                              placeholder=" 당신의 이야기를 들려주세요..."
                              {...restField}
                              disabled={createPostMutation.isPending}
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
                name="categories"
                render={({ field }) => {
                  const [inputValue, setInputValue] = React.useState('');
                  const [isFocused, setIsFocused] = React.useState(false);
                  const [isComposing, setIsComposing] = React.useState(false);
                  const [showDropdown, setShowDropdown] = React.useState(false);
                  const categoryInputRef = React.useRef<HTMLInputElement>(null);
                  const categories = field.value || [];
                  const showLabel = isFocused || categories.length > 0 || inputValue;

                  // 자동완성 데이터
                  const { data: userCategories = [], isLoading: isCategoriesLoading } = useUserCategories();

                  // 입력값으로 필터링된 자동완성 목록
                  const filteredCategories = useMemo(() => {
                    if (!inputValue.trim()) return userCategories;
                    const lowerInput = inputValue.toLowerCase();
                    return userCategories.filter(cat => cat.toLowerCase().includes(lowerInput));
                  }, [userCategories, inputValue]);

                  const handleInputChange = (value: string) => {
                    // 콤마가 입력되면 카테고리로 변환
                    if (value.endsWith(',')) {
                      const newCategory = value.slice(0, -1).trim();
                      // 길이 검증: 1~15자
                      if (newCategory.length > 15) {
                        toast.error('카테고리는 최대 15글자까지 입력 가능합니다.');
                        setInputValue('');
                        setShowDropdown(false);
                        return;
                      }
                      if (newCategory && categories.length < 2 && !categories.includes(newCategory) && !newCategory.includes('/')) {
                        field.onChange([...categories, newCategory]);
                      }
                      setInputValue('');
                      setShowDropdown(false);
                    } else {
                      setInputValue(value);
                    }
                  };

                  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                    if ((e.key === 'Enter') && !isComposing) {
                      e.preventDefault();
                      const newCategory = inputValue.trim().replace(/,/g, '');

                      // 길이 검증: 1~15자
                      if (newCategory.length > 15) {
                        toast.error('카테고리는 최대 15글자까지 입력 가능합니다.');
                        setInputValue('');
                        setShowDropdown(false);
                        return;
                      }

                      if (newCategory && categories.length < 2 && !categories.includes(newCategory) && !newCategory.includes('/')) {
                        field.onChange([...categories, newCategory]);
                        setInputValue('');
                        setShowDropdown(false);
                      }
                    } else if (e.key === 'Backspace' && !inputValue && categories.length > 0) {
                      // 입력값이 없을 때 Backspace로 마지막 카테고리 삭제
                      field.onChange(categories.slice(0, -1));
                    }
                  };

                  // 자동완성 선택
                  const selectCategory = (category: string) => {
                    // "메인/서브" 형식이면 파싱
                    const parts = category.split('/').map(s => s.trim()).filter(Boolean);

                    // 각 카테고리 길이 검증: 1~15자
                    const invalidPart = parts.find(part => part.length > 15);
                    if (invalidPart) {
                      toast.error('카테고리는 최대 15글자까지 입력 가능합니다.');
                      setShowDropdown(false);
                      return;
                    }

                    // 현재 카테고리 개수 + 추가할 개수가 2개 초과하면 차단
                    if (categories.length + parts.length > 2) {
                      toast.error('카테고리는 최대 2개까지만 입력 가능합니다.');
                      setShowDropdown(false);
                      return;
                    }

                    const newCategories = [...categories];
                    parts.forEach(part => {
                      if (!newCategories.includes(part)) {
                        newCategories.push(part);
                      }
                    });

                    field.onChange(newCategories.slice(0, 2));
                    setInputValue('');
                    setShowDropdown(false);
                  };

                  // 카테고리 삭제 (첫 번째 삭제 시 두 번째가 첫 번째로 승격)
                  const removeCategory = (indexToRemove: number) => {
                    const newCategories = categories.filter((_: string, i: number) => i !== indexToRemove);
                    field.onChange(newCategories);
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
                                <span className="text-xs text-gray-500 dark:text-gray-400">카테고리</span>
                              </div>
                              {/* 데스크톱 라벨 (왼쪽) */}
                              <div className="hidden lg:block absolute -left-24 top-4">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>카테고리</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* 카테고리 입력 영역 */}
                          <div
                            className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2 cursor-text"
                            onClick={(e) => {
                              // 카테고리 삭제 버튼 클릭 시 포커스 방지
                              if ((e.target as HTMLElement).closest('button')) {
                                return;
                              }
                              categoryInputRef.current?.focus();
                            }}
                          >
                            {/* 카테고리 칩 표시 (# 없이) */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {categories.map((category: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                                >
                                  <span>{category}</span>
                                  {index === 0 && <span className="text-xs text-gray-500 dark:text-gray-400">(메인)</span>}
                                  {index === 1 && <span className="text-xs text-gray-500 dark:text-gray-400">(서브)</span>}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCategory(index);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>

                            {/* 입력 필드 */}
                            <Input
                              ref={categoryInputRef}
                              value={inputValue}
                              onChange={(e) => {
                                handleInputChange(e.target.value);
                                setShowDropdown(e.target.value.trim().length > 0);
                              }}
                              onKeyDown={handleKeyDown}
                              onCompositionStart={() => setIsComposing(true)}
                              onCompositionEnd={() => setIsComposing(false)}
                              onFocus={() => {
                                setIsFocused(true);
                                setShowDropdown(inputValue.trim().length > 0);
                              }}
                              onBlur={() => {
                                // 입력 중인 값이 있으면 자동으로 추가 (엔터/콤마 없이 저장 시)
                                const trimmedValue = inputValue.trim().replace(/,/g, '');
                                if (trimmedValue && categories.length < 2 && !categories.includes(trimmedValue) && !trimmedValue.includes('/')) {
                                  // 길이 검증: 1~15자
                                  if (trimmedValue.length >= 1 && trimmedValue.length <= 15) {
                                    field.onChange([...categories, trimmedValue]);
                                    setInputValue('');
                                  }
                                }
                                setIsFocused(false);
                                setTimeout(() => setShowDropdown(false), 200);
                                field.onBlur();
                              }}
                              disabled={categories.length >= 2 || createPostMutation.isPending}
                              placeholder={categories.length >= 2
                                ? " 최대 2개까지 입력 가능합니다"
                                : " 입력 후 엔터 또는 콤마로 구분"
                              }
                              className="!border-0 focus-visible:ring-0 !px-0 text-lg h-auto py-1 w-auto min-w-[235px] !bg-transparent !rounded-none"
                              style={{ width: inputValue ? `${Math.max(235, inputValue.length * 14)}px` : '235px' }}
                            />

                            {/* 자동완성 드롭다운 */}
                            {showDropdown && filteredCategories.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredCategories.map((category, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => selectCategory(category)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                  >
                                    <span className="mr-2">🏷️</span>
                                    {category}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* 안내 문구 */}
                            {!inputValue && categories.length === 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-0">
                                💡 최대 2개 입력 가능 (메인, 서브)
                              </p>
                            )}
                            {categories.length === 2 && (
                              <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 ml-0">
                                ⚠️ 카테고리는 최대 2개까지만 입력 가능합니다
                              </p>
                            )}
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
                  const tagInputRef = React.useRef<HTMLInputElement>(null);
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
                              <div className="hidden lg:block absolute -left-24 top-4">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <Plus className="h-3 w-3" />
                                  <span>태그</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* 태그 표시 및 입력 영역 - 전체 영역 클릭 시 포커스 */}
                          <div
                            className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2 cursor-text"
                            onClick={(e) => {
                              // 태그 삭제 버튼 클릭 시 포커스 방지
                              if ((e.target as HTMLElement).closest('button')) {
                                return;
                              }
                              tagInputRef.current?.focus();
                            }}
                          >
                            <div className="flex flex-wrap gap-2 mb-2">
                              {tags.map((tag: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                                >
                                  <span>#{tag}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation(); // 부모 div의 onClick 방지
                                      removeTag(index);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <Input
                              ref={tagInputRef}
                              value={inputValue}
                              onChange={(e) => handleInputChange(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onCompositionStart={() => setIsComposing(true)}
                              onCompositionEnd={() => setIsComposing(false)}
                              onFocus={() => setIsFocused(true)}
                              onBlur={() => setIsFocused(false)}
                              disabled={createPostMutation.isPending}
                              placeholder={!inputValue ? " 입력 후 엔터 또는 콤마로 구분" : ""}
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

                          <div className="h-[400px] lg:h-[500px]">
                            <BlogSimpleEditor
                              content={field.value}
                              onChange={field.onChange}
                              placeholder=" 내용을 입력하세요..."
                              thumbnailImageId={thumbnailImageId}
                              onThumbnailChange={setThumbnailImageId}
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
              disabled={createPostMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createPostMutation.isPending
              }
              onClick={(e) => {
                // 3차 방어: 버튼 클릭 시 Form 제출 차단
                if (isSubmitting || createPostMutation.isPending) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="flex items-center justify-center gap-2 min-w-[120px]"
              aria-label={isSubmitting || createPostMutation.isPending ? "저장 중" : "저장"}
            >
              {isSubmitting || createPostMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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