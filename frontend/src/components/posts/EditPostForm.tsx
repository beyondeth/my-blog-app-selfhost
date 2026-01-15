"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Plus, ImageIcon, FileText } from 'lucide-react';
import type { FileUpload } from '@/types';
import { FloatingTitleField, TagInputField, EditCategoryField } from '@/components/posts/form-fields';
import { toast } from 'sonner';
import "@/styles/elevated-editor.css"; // elevated surface 스타일
import { BlogSimpleEditor } from '@/editor'; // 정적 import로 변경하여 flushSync 문제 해결
import { validateUUID } from '@/lib/utils/uuid';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { useUploadFile } from '@/hooks/useFiles';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '@/utils/markdownConversion';
import { apiClient } from '@/lib/api';
import { validateContentSecurity } from '@/utils/contentSecurity';
import ReactMarkdown from 'react-markdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  thumbnailImageId: z.string().optional(),
  attachedFileIds: z.array(z.string()).optional(),
  version: z.number().optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;
type EditorMode = 'rich' | 'markdown';
const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg)$/i;
type MarkdownImageInfo = { id: string; url: string; name?: string };
interface MarkdownImageMeta {
  url: string;
  name?: string;
}

function isLikelyImageUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  const normalized = url.split(/[?#]/)[0]?.trim();
  if (!normalized) {
    return false;
  }
  return IMAGE_URL_PATTERN.test(normalized);
}

function convertInlineLinksToImages(markdown: string): string {
  if (!markdown) {
    return '';
  }

  return markdown.replace(/\[([^\]]+)]\(([^)]+)\)/g, (match, label, rawUrl, offset, fullText) => {
    if (offset > 0 && fullText[offset - 1] === '!') {
      return match;
    }
    const sanitizedUrl = rawUrl.trim();
    if (!isLikelyImageUrl(sanitizedUrl)) {
      return match;
    }
    return `![${label}](${sanitizedUrl})`;
  });
}

interface EditPostFormProps {
  initialData?: {
    id?: string;
    title: string;
    category: string;
    content: string;
    content_markdown?: string;
    content_type?: 'html' | 'markdown';
    tags?: string[];
    thumbnail?: string;
    thumbnailImageId?: string;
    attachedFiles?: FileUpload[];
    version?: number;
    isPublished?: boolean;
  };
  isLoading?: boolean;
  onSubmit: (data: PostFormValues, isPublished?: boolean) => void;
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
  
  // 현재 발행 상태 확인 (기본값은 true로 설정하여 기존 글 수정 시 문제 없도록 함)
  const isPublished = initialData?.isPublished ?? true;

  // 폼 제출 핸들러 래퍼
  const handleFormSubmit = (targetIsPublished: boolean) => {
    return form.handleSubmit((data) => {
      // 3차 방어: 버튼 클릭 시 Form 제출 차단 (동기적 플래그 체크)
      if (isSubmittingRef.current || isLoading || isLocalSubmitting) {
        return;
      }
      onSubmit(data, targetIsPublished);
    })();
  };

