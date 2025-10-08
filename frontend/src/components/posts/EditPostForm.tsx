"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { BlogRichTextEditor } from '@/editor';
import type { UploadedImageInfo } from '@/editor';
import type { FileUpload } from '@/types';

// 폼 스키마 정의
const postFormSchema = z.object({
  title: z.string()
    .min(1, { message: "제목을 입력해주세요." })
    .max(200, { message: "제목은 200자 이하로 입력해주세요." }),
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
  // 이미지 및 썸네일 상태 관리 (new-story/page.tsx와 동일)
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');
  const [isUploadValid, setIsUploadValid] = useState<boolean>(true);
  const [uploadValidationReason, setUploadValidationReason] = useState<string | undefined>();

  // DB의 attachedFiles 중 content HTML에 실제로 있는 이미지만 추출 + content에서 모든 유튜브 iframe 추출 (useMemo 사용)
  // 에디터 초기화 시 한 번만 사용되는 초기 이미지 데이터
  const initialImages = useMemo(() => {
    const result: UploadedImageInfo[] = [];

    // 1) 기존 로직: attachedFiles에서 실제 사용중인 이미지 추출
    if (initialData?.content && initialData?.attachedFiles && initialData.attachedFiles.length > 0) {
      // content HTML에서 실제 사용중인 이미지 ID 추출
      const parser = new DOMParser();
      const doc = parser.parseFromString(initialData.content, 'text/html');
      const imageElements = doc.querySelectorAll('img');
      const usedImageIds = new Set<string>();

      imageElements.forEach(img => {
        // data-image-id 속성에서 추출
        const dataImageId = img.getAttribute('data-image-id');
        if (dataImageId) {
          usedImageIds.add(String(dataImageId));
        }

        // src에서 /api/v1/files/{id}/download 형식 ID 추출
        const src = img.getAttribute('src');
        if (src) {
          const match = src.match(/\/files\/([^/]+)\//);
          if (match) {
            usedImageIds.add(match[1]);
          }
        }
      });

      console.log('[EditPostForm] Content에서 추출한 이미지 IDs:', Array.from(usedImageIds));
      console.log('[EditPostForm] DB attachedFiles 개수:', initialData.attachedFiles.length);

      // content에 실제로 있는 이미지만 필터링
      const filtered = initialData.attachedFiles
        .filter(file => usedImageIds.has(String(file.id)))
        .map(file => {
          // 모든 이미지를 /download 엔드포인트로 통일 (에디터와 일관성 유지)
          // 이렇게 하면 갤러리 삭제 시 removeImageFromEditor의 URL 매칭이 정상 작동
          return {
            id: String(file.id),
            url: `/api/v1/files/${file.id}/download`,
            name: file.fileName || file.originalName || `file-${file.id}`,
            size: file.fileSize || 0,
            isUploading: false,
          };
        });

      console.log('[EditPostForm] 필터링된 일반 이미지 개수:', filtered.length);
      result.push(...filtered);
    }

    // 2) 새 로직: content에서 모든 유튜브 iframe 찾아서 썸네일 추가
    if (initialData?.content) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(initialData.content, 'text/html');
      const youtubeIframes = doc.querySelectorAll('iframe.youtube-video');

      console.log('[EditPostForm] Content에서 찾은 유튜브 iframe 개수:', youtubeIframes.length);

      youtubeIframes.forEach((iframe) => {
        const src = iframe.getAttribute('src');
        if (src) {
          // 비디오 ID 추출: /embed/{videoId} 패턴 (11자리)
          const match = src.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
          if (match && match[1]) {
            const videoId = match[1];
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            console.log('[EditPostForm] 유튜브 썸네일 추가:', videoId);

            result.push({
              id: `yt_thumb_${videoId}`,
              url: thumbnailUrl,
              name: `YouTube 썸네일 - ${videoId}`,
              size: 0,
              isUploading: false,
            });
          }
        }
      });
    }

    console.log('[EditPostForm] 최종 initialImages 개수:', result.length);
    return result;
  }, [initialData?.attachedFiles, initialData?.content]);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      tags: initialData?.tags || [],
      thumbnail: initialData?.thumbnail || '',
      attachedFileIds: [],
    },
  });

  // 초기 썸네일 ID 설정 (유튜브 URL 포함)
  useEffect(() => {
    if (initialData?.thumbnail) {
      // 유튜브 URL 체크
      const isYouTube =
        initialData.thumbnail.includes('youtube.com') ||
        initialData.thumbnail.includes('ytimg.com') ||
        initialData.thumbnail.includes('youtu.be');

      if (isYouTube) {
        // 유튜브 썸네일 URL에서 비디오 ID 추출: /vi/{videoId}/ 패턴
        const videoIdMatch = initialData.thumbnail.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (videoIdMatch && videoIdMatch[1]) {
          setSelectedThumbnailId(`yt_thumb_${videoIdMatch[1]}`);
          console.log('[EditPostForm] 초기 유튜브 썸네일 ID 설정:', `yt_thumb_${videoIdMatch[1]}`);
        }
      } else {
        // 일반 이미지: /api/v1/files/{id}/download 형식에서 ID 추출
        const match = initialData.thumbnail.match(/\/files\/([^/]+)\//);
        if (match) {
          setSelectedThumbnailId(match[1]);
          console.log('[EditPostForm] 초기 일반 이미지 썸네일 ID 설정:', match[1]);
        }
      }
    }
  }, [initialData?.thumbnail]);

  // 이미지 목록이 변경될 때마다 form의 attachedFileIds를 업데이트 (new-story/page.tsx와 동일)
  useEffect(() => {
    const fileIds = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .map(img => img.id);
    form.setValue('attachedFileIds', fileIds);

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

  // Upload validation handler (new-story/page.tsx와 동일)
  const handleUploadValidationChange = (isValid: boolean, reason?: string) => {
    setIsUploadValid(isValid);
    setUploadValidationReason(reason);
  };

  const handleSubmit = (data: PostFormValues) => {
    // 현재 images state에서 직접 attachedFileIds 계산 (React Form state 타이밍 이슈 회피)
    const currentFileIds = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .map(img => img.id);

    // 썸네일 처리 (new-story/page.tsx와 동일)
    const formData: any = {
      ...data,
      attachedFileIds: currentFileIds, // 명시적으로 최신 값 포함
    };

    console.log('[EditPostForm] Submitting with attachedFileIds:', currentFileIds);

    // 썸네일 처리: selectedThumbnailId가 있으면 설정, 없으면 명시적으로 null
    if (selectedThumbnailId) {
      if (selectedThumbnailId.startsWith('yt_thumb_')) {
        const selectedImage = images.find(img => img.id === selectedThumbnailId);
        if (selectedImage) {
          formData.thumbnail = selectedImage.url;
        }
      } else {
        formData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
      }
    } else {
      // 썸네일이 없으면 명시적으로 null 전달 (기존 썸네일 제거)
      formData.thumbnail = null;
    }

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
                            <div className="absolute -left-24 top-0 flex items-start gap-2" style={{ height: textareaHeight + 'px' }}>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>제목</span>
                              </div>
                              <div className="w-px bg-gray-300 dark:bg-gray-600" style={{ height: '100%' }} />
                            </div>
                          )}

                          {/* 제목 입력 영역 */}
                          <Textarea
                            ref={(el) => {
                              hookFormRef(el);
                              (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                            }}
                            placeholder=" 일단 쓰시죠..."
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
                          {/* 왼쪽 라벨 (absolute로 배치, 세로줄 없음) */}
                          {showLabel && (
                            <div className="absolute -left-24 top-0">
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>태그</span>
                              </div>
                            </div>
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
                              disabled={isLoading}
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
                          {/* 왼쪽 라벨 (absolute로 배치, 세로줄 없음) */}
                          {showLabel && (
                            <div className="absolute -left-24 top-0">
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Plus className="h-3 w-3" />
                                <span>내용</span>
                              </div>
                            </div>
                          )}

                          <div className="min-h-[400px]">
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
                              initialImages={initialImages}
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
              onClick={onCancel}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!isUploadValid || isLoading || !form.formState.isValid}
              className="flex items-center gap-2 min-w-[120px]"
              title={!isUploadValid ? uploadValidationReason : undefined}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  저장중...
                </>
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