"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Plus } from 'lucide-react';
import type { FileUpload } from '@/types';
import { useUserCategories } from '@/hooks/usePosts';
import { toast } from 'sonner';

// Dynamic import for editor - 초기 로딩 속도 개선 (976 KB 청크 제거)
const BlogSimpleEditor = dynamic(
  () => import('@/editor').then(mod => ({ default: mod.BlogSimpleEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] border rounded-lg bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-gray-100 mx-auto" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">에디터 로딩 중...</p>
        </div>
      </div>
    )
  }
);

// 폼 스키마 정의
const postFormSchema = z.object({
  title: z.string()
    .min(1, { message: "제목을 입력해주세요." })
    .max(200, { message: "제목은 200자 이하로 입력해주세요." }),
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
  content: z.string()
    .min(1, { message: "내용을 입력해주세요." }),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  attachedFileIds: z.array(z.string()).optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface EditPostFormProps {
  initialData?: {
    title: string;
    category: string;
    content: string;
    tags?: string[];
    thumbnail?: string;
    attachedFiles?: FileUpload[];
  };
  isLoading?: boolean;
  onSubmit: (data: PostFormValues) => void;
  onCancel: () => void;
  submitButtonText?: string;
  title?: string;
  // Blog 컨텍스트 정보 (선택사항)
  blogInfo?: {
    name: string;
    slug: string;
  };
}

export default function EditPostForm({
  initialData,
  isLoading = false,
  onSubmit,
  onCancel,
  submitButtonText = "저장",
  title = "게시글 수정",
  blogInfo
}: EditPostFormProps) {
  const isSubmittingRef = useRef(false); // 동기적 중복 제출 방지 플래그

  // 썸네일 이미지 ID 상태 (기존 포스트의 thumbnailImageId 또는 빈 문자열)
  const [thumbnailImageId, setThumbnailImageId] = useState<string>(
    (initialData as any)?.thumbnailImageId || ''
  );

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      categories: [],  // useEffect에서 파싱하여 설정
      content: initialData?.content || '',
      tags: initialData?.tags || [],
      thumbnail: initialData?.thumbnail || '',
      attachedFileIds: [],
    },
  });

  // 초기 카테고리 파싱: "메인/서브" → ["메인", "서브"]
  useEffect(() => {
    if (initialData?.category) {
      const categories = initialData.category
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);

      form.setValue('categories', categories);
    }
  }, [initialData?.category, form]);

  // isLoading 상태 변경 시 isSubmittingRef 동기화
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
    }
  }, [isLoading]);

  const handleSubmit = (data: PostFormValues) => {
    // useRef를 통한 동기적 중복 제출 차단
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    // 제출 시작
    isSubmittingRef.current = true;

    // 카테고리 배열 → 문자열 변환 (백엔드는 "메인/서브" 형식 기대)
    const categoryString = data.categories.join('/');

    const formData: any = {
      ...data,
      category: categoryString,
      // 썸네일 이미지 ID 추가 (선택된 경우에만)
      ...(thumbnailImageId && { thumbnailImageId }),
    };

    // categories 필드 제거 (백엔드는 category 필드만 사용)
    delete formData.categories;

    onSubmit(formData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                          {/* 왼쪽 라벨 + 세로줄 컨테이너 (absolute로 배치) */}
                          {showLabel && (
                            <div className="absolute -left-24 top-1 flex items-start gap-2" style={{ height: textareaHeight + 'px' }}>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>제목</span>
                              </div>
                              <div className="w-px bg-gray-300 dark:bg-gray-600" style={{ height: '100%' }} />
                            </div>
                          )}

                          {/* 제목 입력 영역 */}
                          <div
                            className="cursor-text"
                            onClick={() => textareaRef.current?.focus()}
                          >
                            <Textarea
                              ref={(el) => {
                                hookFormRef(el);
                                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                              }}
                              placeholder=" 당신의 이야기를 들려주세요..."
                              {...restField}
                              disabled={isLoading}
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
                              disabled={categories.length >= 2 || isLoading}
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
                          {/* 왼쪽 라벨 (absolute로 배치, 세로줄 없음) */}
                          {showLabel && (
                            <div className="absolute -left-24 top-4">
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>태그</span>
                              </div>
                            </div>
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
                                    onClick={() => removeTag(index)}
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
                              disabled={isLoading}
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
                          {/* 왼쪽 라벨 (absolute로 배치, 세로줄 없음) */}
                          {showLabel && (
                            <div className="absolute -left-24 top-0">
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>내용</span>
                              </div>
                            </div>
                          )}

                          <div className="h-[500px]">
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
              onClick={onCancel}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              onClick={(e) => {
                // 3차 방어: 버튼 클릭 시 Form 제출 차단 (동기적 플래그 체크)
                if (isSubmittingRef.current || isLoading) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="flex items-center gap-2 min-w-[120px]"
              aria-label={isLoading ? "저장 중" : submitButtonText}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {submitButtonText}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 