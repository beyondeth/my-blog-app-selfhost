"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Plus, ImageIcon, FileText, Github } from 'lucide-react';
import type { FileUpload } from '@/types';
import { FloatingTitleField, TagInputField, EditCategoryField } from '@/components/posts/form-fields';
import { toast } from 'sonner';
import "@/styles/elevated-editor.css"; // elevated surface 스타일
import { BlogSimpleEditor } from '@/editor'; // 정적 import로 변경하여 flushSync 문제 해결
import { validateUUID } from '@/lib/utils/uuid';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { useUploadFile } from '@/hooks/useFiles';
import {
  convertMarkdownToHtml,
  convertHtmlToMarkdown,
  getRichEditorCompatibilityIssues,
} from '@/utils/markdownConversion';
import HtmlContentRenderer from '@/components/ui/content-renderer/HtmlContentRenderer';
import { apiClient } from '@/lib/api';
import { validateContentSecurity } from '@/utils/contentSecurity';
import ReactMarkdown from 'react-markdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { MarkdownImageInfo } from '@/types/image-metadata.types';
import { MarkdownImageCard } from '@/components/posts/MarkdownImageCard';
import { HybridMarkdownEditor, HybridMarkdownEditorRef } from '@/components/posts/HybridMarkdownEditor';
import { MarkdownYouTubeCard } from '@/components/posts/MarkdownYouTubeCard';
import {
  appendYouTubeThumbnailMarker,
  extractYouTubeIdsFromMarkdown,
  extractYouTubeThumbnailMarker,
  stripYouTubeThumbnailMarker,
} from '@/utils/youtubeMarkdown';
import GithubResourcePopover from '@/components/posts/GithubResourcePopover';
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
  githubUrl: z.string().optional(),
  githubDescription: z.string().optional(),
  thumbnail: z.string().optional(),
  thumbnailImageId: z.string().optional(),
  attachedFileIds: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  version: z.number().optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;
type EditorMode = 'rich' | 'markdown';
const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg)$/i;
// MarkdownImageInfo 타입은 @/types/image-metadata.types에서 import
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

function normalizeComparableImageUrl(url: string): string {
  const normalized = normalizeImageUrl(url || '').trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return normalized.split('?')[0].split('#')[0];
  }
}