  const initialEditorMode: EditorMode = initialData?.content_markdown ? 'markdown' : 'rich';
  const [editorMode, setEditorMode] = useState<EditorMode>(initialEditorMode);
  const [isSwitchingEditorMode, setIsSwitchingEditorMode] = useState(false);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingEditorMode, setPendingEditorMode] = useState<EditorMode | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownImageInputRef = useRef<HTMLInputElement | null>(null);
  const [markdownImages, setMarkdownImages] = useState<MarkdownImageInfo[]>([]);
  const [isMarkdownImageUploading, setIsMarkdownImageUploading] = useState(false);
  const markdownImageUploadMutation = useUploadFile();
  const fileMetadataRef = useRef<Map<string, MarkdownImageMeta>>(new Map());
  const pendingFileMetadataRef = useRef<Set<string>>(new Set());
  const [isResolvingFileMetadata, setIsResolvingFileMetadata] = useState(false);
  const autoConversionSkipRef = useRef(false);
  const [thumbnailIndex, setThumbnailIndex] = useState<number>(() => {
    const attachedFileIds =
      initialData?.attachedFiles?.map((file) => file.id).filter(Boolean) ?? [];
    const targetId = initialData?.thumbnailImageId || '';
    return targetId ? attachedFileIds.indexOf(targetId) : -1;
  });

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      categories: [],  // useEffect에서 파싱하여 설정
      content: initialData?.content_markdown ?? initialData?.content ?? '',
      tags: initialData?.tags || [],
      thumbnail: initialData?.thumbnail || '',
      thumbnailImageId: initialData?.thumbnailImageId || undefined, // 빈 문자열 대신 undefined 사용
      attachedFileIds: initialData?.attachedFiles?.map((file) => file.id).filter(Boolean) ?? [],
    },
  });
  const watchedFileIds = form.watch('attachedFileIds');
  const watchedThumbnailImageId = form.watch('thumbnailImageId');
  const watchedContent = form.watch('content');

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

  useEffect(() => {
    const attachedFiles = initialData?.attachedFiles ?? [];
    if (!attachedFiles.length) {
      setMarkdownImages([]);
      form.setValue('attachedFileIds', [], { shouldDirty: false, shouldTouch: false });
      setThumbnailIndex(-1);
      return;
    }

    const imageFiles = attachedFiles.filter((file) => file.fileType === 'image');
    const mappedImages = imageFiles.map((file) => {
      const url = normalizeImageUrl(file.accessUrl || file.fileUrl || '');
      if (file.id) {
        fileMetadataRef.current.set(file.id, {
          url,
          name: file.originalName || file.fileName || 'image',
        });
      }
      return {
        id: file.id,
        url,
        name: file.originalName || file.fileName || 'image',
      };
    });

    setMarkdownImages(mappedImages);
    const initialFileIds = attachedFiles.map((file) => file.id).filter(Boolean);
    form.setValue('attachedFileIds', initialFileIds, { shouldTouch: false, shouldDirty: false });
    if (initialData?.thumbnailImageId) {
      const idx = initialFileIds.indexOf(initialData.thumbnailImageId);
      setThumbnailIndex(idx);
    } else {
      setThumbnailIndex(-1);
    }
  }, [form, initialData?.attachedFiles, initialData?.thumbnailImageId]);

  const handleFileIdsChange = useCallback((fileIds: string[]) => {
    form.setValue('attachedFileIds', fileIds, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [form]);

  const syncMarkdownImages = useCallback(
    (fileIdsOverride?: string[]) => {
      const currentIds = Array.isArray(fileIdsOverride)
        ? fileIdsOverride
        : form.getValues('attachedFileIds');

      if (!Array.isArray(currentIds) || !currentIds.length) {
        setMarkdownImages([]);
        return;
      }

      setMarkdownImages((prev) => {
        const existingById = new Map(
          prev.filter((image) => image.id).map((image) => [image.id!, image]),
        );
        const next: MarkdownImageInfo[] = [];
        const seen = new Set<string>();

        for (const fileId of currentIds) {
          if (!fileId || seen.has(fileId)) {
            continue;
          }
          seen.add(fileId);

          const metadata = fileMetadataRef.current.get(fileId);
          const fallback = existingById.get(fileId);
          if (metadata) {
            next.push({
              id: fileId,
              url: metadata.url,
              name: metadata.name ?? fallback?.name,
            });
          } else if (fallback) {
            next.push(fallback);
          }
        }

        return next;
      });
    },
    [form],
  );

  const appendFileId = useCallback((fileId: string) => {
    const currentFileIds = form.getValues('attachedFileIds') || [];
    if (currentFileIds.includes(fileId)) {
      return {
        index: currentFileIds.indexOf(fileId),
        fileIds: currentFileIds,
      };
    }
    const nextIds = [...currentFileIds, fileId];
    handleFileIdsChange(nextIds);
    return {
      index: nextIds.length - 1,
      fileIds: nextIds,
    };
  }, [form, handleFileIdsChange]);

  // 썸네일 변경 핸들러
  const handleThumbnailChange = useCallback((thumbnailImageId: string | null) => {
    console.log('🎯 [EditPostForm] Thumbnail changed:', {
      thumbnailImageId,
      postId: initialData?.id,
      timestamp: new Date().toISOString()
    });

    const currentIds = form.getValues('attachedFileIds') || [];
    const nextIndex = thumbnailImageId ? currentIds.indexOf(thumbnailImageId) : -1;
    setThumbnailIndex(nextIndex);

    form.setValue('thumbnailImageId', thumbnailImageId || '', {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [form, initialData?.id]);

  const setThumbnailByFileId = useCallback((fileId: string) => {
    const currentIds = form.getValues('attachedFileIds') || [];
    const index = currentIds.indexOf(fileId);
    if (index === -1) {
      toast.warning('썸네일로 지정할 이미지를 찾을 수 없습니다.');
      return;
    }
    handleThumbnailChange(fileId);
  }, [form, handleThumbnailChange]);

  const executeEditorModeChange = useCallback((mode: EditorMode) => {
    setIsSwitchingEditorMode(true);
    try {
      const currentContent = form.getValues('content') || '';
      if (mode === 'markdown') {
        const markdown = convertHtmlToMarkdown(currentContent);
        form.setValue('content', markdown, { shouldDirty: true, shouldTouch: true });
        autoConversionSkipRef.current = true;
      } else {
        const html = convertMarkdownToHtml(currentContent);
        form.setValue('content', html || '<p></p>', { shouldDirty: true, shouldTouch: true });
      }

      setEditorMode(mode);
    } catch (error) {
      console.error('Failed to switch editor mode', error);
      toast.error('편집 모드를 전환하지 못했습니다.');
    } finally {
      setIsSwitchingEditorMode(false);
      setIsConfirmDialogOpen(false);
      setPendingEditorMode(null);
    }
  }, [form]);

  const handleEditorModeChange = useCallback((mode: EditorMode) => {
    if (mode === editorMode || isSwitchingEditorMode) return;
    const currentContent = form.getValues('content') || '';
    if (typeof window !== 'undefined' && currentContent.trim().length > 0) {
      setPendingEditorMode(mode);
      setIsConfirmDialogOpen(true);
      return;
    }

    executeEditorModeChange(mode);
  }, [editorMode, form, isSwitchingEditorMode, executeEditorModeChange]);

  // isLoading 상태 변경 시 isSubmittingRef 동기화
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
      setIsLocalSubmitting(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!Array.isArray(watchedFileIds)) {
      setMarkdownImages([]);
      return;
    }

    if (watchedFileIds.length === 0) {
      setMarkdownImages([]);
      return;
    }

    syncMarkdownImages(watchedFileIds);

    const pendingIds = watchedFileIds.filter(
      (fileId): fileId is string =>
        typeof fileId === 'string' &&
        !fileMetadataRef.current.has(fileId) &&
        !pendingFileMetadataRef.current.has(fileId),
    );

    if (pendingIds.length === 0) {
      return;
    }

    pendingIds.forEach((id) => pendingFileMetadataRef.current.add(id));
    setIsResolvingFileMetadata(true);
    let cancelled = false;

    (async () => {
      try {
        const fetched = await Promise.all(
          pendingIds.map(async (fileId) => {
            try {
              const response = await apiClient.getFile(fileId as unknown as number);
              const imageUrl = normalizeImageUrl(response.accessUrl || response.fileUrl || '');
              if (!imageUrl) {
                return null;
              }
              return {
                id: response.id,
                url: imageUrl,
                name: response.originalName || response.fileName || 'image',
              } as MarkdownImageInfo;
            } catch (error) {
              console.warn('[EditPostForm] Failed to fetch file metadata', error);
              return null;
            }
          }),
        );

        if (cancelled) {
          return;
        }

        let updated = false;
        for (const file of fetched) {
          if (file?.id && file.url) {
            fileMetadataRef.current.set(file.id, { url: file.url, name: file.name });
            updated = true;
          }
        }

        if (updated) {
          syncMarkdownImages(watchedFileIds);
        }
      } finally {
        pendingIds.forEach((id) => pendingFileMetadataRef.current.delete(id));
        if (!cancelled) {
          setIsResolvingFileMetadata(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncMarkdownImages, watchedFileIds]);

  useEffect(() => {
    if (editorMode !== 'markdown') {
      autoConversionSkipRef.current = false;
      return;
    }

    if (typeof watchedContent !== 'string' || !watchedContent) {
      return;
    }

    if (autoConversionSkipRef.current) {
      autoConversionSkipRef.current = false;
      return;
    }

    const converted = convertInlineLinksToImages(watchedContent);
    if (converted !== watchedContent) {
      autoConversionSkipRef.current = true;
      form.setValue('content', converted, { shouldDirty: true, shouldTouch: true });
    }
  }, [editorMode, form, watchedContent]);

  useEffect(() => {
    if (!watchedThumbnailImageId) {
      setThumbnailIndex(-1);
      return;
    }
    const ids = form.getValues('attachedFileIds') || [];
    setThumbnailIndex(ids.indexOf(watchedThumbnailImageId));
  }, [form, watchedThumbnailImageId]);

  const handleSubmit = (data: PostFormValues) => {
    // useRef를 통한 동기적 중복 제출 차단
    if (isSubmittingRef.current || isLoading || isLocalSubmitting) {
      return;
    }

    const isMarkdownMode = editorMode === 'markdown';
    const securityError = validateContentSecurity(data.content, isMarkdownMode ? 'markdown' : 'html');
    if (securityError) {
      toast.error(securityError);
      return;
    }

    // 제출 시작
    isSubmittingRef.current = true;
    setIsLocalSubmitting(true);

    // 카테고리 배열 → 문자열 변환 (백엔드는 "메인/서브" 형식 기대)
    const categoryString = data.categories.join('/');

    const formData: any = {
      ...data,
      category: categoryString,
      content_type: isMarkdownMode ? 'markdown' : 'html',
    };

    if (isMarkdownMode) {
      formData.content_markdown = data.content;
      delete formData.content;
    }

    // categories 필드 제거 (백엔드는 category 필드만 사용)
    delete formData.categories;

    if (typeof formData.version !== 'number') {
      formData.version =
        typeof data.version === 'number'
          ? data.version
          : typeof initialData?.version === 'number'
            ? initialData.version
            : undefined;
    }

    try {
      onSubmit(formData);
    } catch (error) {
      isSubmittingRef.current = false;
      setIsLocalSubmitting(false);
      throw error;
    }
  };

  const insertMarkdownSnippet = useCallback((snippet: string) => {
    const textarea = markdownTextareaRef.current;
    const fallbackValue = form.getValues('content') || '';
    const sanitizedSnippet = snippet.endsWith('\n') ? snippet : `${snippet}\n`;

    if (!textarea) {
      const needsNewline = fallbackValue && !fallbackValue.endsWith('\n');
      const nextValue = `${fallbackValue}${needsNewline ? '\n' : ''}${sanitizedSnippet}`;
      form.setValue('content', nextValue, { shouldDirty: true, shouldTouch: true });
      autoConversionSkipRef.current = true;
      return;
    }

    const { selectionStart = textarea.value.length, selectionEnd = textarea.value.length } = textarea;
    const before = textarea.value.slice(0, selectionStart);
    const after = textarea.value.slice(selectionEnd);
    const needsNewlineBefore = before && !before.endsWith('\n');
    const insertion = `${needsNewlineBefore ? '\n' : ''}${sanitizedSnippet}`;
    const nextValue = `${before}${insertion}${after}`;

    textarea.value = nextValue;
    const cursor = before.length + insertion.length;
    textarea.setSelectionRange(cursor, cursor);
    textarea.focus();
    form.setValue('content', nextValue, { shouldDirty: true, shouldTouch: true });
    autoConversionSkipRef.current = true;
  }, [form]);

  const handleMarkdownImageFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      toast.error('SVG 이미지는 업로드할 수 없습니다.');
      return;
    }
    setIsMarkdownImageUploading(true);
    try {
      const result = await markdownImageUploadMutation.mutateAsync({
        file,
        fileType: 'image' as const,
      });

      const fileId = result.id;
      const imageUrl = normalizeImageUrl(result.accessUrl || result.fileUrl || '');

      if (!fileId || !imageUrl) {
        throw new Error('이미지 업로드 결과가 올바르지 않습니다.');
      }

      fileMetadataRef.current.set(fileId, { url: imageUrl, name: file.name });
      const { index: insertedIndex, fileIds: nextFileIds } = appendFileId(fileId);
      syncMarkdownImages(nextFileIds);
      insertMarkdownSnippet(`![${file.name || 'image'}](${imageUrl})`);

      if ((form.getValues('thumbnailImageId') || '').trim().length === 0 && insertedIndex >= 0) {
        handleThumbnailChange(fileId);
      }

      toast.success('이미지를 본문에 삽입했습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
      toast.error(message);
    } finally {
      setIsMarkdownImageUploading(false);
    }
  }, [appendFileId, form, handleThumbnailChange, insertMarkdownSnippet, markdownImageUploadMutation, syncMarkdownImages]);

  const handleMarkdownImageInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    void handleMarkdownImageFile(file);
  }, [handleMarkdownImageFile]);

  const handleInsertImageFromList = useCallback((image: MarkdownImageInfo) => {
    if (!image?.url) {
      toast.error('이미지 정보를 불러오지 못했습니다.');
      return;
    }
    insertMarkdownSnippet(`![${image.name || 'image'}](${image.url})`);
    toast.success('이미지를 본문에 삽입했습니다.');
  }, [insertMarkdownSnippet]);

  return (
    <div className="max-w-5xl mx-auto px-3 py-6">
      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="space-y-4 pt-16 px-4">
              {/* 제목 */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FloatingTitleField
                        field={field}
                        disabled={isLoading}
                        label="제목"
                        placeholder=" 당신의 이야기를 들려주세요..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 카테고리 */}
              <FormField
                control={form.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <EditCategoryField field={field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 태그 */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TagInputField field={field} disabled={isLoading} label="태그" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
                  const isMarkdownMode = editorMode === 'markdown';
                  const previewContent =
                    field.value && field.value.trim().length > 0
                      ? field.value
                      : '미리보기 내용이 여기에 표시됩니다.';

                  return (
                    <FormItem>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          <span>본문</span>
                        </div>
                        <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 text-xs font-medium">
                          {(['rich', 'markdown'] as EditorMode[]).map((mode) => (
                            <button
                              type="button"
                              key={mode}
                              onClick={() => handleEditorModeChange(mode)}
                              className={`px-3 py-1 rounded-md transition ${
                                editorMode === mode
                                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                  : 'text-gray-600 dark:text-gray-300'
                              }`}
                              disabled={editorMode === mode || isSwitchingEditorMode}
                            >
                              {mode === 'rich' ? '리치 텍스트' : 'Markdown'}
                            </button>
                          ))}
                          {isSwitchingEditorMode && (
                            <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
                              전환 중...
                            </span>
                          )}
                        </div>
                      </div>

                      <FormControl>
                        {isMarkdownMode ? (
                          <div className="mt-4 space-y-4">
                            <input
                              ref={markdownImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleMarkdownImageInputChange}
                            />
                            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => markdownImageInputRef.current?.click()}
                                disabled={isMarkdownImageUploading}
                              >
                                <ImageIcon className="h-4 w-4 mr-1.5" />
                                이미지 업로드
                              </Button>
                              {isMarkdownImageUploading && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 업로드 중...
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                업로드한 이미지는 아래 목록과 미리보기에서 즉시 확인할 수 있어요.
                              </span>
                            </div>
                            <div className="space-y-3">
                              <Textarea
                                ref={markdownTextareaRef}
                                value={field.value}
                                onChange={(event) => field.onChange(event.target.value)}
                                placeholder="Markdown 문법으로 본문을 수정하세요..."
                                className="min-h-[260px] lg:min-h-[360px] resize-y"
                              />
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                기본 Markdown 문법을 지원하며, 이미지 링크는 자동으로 <code>![이미지]</code> 형식으로 변환됩니다.
                              </p>
                            </div>
                            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 lg:p-6 bg-white dark:bg-gray-900">
                              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
                                <span>실시간 미리보기</span>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                  게시글과 동일한 스타일로 렌더링됩니다.
                                </span>
                              </p>
                              <div className="prose prose-gray dark:prose-invert max-w-none text-sm leading-6 break-words">
                                <ReactMarkdown skipHtml>{previewContent}</ReactMarkdown>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  업로드한 이미지
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  썸네일은 이 목록에서만 선택할 수 있습니다.
                                </span>
                              </div>
                              {isResolvingFileMetadata && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 정보를 불러오는 중입니다...
                                </p>
                              )}
                              {markdownImages.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {markdownImages.map((image) => {
                                    const isActive = watchedThumbnailImageId === image.id;
                                    return (
                                      <div
                                        key={image.id}
                                        className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 p-2"
                                      >
                                        <div className="h-16 w-16 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={image.url}
                                            alt={image.name || '업로드한 이미지'}
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                            {image.name || '업로드한 이미지'}
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="gap-1.5"
                                              onClick={() => handleInsertImageFromList(image)}
                                            >
                                              <FileText className="h-3.5 w-3.5" />
                                              본문에 삽입
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={isActive ? 'default' : 'secondary'}
                                              onClick={() => setThumbnailByFileId(image.id)}
                                            >
                                              {isActive ? '썸네일 선택됨' : '썸네일로 지정'}
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  아직 업로드한 이미지가 없습니다. 위의 버튼으로 이미지를 추가하면 여기에서 미리보고 썸네일을 지정할 수 있어요.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="transition-shadow duration-300 transform translateZ(0)"
                            data-ui-effect="elevated-surface"
                            data-elevation="floating-editor"
                            data-focus-mode="writing"
                            style={{ height: '750px' }}
                          >
                            <BlogSimpleEditor
                              content={field.value}
                              onChange={field.onChange}
                              placeholder=" 내용을 입력하세요..."
                              thumbnailImageId={watchedThumbnailImageId || undefined}
                              onThumbnailChange={handleThumbnailChange}
                              initialThumbnailIndex={thumbnailIndex}
                              onThumbnailIndexChange={(index) => {
                                const ids = form.getValues('attachedFileIds') || [];
                                const nextId = index >= 0 ? ids[index] : null;
                                if (nextId) {
                                  handleThumbnailChange(nextId);
                                }
                                setThumbnailIndex(index);
                              }}
                              onFileIdsChange={handleFileIdsChange}
                            />
                          </div>
                        )}
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
              disabled={isLoading || isLocalSubmitting}
            >
              취소
            </Button>
            {/* 초안 상태일 경우: 임시저장과 발행 버튼 분리 */}
            {!isPublished ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading || isLocalSubmitting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFormSubmit(false); // 임시저장 (isPublished: false)
                  }}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  임시저장
                </Button>
                <Button
                  type="button"
                  disabled={isLoading || isLocalSubmitting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFormSubmit(true); // 발행하기 (isPublished: true)
                  }}
                  className="flex items-center gap-2 min-w-[100px]"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      발행하기
                    </>
                  )}
                </Button>
              </>
            ) : (
              /* 이미 발행된 글일 경우: 수정 버튼 하나만 표시 */
              <Button
                type="button"
                disabled={isLoading || isLocalSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  handleFormSubmit(true); // 계속 발행 상태 유지
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
            )}
          </div>
        </form>
      </Form>

      
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => {
          setIsConfirmDialogOpen(false);
          setPendingEditorMode(null);
        }}
        onConfirm={() => {
          if (pendingEditorMode) {
            executeEditorModeChange(pendingEditorMode);
          }
        }}
        title="편집 모드 변경"
        description="편집 모드를 변경하면 일부 서식이 변환되거나 유실될 수 있습니다. 계속하시겠습니까?"
        confirmText="계속하기"
      />
    </div>
  );
} 