function extractImageUrlsFromMarkdown(markdown: string): Set<string> {
  const urls = new Set<string>();
  if (!markdown) {
    return urls;
  }

  const markdownImageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownImageRegex.exec(markdown)) !== null) {
    const rawCandidate = (markdownMatch[1] || '').trim().split(/\s+/)[0];
    const normalized = normalizeComparableImageUrl(rawCandidate);
    if (normalized) {
      urls.add(normalized);
    }
  }

  const htmlImageRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlImageRegex.exec(markdown)) !== null) {
    const normalized = normalizeComparableImageUrl(htmlMatch[1] || '');
    if (normalized) {
      urls.add(normalized);
    }
  }

  return urls;
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
    githubUrl?: string | null;
    githubDescription?: string | null;
    thumbnail?: string;
    thumbnailImageId?: string;
    attachedFiles?: FileUpload[];
    version?: number;
    isPublished?: boolean;
    visibility?: 'public' | 'private';
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
    isPublic?: boolean;
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

  const rawMarkdownContent = initialData?.content_markdown ?? '';
  const initialYouTubeThumbnailId = extractYouTubeThumbnailMarker(rawMarkdownContent);
  const cleanedMarkdownContent = stripYouTubeThumbnailMarker(rawMarkdownContent);
  const initialEditorMode: EditorMode = rawMarkdownContent ? 'markdown' : 'rich';
  const [editorMode, setEditorMode] = useState<EditorMode>(initialEditorMode);
  const [isSwitchingEditorMode, setIsSwitchingEditorMode] = useState(false);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [postVisibility, setPostVisibility] = useState<'public' | 'private'>(
    initialData?.visibility === 'private' ? 'private' : 'public',
  );
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingEditorMode, setPendingEditorMode] = useState<EditorMode | null>(null);
  const [selectedYouTubeThumbnailId, setSelectedYouTubeThumbnailId] = useState<string | null>(initialYouTubeThumbnailId);
  const [markdownYouTubeIds, setMarkdownYouTubeIds] = useState<string[]>([]);
  const markdownEditorRef = useRef<HybridMarkdownEditorRef | null>(null);
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
  const isBlogPublic = blogInfo?.isPublic !== false;
  const isPublicTransitionLocked =
    blogInfo?.isPublic === false && postVisibility === 'private';

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      categories: [],  // useEffect에서 파싱하여 설정
      content: initialEditorMode === 'markdown' ? cleanedMarkdownContent : (initialData?.content ?? ''),
      tags: initialData?.tags || [],
      githubUrl: initialData?.githubUrl || '',
      githubDescription: initialData?.githubDescription || '',
      thumbnail: initialData?.thumbnail || '',
      thumbnailImageId: initialData?.thumbnailImageId || undefined, // 빈 문자열 대신 undefined 사용
      attachedFileIds: initialData?.attachedFiles?.map((file) => file.id).filter(Boolean) ?? [],
      visibility: initialData?.visibility === 'private' ? 'private' : 'public',
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
    const nextVisibility =
      initialData?.visibility === 'private' ? 'private' : 'public';
    setPostVisibility(nextVisibility);
    form.setValue('visibility', nextVisibility, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [form, initialData?.visibility]);

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

    if (thumbnailImageId) {
      setSelectedYouTubeThumbnailId(null);
    }

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

  const handleYouTubeThumbnailSelect = useCallback((videoId: string) => {
    if (!videoId) return;
    setSelectedYouTubeThumbnailId(videoId);
    handleThumbnailChange(null);
    toast.success('YouTube 영상을 썸네일로 지정했습니다.');
  }, [handleThumbnailChange]);

  const executeEditorModeChange = useCallback((mode: EditorMode) => {
    setIsSwitchingEditorMode(true);
    try {
      const currentContent = form.getValues('content') || '';
      if (mode === 'markdown') {
        const markdown = convertHtmlToMarkdown(currentContent);
        form.setValue('content', markdown, { shouldDirty: true, shouldTouch: true });
        autoConversionSkipRef.current = true;
      } else {
        const issues = getRichEditorCompatibilityIssues(currentContent);
        if (issues.length > 0) {
          toast.error(`리치 편집기로 안전하게 전환할 수 없는 요소가 있습니다: ${issues.join(', ')}`);
          return;
        }
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
    if (editorMode !== 'markdown') {
      setMarkdownYouTubeIds([]);
      return;
    }

    const ids = extractYouTubeIdsFromMarkdown(watchedContent || '');
    setMarkdownYouTubeIds(ids);

    if (selectedYouTubeThumbnailId && !ids.includes(selectedYouTubeThumbnailId)) {
      setSelectedYouTubeThumbnailId(null);
    }
  }, [editorMode, watchedContent, selectedYouTubeThumbnailId]);

  useEffect(() => {
    if (editorMode !== 'markdown') {
      return;
    }

    if (!Array.isArray(watchedFileIds) || watchedFileIds.length === 0) {
      return;
    }

    const referencedUrls = extractImageUrlsFromMarkdown(watchedContent || '');
    const nextFileIds = watchedFileIds.filter((fileId) => {
      const metadata = fileMetadataRef.current.get(fileId);
      if (!metadata?.url) {
        return true;
      }
      const normalized = normalizeComparableImageUrl(metadata.url);
      return normalized ? referencedUrls.has(normalized) : true;
    });

    if (nextFileIds.length === watchedFileIds.length) {
      return;
    }

    handleFileIdsChange(nextFileIds);
    syncMarkdownImages(nextFileIds);

    if (watchedThumbnailImageId && !nextFileIds.includes(watchedThumbnailImageId)) {
      const fallbackThumbnailId = nextFileIds[0] || null;
      handleThumbnailChange(fallbackThumbnailId);
    }
  }, [
    editorMode,
    handleFileIdsChange,
    handleThumbnailChange,
    syncMarkdownImages,
    watchedContent,
    watchedFileIds,
    watchedThumbnailImageId,
  ]);

  useEffect(() => {
    if (!watchedThumbnailImageId) {
      setThumbnailIndex(-1);
      return;
    }
    const ids = form.getValues('attachedFileIds') || [];
    setThumbnailIndex(ids.indexOf(watchedThumbnailImageId));
  }, [form, watchedThumbnailImageId]);

  const buildSubmissionPayload = useCallback((data: PostFormValues) => {
    const isMarkdownMode = editorMode === 'markdown';
    const canonicalMarkdown = appendYouTubeThumbnailMarker(
      isMarkdownMode ? data.content : convertHtmlToMarkdown(data.content),
      selectedYouTubeThumbnailId,
    );
    const convertedHtml = convertMarkdownToHtml(canonicalMarkdown);
    const hasPreferredYouTube = /data-youtube-video[^>]*data-thumbnail=["']true["']/i.test(
      isMarkdownMode ? convertedHtml : data.content,
    );

    const formData: any = {
      ...data,
      content: convertedHtml,
      content_type: 'markdown',
      content_markdown: canonicalMarkdown,
      visibility: postVisibility,
    };

    if (hasPreferredYouTube) {
      formData.thumbnailImageId = '';
    }

    // stale detail cache로 인한 optimistic lock 충돌(409)을 줄이기 위해
    // 편집 화면 payload에서는 version을 전달하지 않는다.
    delete formData.version;

    return formData;
  }, [editorMode, postVisibility, selectedYouTubeThumbnailId]);

  const submitPreparedData = useCallback((data: PostFormValues, targetIsPublished?: boolean) => {
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

    isSubmittingRef.current = true;
    setIsLocalSubmitting(true);

    try {
      const formData = buildSubmissionPayload(data);
      onSubmit(formData, targetIsPublished);
    } catch (error) {
      isSubmittingRef.current = false;
      setIsLocalSubmitting(false);
      throw error;
    }
  }, [buildSubmissionPayload, editorMode, isLoading, isLocalSubmitting, onSubmit]);

  // 저장 버튼 클릭과 엔터 제출이 동일한 변환 파이프라인을 타도록 강제한다.
  const handleFormSubmit = (targetIsPublished: boolean) => {
    return form.handleSubmit((data) => {
      submitPreparedData(data, targetIsPublished);
    })();
  };

  const insertMarkdownSnippet = useCallback((snippet: string) => {
    if (markdownEditorRef.current) {
      markdownEditorRef.current.insertText(snippet);
      autoConversionSkipRef.current = true;
      return;
    }

    const currentContent = form.getValues('content') || '';
    const needsNewline = currentContent && !currentContent.endsWith('\n');
    const nextValue = `${currentContent}${needsNewline ? '\n' : ''}${snippet.endsWith('\n') ? snippet : snippet + '\n'}`;
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
      if (markdownEditorRef.current) {
        markdownEditorRef.current.insertImageBlock({
          url: imageUrl,
          alt: file.name || 'image',
          size: 'default',
          caption: '',
          fileId,
        });
        autoConversionSkipRef.current = true;
      } else {
        insertMarkdownSnippet(`![${file.name || 'image'}](${imageUrl})`);
      }

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

  return (
    <div className="max-w-5xl mx-auto px-3 py-6">
      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => submitPreparedData(data))} className="space-y-6">
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
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium">
                    {isPublicTransitionLocked
                      ? '포스트 비공개(잠금)'
                      : postVisibility === 'public'
                        ? '포스트 공개'
                        : '포스트 비공개'}
                  </Label>
                  <Switch
                    checked={postVisibility === 'public'}
                    onCheckedChange={(checked) => {
                      if (checked && !isBlogPublic) {
                        return;
                      }
                      const nextVisibility = checked ? 'public' : 'private';
                      setPostVisibility(nextVisibility);
                      form.setValue('visibility', nextVisibility, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    }}
                    disabled={
                      isLoading ||
                      isLocalSubmitting ||
                      isPublicTransitionLocked
                    }
                    title={isPublicTransitionLocked ? '전체 비공개 잠금' : undefined}
                    className="focus-visible:ring-gray-400 data-[state=checked]:bg-gray-500 dark:data-[state=checked]:bg-gray-500 [&>span:first-child]:bg-gray-500 dark:[&>span:first-child]:bg-gray-500"
                  />
                </div>
                {isPublicTransitionLocked && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    TIP. 공개로 변경하려면 '블로그 설정'에서 전체 공개로 바꿔주세요.
                  </p>
                )}
              </div>
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
                              <GithubResourcePopover
                                githubUrl={form.watch('githubUrl') ?? ''}
                                githubDescription={form.watch('githubDescription') ?? ''}
                                onGithubUrlChange={(value) => form.setValue('githubUrl', value, { shouldDirty: true, shouldTouch: true })}
                                onGithubDescriptionChange={(value) => form.setValue('githubDescription', value, { shouldDirty: true, shouldTouch: true })}
                              >
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="px-2.5"
                                  title="GitHub 리소스"
                                >
                                  <Github className="h-4 w-4" />
                                </Button>
                              </GithubResourcePopover>
                              {isMarkdownImageUploading && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 업로드 중...
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                업로드한 이미지는 아래 목록과 미리보기에서 즉시 확인할 수 있어요.
                              </span>
                            </div>
                            <div className="space-y-4">
                              <div className="grid gap-4 xl:grid-cols-2">
                                <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                                  <div className="mb-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                                      <FileText className="h-3.5 w-3.5" />
                                      <span>본문 작성</span>
                                    </p>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      Markdown 편집
                                    </span>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                                    <HybridMarkdownEditor
                                      key={`markdown-${initialData?.id ?? 'edit-post'}`}
                                      ref={markdownEditorRef}
                                      content={field.value}
                                      onChange={(value) => field.onChange(value)}
                                      className="min-h-[240px] lg:min-h-[340px]"
                                    />
                                  </div>
                                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                    이미지는 시각적으로 편집할 수 있으며, 텍스트는 Markdown 문법을 따릅니다.
                                  </p>
                                </section>

                                <section className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                  <div className="mb-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                                      <ImageIcon className="h-3.5 w-3.5" />
                                      <span>실시간 미리보기</span>
                                    </p>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      게시글과 동일한 스타일
                                    </span>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-950/40 p-3">
                                    <HtmlContentRenderer
                                      content={!isConfirmDialogOpen ? convertMarkdownToHtml(previewContent) : ''}
                                      options={{ enableImageModal: false }}
                                      className="markdown-content prose-gray dark:prose-invert max-w-none text-sm leading-6 break-words"
                                    />
                                  </div>
                                </section>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  업로드한 이미지
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  썸네일은 이미지 또는 YouTube에서 선택할 수 있습니다.
                                </span>
                              </div>
                              {isResolvingFileMetadata && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 정보를 불러오는 중입니다...
                                </p>
                              )}
                              {markdownImages.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {markdownImages.map((image) => (
                                    <MarkdownImageCard
                                      key={image.id}
                                      image={image}
                                      isActiveThumbnail={!selectedYouTubeThumbnailId && watchedThumbnailImageId === image.id}
                                      onSetThumbnail={setThumbnailByFileId}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  아직 업로드한 이미지가 없습니다. 위의 버튼으로 이미지를 추가하면 여기에서 미리보고 썸네일을 지정할 수 있어요.
                                </p>
                              )}
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  본문 내 YouTube
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  YouTube 링크가 있으면 여기서 썸네일로 선택할 수 있어요.
                                </span>
                              </div>
                              {markdownYouTubeIds.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {markdownYouTubeIds.map((videoId) => (
                                    <MarkdownYouTubeCard
                                      key={videoId}
                                      videoId={videoId}
                                      isActiveThumbnail={selectedYouTubeThumbnailId === videoId}
                                      onSetThumbnail={handleYouTubeThumbnailSelect}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  본문에 YouTube 링크를 추가하면 목록에 표시됩니다.
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
                              githubUrl={form.watch('githubUrl') ?? ''}
                              githubDescription={form.watch('githubDescription') ?? ''}
                              onGithubUrlChange={(value) => form.setValue('githubUrl', value, { shouldDirty: true, shouldTouch: true })}
                              onGithubDescriptionChange={(value) => form.setValue('githubDescription', value, { shouldDirty: true, shouldTouch: true })}
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
