"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreatePost, postQueryKeys } from '@/hooks/usePosts';
import { useCreateCommunityPost, communityPostQueryKeys } from '@/hooks/community/useCommunityPosts';
import { validateUUID } from '@/lib/utils/uuid';
import { useMyBlogs } from '@/hooks/useBlogs';
import { useQueryClient } from '@tanstack/react-query';
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
import { Save, Plus, AlertCircle, ImageIcon, Film, FileText, X } from 'lucide-react';
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
import React from 'react';
import PublishTargetSelector, { type PublishTarget } from '@/components/publish/PublishTargetSelector';
import { FloatingTitleField, TagInputField } from '@/components/posts/form-fields';
import { useVideoUploadStore } from '@/stores/videoUploadStore';

import { EditorSkeleton } from '@/components/editor/EditorSkeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import FlairBadge from '@/components/community/FlairBadge';
import { useCommunity } from '@/hooks/community';
import { canCreatePost } from '@/types/community';
import ReactMarkdown from 'react-markdown';
import { useUploadFile } from '@/hooks/useFiles';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { useVideoUpload } from '@/hooks/video/useVideoUpload';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '@/utils/markdownConversion';
import { validateContentSecurity } from '@/utils/contentSecurity';
import { apiClient } from '@/lib/api';
import type { CreatePostRequest } from '@/types';

// Dynamic import for editor - 초기 로딩 속도 개선
const BlogSimpleEditor = dynamic(
  () => import('@/editor').then(mod => ({ default: mod.BlogSimpleEditor })),
  {
    ssr: false,
    loading: () => <EditorSkeleton height="750px" />
  }
);

// Memoized editor to prevent unnecessary re-mounts
const MemoizedBlogSimpleEditor = React.memo(BlogSimpleEditor);

// Zod 스키마 정의
const categoriesSchema = z.array(
  z.string()
    .min(1, '카테고리는 최소 1글자 이상이어야 합니다.')
    .max(15, '카테고리는 최대 15글자까지 입력 가능합니다.')
    .refine((value) => !value.includes('/'), {
      message: '카테고리에 슬래시(/)를 포함할 수 없습니다.',
    })
).max(2, '카테고리는 최대 2개까지만 입력 가능합니다.');

const postSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  categories: categoriesSchema.optional(),
  content: z.string().min(1, '내용을 입력해주세요.'),
  tags: z.array(z.string()).optional(),
  fileIds: z.array(z.string()).optional(),
  thumbnailIndex: z.number().optional(), // 썸네일 인덱스 (0-based, -1 = 미선택)
});

type PostFormData = z.infer<typeof postSchema>;
type EditorMode = 'rich' | 'markdown';
const DRAFT_VERSION = 1;
const DRAFT_STORAGE_PREFIX = 'new-story-draft';
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
    // 이미 이미지 링크(![...])는 건너뜀
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

export default function NewStoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isLoading: isUserLoading } = useAuth();
  const forcedCommunitySlug = searchParams.get('communitySlug') || '';
  const { data: blogs, isLoading: isBlogsLoading } = useMyBlogs();
  const createPostMutation = useCreatePost();
  const videoUploads = useVideoUploadStore((state) => state.uploads);
  const hasPendingVideoUploads = useMemo(() => {
    for (const upload of videoUploads.values()) {
      if (upload.stage === 'uploading' || upload.stage === 'processing') {
        return true;
      }
    }
    return false;
  }, [videoUploads]);

  const videoUploadStatusText = useMemo(() => {
    for (const upload of videoUploads.values()) {
      if (upload.stage === 'uploading') {
        return '비디오를 업로드 중입니다. 완료될 때까지 기다려주세요.';
      }
      if (upload.stage === 'processing') {
        return '비디오를 처리 중입니다. 썸네일 생성까지 잠시만 기다려주세요.';
      }
    }
    return null;
  }, [videoUploads]);

  // 사용자의 블로그 가져오기 (단일 객체 반환)
  const blog = blogs || null;

  // 발행 대상 상태 (내 블로그 또는 커뮤니티)
  const [publishTarget, setPublishTarget] = useState<PublishTarget | null>(null);
  const [selectedFlairId, setSelectedFlairId] = useState<string | null>(null);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);

  // 커뮤니티 포스트 생성 뮤테이션 (대상이 커뮤니티인 경우)
  const communitySlugForMutation =
    publishTarget?.type === 'community'
      ? publishTarget.slug
      : forcedCommunitySlug || '';
  const createCommunityPostMutation = useCreateCommunityPost(communitySlugForMutation);

  const currentCommunitySlug =
    publishTarget?.type === 'community'
      ? publishTarget.slug
      : forcedCommunitySlug || '';

  const {
    data: selectedCommunity,
    isLoading: isCommunityLoading,
    isError: isCommunityError,
  } = useCommunity(currentCommunitySlug, { enabled: !!currentCommunitySlug });
  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      categories: [],
      content: '',
      tags: [],
      fileIds: [],
      thumbnailIndex: -1, // 초기값: 미선택
    },
  });
  const watchedFileIds = form.watch('fileIds');
  const watchedContent = form.watch('content');

  // 중복 제출 방지용 플래그
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef(false);
  
  // 콘텐츠 보안 에러 (허용되지 않은 외부 이미지 도메인 등)
  const [contentSecurityError, setContentSecurityError] = useState<string | null>(null);
  
  // 카테고리 유효성 에러 (블로그 포스트용)
  const [categoryError, setCategoryError] = useState<string | null>(null);
  
  // 제목 유효성 에러
  const [titleError, setTitleError] = useState<string | null>(null);

  // 썸네일 인덱스 상태
  const [thumbnailIndex, setThumbnailIndex] = useState<number>(-1);
  const [editorMode, setEditorMode] = useState<EditorMode>('rich');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingEditorMode, setPendingEditorMode] = useState<EditorMode | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownImageInputRef = useRef<HTMLInputElement | null>(null);
  const markdownVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [markdownImages, setMarkdownImages] = useState<MarkdownImageInfo[]>([]);
  const [isResolvingFileMetadata, setIsResolvingFileMetadata] = useState(false);
  const fileMetadataRef = useRef<Map<string, MarkdownImageMeta>>(new Map());
  const pendingFileMetadataRef = useRef<Set<string>>(new Set());
  const autoConversionSkipRef = useRef(false);
  const [isMarkdownImageUploading, setIsMarkdownImageUploading] = useState(false);
  const [isMarkdownVideoUploading, setIsMarkdownVideoUploading] = useState(false);
  const markdownImageUploadMutation = useUploadFile();
  const currentThumbnailFileId = useMemo(() => {
    if (!watchedFileIds || typeof thumbnailIndex !== 'number' || thumbnailIndex < 0) {
      return null;
    }
    return watchedFileIds[thumbnailIndex] ?? null;
  }, [watchedFileIds, thumbnailIndex]);
  const {
    state: markdownVideoState,
    uploadVideo: uploadMarkdownVideo,
    reset: resetMarkdownVideo,
  } = useVideoUpload({
    onError: (message) => {
      toast.error(message);
    },
  });

  const activeDraftKey = useMemo(() => {
    if (forcedCommunitySlug) {
      return `${DRAFT_STORAGE_PREFIX}:community:${forcedCommunitySlug}`;
    }

    if (blog?.id) {
      return `${DRAFT_STORAGE_PREFIX}:blog:${blog.id}`;
    }

    return null;
  }, [blog?.id, forcedCommunitySlug]);

  useEffect(() => {
    latestDraftRef.current = {
      title: form.getValues('title') ?? '',
      categories: form.getValues('categories') ?? [],
      content: form.getValues('content') ?? '',
      tags: form.getValues('tags') ?? [],
      fileIds: form.getValues('fileIds') ?? [],
      thumbnailIndex: form.getValues('thumbnailIndex') ?? -1,
    };
  }, [form]);

  useEffect(() => {
    if (forcedCommunitySlug) {
      setPublishTarget((prev) => {
        if (prev?.type === 'community' && prev.slug === forcedCommunitySlug) {
          return prev;
        }
        return {
          type: 'community',
          id: forcedCommunitySlug,
          slug: forcedCommunitySlug,
          name: forcedCommunitySlug,
        };
      });
      return;
    }

    if (blog && !publishTarget) {
      setPublishTarget({
        type: 'blog',
        id: blog.id,
        slug: blog.slug,
        name: blog.name || blog.slug,
        iconUrl: blog.iconUrl,
        iconFit: blog.iconImageFit,
      });
    }
  }, [forcedCommunitySlug, blog, publishTarget]);

  useEffect(() => {
    if (forcedCommunitySlug && selectedCommunity) {
      setPublishTarget({
        type: 'community',
        id: selectedCommunity.id,
        slug: selectedCommunity.slug,
        name: selectedCommunity.name,
        iconUrl: selectedCommunity.iconUrl,
      });
    }
  }, [forcedCommunitySlug, selectedCommunity]);

  useEffect(() => {
    if (publishTarget?.type !== 'community') {
      setSelectedFlairId(null);
      setIsNsfw(false);
      setIsSpoiler(false);
    }
  }, [publishTarget]);

  const availableCommunityFlairs = useMemo(() => {
    return publishTarget?.type === 'community'
      ? selectedCommunity?.flairs?.filter(
          (flair) => flair.type === 'post' && flair.isEnabled
        ) ?? []
      : [];
  }, [publishTarget?.type, selectedCommunity?.flairs]);
  const selectedCommunityFlair =
    selectedFlairId
      ? availableCommunityFlairs.find((flair) => flair.id === selectedFlairId) || null
      : null;

  useEffect(() => {
    if (
      selectedFlairId &&
      !availableCommunityFlairs.some((flair) => flair.id === selectedFlairId)
    ) {
      setSelectedFlairId(null);
    }
  }, [availableCommunityFlairs, selectedFlairId]);

  const [isSwitchingEditorMode, setIsSwitchingEditorMode] = useState(false);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const latestDraftRef = useRef<PostFormData>(form.getValues());
  const hasRestoredDraftRef = useRef(false);

  // 썸네일 변경 핸들러 (인덱스 기반)
  const handleThumbnailChange = useCallback((index: number) => {
    console.log('🎯 [DEBUG] Thumbnail index changed:', { index, timestamp: new Date().toISOString() });

    // React Hook Form의 setValue를 사용하여 form state 업데이트
    form.setValue('thumbnailIndex', index, {
      shouldValidate: true,
      shouldDirty: true
    });

    // 상태 업데이트
    setThumbnailIndex(index);

    // 디버깅: 현재 파일 IDs 확인
    if (process.env.NODE_ENV === 'development') {
      const currentFileIds = form.getValues('fileIds');
      console.log('📋 [DEBUG] Current form fileIds:', currentFileIds);
      console.log('📋 [DEBUG] Selected index:', index, '-> fileId:', currentFileIds?.[index]);
    }
  }, [form]);

  // thumbnailIndex 변경 시 디버깅 로그
  useEffect(() => {
    console.log('🔄 [DEBUG] Page thumbnailIndex updated:', {
      thumbnailIndex,
      timestamp: new Date().toISOString()
    });
  }, [thumbnailIndex]);

  // 파일 ID 변경 핸들러
  const handleFileIdsChange = useCallback((fileIds: string[]) => {
    console.log('🎯 [DEBUG] File IDs updated:', fileIds);
    // React Hook Form의 setValue를 사용하여 form state 업데이트
    form.setValue('fileIds', fileIds, {
      shouldValidate: true,
      shouldDirty: true
    });
  }, [form]);

  const appendFileId = useCallback((fileId: string) => {
    const currentFileIds = form.getValues('fileIds') || [];
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

  const setThumbnailByFileId = useCallback((fileId: string) => {
    const currentFileIds = form.getValues('fileIds') || [];
    const index = currentFileIds.indexOf(fileId);
    if (index === -1) {
      toast.warning('썸네일로 지정할 이미지를 찾을 수 없습니다.');
      return;
    }
    handleThumbnailChange(index);
  }, [form, handleThumbnailChange]);

  const syncMarkdownImages = useCallback(
    (fileIdsOverride?: string[]) => {
      const currentIds = Array.isArray(fileIdsOverride)
        ? fileIdsOverride
        : form.getValues('fileIds');

      if (!Array.isArray(currentIds)) {
        return;
      }

      const sanitizedIds = currentIds.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );

      if (sanitizedIds.length === 0) {
        setMarkdownImages([]);
        return;
      }

      setMarkdownImages((prev) => {
        const existingById = new Map(
          prev.filter((image) => image.id).map((image) => [image.id!, image]),
        );
        const next: MarkdownImageInfo[] = [];
        const seen = new Set<string>();

        for (const fileId of sanitizedIds) {
          if (seen.has(fileId)) {
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

  const insertMarkdownSnippet = useCallback((snippet: string) => {
    const textarea = markdownTextareaRef.current;
    const fallbackValue = form.getValues('content') || '';
    const sanitizedSnippet = snippet.endsWith('\n') ? snippet : `${snippet}\n`;

    if (!textarea) {
      const needsNewline = fallbackValue && !fallbackValue.endsWith('\n');
      const nextValue = `${fallbackValue}${needsNewline ? '\n' : ''}${sanitizedSnippet}`;
      form.setValue('content', nextValue, { shouldDirty: true, shouldTouch: true });
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
  }, [form]);

  const handleInsertImageFromList = useCallback(
    (image: MarkdownImageInfo) => {
      if (!image?.url) {
        toast.error('이미지 정보를 불러오지 못했습니다.');
        return;
      }
      insertMarkdownSnippet(`![${image.name || 'image'}](${image.url})`);
      toast.success('이미지를 본문에 삽입했습니다.');
    },
    [insertMarkdownSnippet],
  );

  const scheduleDraftSave = useCallback(
    (forceImmediate = false) => {
      if (!activeDraftKey || typeof window === 'undefined') {
        return;
      }

      const saveDraft = () => {
        const payload = {
          version: DRAFT_VERSION,
          updatedAt: Date.now(),
          editorMode,
          markdownImages,
          data: {
            ...latestDraftRef.current,
            thumbnailIndex:
              typeof latestDraftRef.current.thumbnailIndex === 'number'
                ? latestDraftRef.current.thumbnailIndex
                : thumbnailIndex,
          },
        };

        window.localStorage.setItem(activeDraftKey, JSON.stringify(payload));
      };

      if (forceImmediate) {
        saveDraft();
        return;
      }

      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }

      draftSaveTimeoutRef.current = window.setTimeout(() => {
        saveDraft();
        draftSaveTimeoutRef.current = null;
      }, 1000);
    },
    [activeDraftKey, editorMode, markdownImages, thumbnailIndex],
  );

  const clearDraft = useCallback(() => {
    if (!activeDraftKey || typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(activeDraftKey);
  }, [activeDraftKey]);

  useEffect(() => {
    hasRestoredDraftRef.current = false;
  }, [activeDraftKey]);

  useEffect(() => {
    if (!activeDraftKey || hasRestoredDraftRef.current || typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(activeDraftKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== DRAFT_VERSION || !parsed.data) {
        return;
      }

      const restoredFileIds = parsed.data.fileIds ?? [];
      form.reset({
        title: parsed.data.title ?? '',
        categories: Array.isArray(parsed.data.categories)
          ? parsed.data.categories.filter((cat: unknown): cat is string => typeof cat === 'string')
          : [],
        content: parsed.data.content ?? '',
        tags: parsed.data.tags ?? [],
        fileIds: restoredFileIds,
        thumbnailIndex: typeof parsed.data.thumbnailIndex === 'number' ? parsed.data.thumbnailIndex : -1,
      });
      setEditorMode(parsed.editorMode ?? 'rich');
      const restoredImages: MarkdownImageInfo[] = parsed.markdownImages ?? [];
      setMarkdownImages(restoredImages);
      restoredImages.forEach((image) => {
        if (image?.id && image.url) {
          fileMetadataRef.current.set(image.id, { url: image.url, name: image.name });
        }
      });
      syncMarkdownImages(restoredFileIds);
      setThumbnailIndex(
        typeof parsed.data.thumbnailIndex === 'number' ? parsed.data.thumbnailIndex : -1,
      );
      hasRestoredDraftRef.current = true;
      
      // 빈 초안이 아닌 경우에만 토스트 표시
      const hasContent = (parsed.data.title && parsed.data.title.trim().length > 0) ||
                         (parsed.data.content && parsed.data.content.trim().length > 0);
      if (hasContent) {
        toast.info('임시 저장된 초안을 불러왔습니다.');
      }
      
      latestDraftRef.current = {
        title: parsed.data.title ?? '',
        categories: parsed.data.categories ?? [],
        content: parsed.data.content ?? '',
        tags: Array.isArray(parsed.data.tags)
          ? parsed.data.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
          : [],
        fileIds: Array.isArray(parsed.data.fileIds)
          ? parsed.data.fileIds.filter((fileId: unknown): fileId is string => typeof fileId === 'string')
          : [],
        thumbnailIndex:
          typeof parsed.data.thumbnailIndex === 'number' ? parsed.data.thumbnailIndex : -1,
      };
    } catch (error) {
      console.error('Failed to restore draft', error);
    }
  }, [activeDraftKey, form, syncMarkdownImages]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      latestDraftRef.current = {
        title: value?.title ?? '',
        categories: Array.isArray(value?.categories)
          ? value.categories.filter((cat: unknown): cat is string => typeof cat === 'string')
          : [],
        content: value?.content ?? '',
        tags: Array.isArray(value?.tags)
          ? value.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
          : [],
        fileIds: Array.isArray(value?.fileIds)
          ? value.fileIds.filter((fileId: unknown): fileId is string => typeof fileId === 'string')
          : [],
        thumbnailIndex:
          typeof value?.thumbnailIndex === 'number' ? value.thumbnailIndex : -1,
      };
      scheduleDraftSave();
    });

    return () => {
      subscription.unsubscribe?.();
    };
  }, [form, scheduleDraftSave]);

  useEffect(() => {
    scheduleDraftSave();
  }, [editorMode, markdownImages, scheduleDraftSave, thumbnailIndex]);

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
    if (!Array.isArray(watchedFileIds)) {
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
              console.warn('[NewStoryPage] Failed to fetch file metadata', error);
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
    return () => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, []);


    const executeEditorModeChange = useCallback((mode: EditorMode) => {
      setIsSwitchingEditorMode(true);
      try {
        const currentContent = form.getValues('content') || '';
        if (mode === 'markdown') {
          const markdown = convertHtmlToMarkdown(currentContent);
          form.setValue('content', markdown, { shouldDirty: true, shouldTouch: true });
          latestDraftRef.current = {
            ...latestDraftRef.current,
            content: markdown,
          };
          markdownTextareaRef.current = null;
          resetMarkdownVideo();
        } else {
          const html = convertMarkdownToHtml(currentContent);
          form.setValue('content', html || '<p></p>', { shouldDirty: true, shouldTouch: true });
          latestDraftRef.current = {
            ...latestDraftRef.current,
            content: html,
          };
        }

        setEditorMode(mode);
        scheduleDraftSave(true);
      } catch (error) {
        console.error('Failed to switch editor mode', error);
        toast.error('편집 모드를 전환하지 못했습니다.');
      } finally {
        setIsSwitchingEditorMode(false);
        setIsConfirmDialogOpen(false);
        setPendingEditorMode(null);
      }
    }, [form, resetMarkdownVideo, scheduleDraftSave]);

    const handleEditorModeChange = useCallback(
      (mode: EditorMode) => {
        if (mode === editorMode || isSwitchingEditorMode) {
          return;
        }

        const currentContent = form.getValues('content') || '';
        if (typeof window !== 'undefined' && currentContent.trim().length > 0) {
          setPendingEditorMode(mode);
          setIsConfirmDialogOpen(true);
          return;
        }

        executeEditorModeChange(mode);
      },
      [editorMode, form, isSwitchingEditorMode, executeEditorModeChange],
    );

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

      fileMetadataRef.current.set(fileId, { url: imageUrl, name: file.name || 'image' });
      const { index: insertedIndex, fileIds: nextFileIds } = appendFileId(fileId);
      syncMarkdownImages(nextFileIds);
      insertMarkdownSnippet(`![${file.name || 'image'}](${imageUrl})`);

      if (thumbnailIndex === -1 && insertedIndex >= 0) {
        handleThumbnailChange(insertedIndex);
      }

      toast.success('이미지를 본문에 삽입했습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
      toast.error(message);
    } finally {
      setIsMarkdownImageUploading(false);
    }
  }, [appendFileId, handleThumbnailChange, insertMarkdownSnippet, markdownImageUploadMutation, syncMarkdownImages, thumbnailIndex]);

  const handleMarkdownImageInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    void handleMarkdownImageFile(file);
  }, [handleMarkdownImageFile]);

  const handleMarkdownVideoInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setIsMarkdownVideoUploading(true);
    try {
      const result = await uploadMarkdownVideo(file);
      if (result && result.success && result.url) {
        insertMarkdownSnippet(`<video controls src="${result.url}" data-video-id="${result.videoId}"></video>`);
        toast.success('비디오를 본문에 추가했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '비디오 업로드에 실패했습니다.';
      toast.error(message);
    } finally {
      setIsMarkdownVideoUploading(false);
    }
  }, [insertMarkdownSnippet, uploadMarkdownVideo]);

  const markdownVideoStatusMessage = useMemo(() => {
    if (markdownVideoState.stage === 'uploading') {
      return `비디오 업로드 중 (${Math.round(markdownVideoState.uploadProgress)}%)`;
    }
    if (markdownVideoState.stage === 'processing') {
      return '서버에서 비디오를 처리하고 있습니다...';
    }
    if (markdownVideoState.stage === 'complete') {
      return '비디오 업로드가 완료되었습니다.';
    }
    if (markdownVideoState.stage === 'error') {
      return markdownVideoState.error ?? '비디오 업로드 오류가 발생했습니다.';
    }
    return null;
  }, [markdownVideoState]);

  // 폼 제출 핸들러
  const onSubmit = async (data: PostFormData) => {
    // 발행 대상이 없으면 제출 불가
    if (!publishTarget) {
      toast.error('발행 대상을 선택해주세요.');
      return;
    }
    
    // 제목 유효성 검사
    if (!data.title || data.title.trim().length === 0) {
      setTitleError('제목을 입력해주세요.');
      return;
    }
    // 이전 제목 에러 초기화
    setTitleError(null);
    
    const isMarkdownMode = editorMode === 'markdown';

    const securityError = validateContentSecurity(data.content, isMarkdownMode ? 'markdown' : 'html');
    if (securityError) {
      setContentSecurityError(securityError);
      return;
    }
    // 이전 보안 에러 초기화
    setContentSecurityError(null);

    // 뮤테이션 진행 중 체크 (블로그 또는 커뮤니티)
    const isPending = publishTarget.type === 'blog'
      ? createPostMutation.isPending
      : createCommunityPostMutation.isPending;

    // useRef를 통한 동기적 중복 제출 차단
    if (isSubmittingRef.current || isPending) {
      return;
    }

    // 제출 시작 - Ref를 먼저 설정 (동기적, 즉시 적용)
    isSubmittingRef.current = true;
    setIsSubmitting(true); // UI 업데이트용

    try {
      // 인덱스를 파일 ID로 변환
      let thumbnailImageId = null;
      const currentThumbnailIndex = thumbnailIndex; // 로컬 상태 사용 (항상 최신 값)

      if (currentThumbnailIndex >= 0 && data.fileIds && data.fileIds.length > currentThumbnailIndex) {
        thumbnailImageId = data.fileIds[currentThumbnailIndex];
      }

      // 블로그에 포스트 발행
      if (publishTarget.type === 'blog') {
        const categories = data.categories ?? [];
        if (categories.length === 0) {
          setCategoryError('카테고리를 최소 1개 입력해주세요.');
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }
        // 이전 카테고리 에러 초기화
        setCategoryError(null);
        const categoryString = categories.join('/');

        const postData: CreatePostRequest = {
          title: data.title,
          category: categoryString,
          tags: data.tags,
          attachedFileIds: data.fileIds,
          ...(thumbnailImageId && { thumbnailImageId }),
        };

        if (isMarkdownMode) {
          postData.content_markdown = data.content;
        } else {
          postData.content = data.content;
        }

        // 디버깅: 썸네일 정보 로깅
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 [DEBUG] Creating blog post:', {
            target: publishTarget,
            title: data.title,
            thumbnailImageId,
          });
        }

        const result = await createPostMutation.mutateAsync(postData);

        // 즉시 관련 캐시 refetch (최신 데이터 보장)
        queryClient.refetchQueries({
          queryKey: postQueryKeys.lists()
        });

        // 성공 시 해당 블로그의 포스트로 이동
        clearDraft();
        router.push(`/${blog!.slug}/${result.slug}`);
      }
      // 커뮤니티에 포스트 발행
      else {
        const communityPostData: any = {
          title: data.title,
          tags: data.tags,
          ...(thumbnailImageId && { thumbnailImageId }),
          isPublished: true,
          ...(selectedFlairId && { flairId: selectedFlairId }),
          isNsfw,
          isSpoiler,
        };
        if (isMarkdownMode) {
          // Markdown 모드: content와 contentMarkdown 둘 다 설정
          // content는 필수 필드이므로 마크다운 원본을 그대로 저장
          communityPostData.content = data.content;
          communityPostData.contentMarkdown = data.content;
        } else {
          communityPostData.content = data.content;
        }

        // 디버깅: 커뮤니티 포스트 정보 로깅
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 [DEBUG] Creating community post:', {
            target: publishTarget,
            title: data.title,
            thumbnailImageId,
          });
        }

        const result = await createCommunityPostMutation.mutateAsync(communityPostData);

        // 즉시 관련 캐시 refetch (최신 데이터 보장)
        queryClient.refetchQueries({
          queryKey: communityPostQueryKeys.lists()
        });

        // 성공 시 커뮤니티 포스트 상세 페이지로 이동 (Reddit 스타일 URL)
        clearDraft();
        router.push(`/c/${publishTarget.slug}/comments/${result.slug}`);
      }
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
  if (isBlogsLoading || isUserLoading || (forcedCommunitySlug && isCommunityLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (forcedCommunitySlug && isCommunityError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-semibold mb-2">커뮤니티를 불러올 수 없습니다</h1>
          <p className="text-gray-500 mb-4">
            존재하지 않거나 접근할 수 없는 커뮤니티입니다.
          </p>
          <Button onClick={() => router.push('/')}>홈으로 이동</Button>
        </div>
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

  // 뮤테이션 진행 중 여부
  const isMutationPending = publishTarget?.type === 'blog'
    ? createPostMutation.isPending
    : createCommunityPostMutation.isPending;
  const isSaving = isSubmitting || isMutationPending;
  const isSaveDisabled = isSaving || hasPendingVideoUploads;
  const isCommunityTarget = publishTarget?.type === 'community';
  const lacksCommunityPermission =
    isCommunityTarget &&
    selectedCommunity &&
    !canCreatePost(selectedCommunity.userMembership);

  if (lacksCommunityPermission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            게시물 작성 권한이 없습니다
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            이 커뮤니티에 가입한 멤버만 게시물을 작성할 수 있습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              뒤로 가기
            </Button>
            <Button onClick={() => router.push(`/c/${selectedCommunity.slug}`)}>
              커뮤니티로 이동
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-6">
      {/* 발행 대상 선택 */}
      {blog && publishTarget && (
        <div className="mb-3 pt-8">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-100">발행 위치:</span>
            <PublishTargetSelector
              value={publishTarget}
              onChange={setPublishTarget}
              userBlog={{
                id: blog.id,
                slug: blog.slug,
                name: blog.name || blog.slug,
                iconUrl: blog.iconUrl || undefined,
                iconImageFit: blog.iconImageFit,
              }}
              disabled={isMutationPending || !!forcedCommunitySlug}
            />
          </div>
        </div>
      )}

      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className={`space-y-4 ${blog && publishTarget ? '' : 'pt-12'} px-4`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                작성 중인 내용은 자동으로 임시 저장됩니다.
              </p>
              {/* 제목 */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FloatingTitleField
                        field={field}
                        disabled={isMutationPending}
                        label="제목"
                        placeholder="당신의 이야기를 들려주세요..."
                      />
                    </FormControl>
                    {/* 제목 에러 인라인 표시 (FormMessage 대체) */}
                    {(form.formState.errors.title || titleError) && (
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50 mt-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300 flex-1">
                          {form.formState.errors.title?.message || titleError}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            form.clearErrors('title');
                            setTitleError(null);
                          }}
                          className="p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          aria-label="닫기"
                        >
                          <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              {/* 카테고리 */}
              {publishTarget?.type === 'blog' && (
                <>
                  <FormField
                    control={form.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <BlogCategoryField field={field} disabled={isMutationPending} />
                        </FormControl>
                        {/* 카테고리 에러 인라인 표시 (FormMessage 대체) */}
                        {(form.formState.errors.categories || categoryError) && (
                          <div className="flex items-start gap-3 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50 mt-2">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300 flex-1">
                              {form.formState.errors.categories?.message || categoryError}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                form.clearErrors('categories');
                                setCategoryError(null);
                              }}
                              className="p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                              aria-label="닫기"
                            >
                              <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </>
              )}

              {isCommunityTarget && selectedCommunity && (
                <div className="space-y-4">
                  {availableCommunityFlairs.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">플레어 (선택)</Label>
                      <Select
                        value={selectedFlairId || '__none__'}
                        onValueChange={(value) => setSelectedFlairId(value === '__none__' ? null : value)}
                        disabled={isMutationPending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="플레어 선택">
                            {selectedCommunityFlair && (
                              <FlairBadge flair={selectedCommunityFlair} size="sm" />
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">플레어 없음</SelectItem>
                          {availableCommunityFlairs.map((flair) => (
                            <SelectItem key={flair.id} value={flair.id}>
                              <FlairBadge flair={flair} size="sm" />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-4 bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">NSFW</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          성인용 또는 민감한 콘텐츠입니다
                        </p>
                      </div>
                      <Switch
                        checked={isNsfw}
                        onCheckedChange={setIsNsfw}
                        disabled={isMutationPending}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">스포일러</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          스포일러가 포함된 콘텐츠입니다
                        </p>
                      </div>
                      <Switch
                        checked={isSpoiler}
                        onCheckedChange={setIsSpoiler}
                        disabled={isMutationPending}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 태그 */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TagInputField field={field} disabled={isMutationPending} label="태그" />
                    </FormControl>
                    {/* 태그 에러 인라인 표시 (FormMessage 대체) */}
                    {form.formState.errors.tags && (
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50 mt-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300 flex-1">
                          {form.formState.errors.tags?.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => form.clearErrors('tags')}
                          className="p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          aria-label="닫기"
                        >
                          <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 내용 */}
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="px-4 pb-0">
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
                          <span>본문 작성</span>
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
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={handleMarkdownImageInputChange}
                            />
                            <input
                              ref={markdownVideoInputRef}
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/mpeg,video/3gpp,video/x-ms-wmv,video/ogg,video/x-flv,.mp4,.webm,.mov,.avi,.mkv,.mpeg,.mpg,.3gp,.wmv,.ogv,.flv"
                              className="hidden"
                              onChange={handleMarkdownVideoInputChange}
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => markdownVideoInputRef.current?.click()}
                                disabled={isMarkdownVideoUploading}
                              >
                                <Film className="h-4 w-4 mr-1.5" />
                                영상 업로드
                              </Button>
                              {isMarkdownImageUploading && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 업로드 중...
                                </span>
                              )}
                              {markdownVideoStatusMessage && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {markdownVideoStatusMessage}
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                업로드 시 아래 목록에서 썸네일을 고를 수 있어요.
                              </span>
                            </div>
                            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:items-start">
                              <div className="space-y-3">
                                <Textarea
                                  ref={markdownTextareaRef}
                                  value={field.value}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  placeholder="Markdown 문법으로 본문을 작성하세요..."
                                  className="min-h-[260px] lg:min-h-[360px] resize-y"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  기본 Markdown 문법을 지원하며, 저장 시 서버에서 안전하게 HTML로 변환됩니다.
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 링크를 붙여넣으면 자동으로 <code>![이미지]</code> 형식으로 바뀝니다.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 lg:p-6 bg-white dark:bg-gray-900 mt-4 lg:mt-0 max-h-[520px] lg:max-h-[720px] overflow-hidden flex flex-col">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between flex-shrink-0">
                                  <span>실시간 미리보기</span>
                                  <span className="text-[11px] text-gray-400 dark:text-gray-500">이미지, 표, 코드까지 즉시 반영돼요.</span>
                                </p>
                                <div className="prose prose-gray dark:prose-invert max-w-none text-sm leading-6 break-words overflow-y-auto flex-1">
                                  <ReactMarkdown skipHtml>{previewContent}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  업로드한 이미지
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  썸네일은 업로드한 이미지에서만 선택됩니다.
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
                                    const isActive = currentThumbnailFileId === image.id;
                                    return (
                                      <div
                                        key={image.id}
                                        className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 p-2"
                                      >
                                        <div className="h-16 w-16 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={normalizeImageUrl(image.url)}
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
                                  업로드한 이미지가 없습니다. 위의 버튼으로 이미지를 추가하면 여기에서 미리보고 썸네일을 지정할 수 있어요.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div
                              className="absolute inset-0 rounded-lg pointer-events-none"
                              style={{
                                backdropFilter: 'blur(2px)',
                                WebkitBackdropFilter: 'blur(2px)',
                                background: 'rgba(0, 0, 0, 0.02)',
                                zIndex: -1
                              }}
                            />
                            <div
                              className="h-[500px] lg:h-[750px] bg-gray-50 dark:bg-gray-900 rounded-[18px] border border-gray-300 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden focused-writing-mode relative z-10"
                              style={{
                                boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
                                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: 'translateZ(0)'
                              }}
                              data-ui-effect="elevated-surface"
                              data-elevation="floating-editor"
                              data-focus-mode="writing"
                            >
                              <MemoizedBlogSimpleEditor
                                key="blog-editor-stable"
                                content={field.value}
                                onChange={field.onChange}
                                placeholder=" 내용을 입력하세요..."
                                initialThumbnailIndex={thumbnailIndex}
                                onThumbnailIndexChange={handleThumbnailChange}
                                onFileIdsChange={handleFileIdsChange}
                              />
                            </div>
                          </div>
                        )}
                      </FormControl>
                      {/* 본문 에러 인라인 표시 (FormMessage 대체) */}
                      {form.formState.errors.content && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50 mt-2">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700 dark:text-red-300 flex-1">
                            {form.formState.errors.content?.message}
                          </p>
                          <button
                            type="button"
                            onClick={() => form.clearErrors('content')}
                            className="p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            aria-label="닫기"
                          >
                            <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      )}
                    </FormItem>
                  );
                }}
              />
            </CardContent>
          </Card>

          {/* 콘텐츠 보안 에러 (허용되지 않은 외부 이미지 등) */}
          {contentSecurityError && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  외부 이미지 사용 불가
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {contentSecurityError}
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-2">
                  이미지를 직접 업로드하거나, 허용된 도메인의 이미지만 사용해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContentSecurityError(null)}
                className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                aria-label="닫기"
              >
                <X className="h-4 w-4 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* 제출 버튼 */}
          {hasPendingVideoUploads && (
            <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 pt-2">
              <AlertCircle className="h-4 w-4" />
              <span>{videoUploadStatusText ?? '비디오 업로드와 처리가 완료될 때까지 기다려주세요.'}</span>
            </p>
          )}

          <div className="flex justify-end gap-3 px-4 -mt-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isMutationPending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isMutationPending || !form.getValues('title')?.trim()}
              onClick={async () => {
                // 임시저장 (isPublished: false로 저장)
                const data = form.getValues();
                if (!data.title?.trim()) {
                  setTitleError('제목을 입력해주세요.');
                  return;
                }
                setTitleError(null);
                
                try {
                  isSubmittingRef.current = true;
                  setIsSubmitting(true);
                  
                  // 썸네일 ID 계산
                  let thumbnailImageId = null;
                  if (thumbnailIndex >= 0 && data.fileIds && data.fileIds.length > thumbnailIndex) {
                    thumbnailImageId = data.fileIds[thumbnailIndex];
                  }
                  
                  const isMarkdownMode = editorMode === 'markdown';
                  
                  if (publishTarget?.type === 'blog') {
                    const categories = data.categories ?? [];
                    const categoryString = categories.join('/');
                    
                    const postData: CreatePostRequest = {
                      title: data.title,
                      category: categoryString || '기타',
                      tags: data.tags,
                      attachedFileIds: data.fileIds,
                      ...(thumbnailImageId && { thumbnailImageId }),
                      isPublished: false, // 초안으로 저장
                    };
                    
                    if (isMarkdownMode) {
                      postData.content = data.content;
                      postData.content_markdown = data.content;
                    } else {
                      postData.content = data.content;
                    }
                    
                    await createPostMutation.mutateAsync(postData);
                  } else if (publishTarget?.type === 'community') {
                    const communityPostData: any = {
                      title: data.title,
                      tags: data.tags,
                      ...(thumbnailImageId && { thumbnailImageId }),
                      isPublished: false, // 초안으로 저장
                      ...(selectedFlairId && { flairId: selectedFlairId }),
                    };
                    
                    if (isMarkdownMode) {
                      communityPostData.content = data.content || '';
                      communityPostData.contentMarkdown = data.content;
                    } else {
                      communityPostData.content = data.content || '';
                    }
                    
                    await createCommunityPostMutation.mutateAsync(communityPostData);
                  }
                  
                  clearDraft();
                  toast.success('초안이 저장되었습니다.');
                  router.push('/drafts');
                } catch (error) {
                  console.error('Failed to save draft:', error);
                  toast.error('초안 저장에 실패했습니다.');
                } finally {
                  isSubmittingRef.current = false;
                  setIsSubmitting(false);
                }
              }}
              className="flex items-center justify-center gap-1.5"
            >
              <FileText className="h-4 w-4" />
              임시저장
            </Button>
            <Button
              type="submit"
              disabled={isSaveDisabled}
              onClick={(e) => {
                // 3차 방어: 버튼 클릭 시 Form 제출 차단
                if (isSaveDisabled) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (hasPendingVideoUploads) {
                    toast.warning('비디오 업로드/처리가 끝난 후에 저장할 수 있습니다.');
                  }
                }
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-w-[88px] text-[13px] font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100 shadow-lg"
              aria-label={isSaving ? "저장 중" : "저장"}
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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

interface BlogCategoryFieldProps {
  field: ControllerRenderProps<PostFormData, 'categories'>;
  disabled?: boolean;
}

function BlogCategoryField({ field, disabled = false }: BlogCategoryFieldProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const [isComposing, setIsComposing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const categories: string[] = Array.isArray(field.value) ? field.value : [];
  const showLabel = isFocused || categories.length > 0 || Boolean(inputValue);
  const isMaxReached = categories.length >= 2;

  const commitCategory = (value: string) => {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return;
    if (trimmed.length > 15) {
      toast.error('카테고리는 최대 15글자까지 입력 가능합니다.');
      return;
    }
    if (categories.length < 2 && !categories.includes(trimmed) && !trimmed.includes('/')) {
      field.onChange([...categories, trimmed]);
    }
    setInputValue('');
  };

  const handleInputChange = (value: string) => {
    if (value.endsWith(',')) {
      commitCategory(value.slice(0, -1));
    } else {
      setInputValue(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      commitCategory(inputValue);
    } else if (event.key === 'Backspace' && !inputValue && categories.length > 0) {
      field.onChange(categories.slice(0, -1));
    }
  };

  const removeCategory = (indexToRemove: number) => {
    field.onChange(categories.filter((_, index) => index !== indexToRemove));
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitCategory(inputValue);
    field.onBlur();
  };

  return (
    <div className="relative">
      {showLabel && (
        <>
          <div className="mb-2 lg:hidden">
            <span className="text-xs text-gray-700 dark:text-gray-100">카테고리</span>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">(필수)</div>
          </div>
          <div className="hidden lg:block absolute -left-24 top-3">
            <div className="flex flex-col text-gray-700 dark:text-gray-100">
              <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Plus className="h-3 w-3" />
                <span>카테고리</span>
              </div>
              <div className="ml-5 text-[11px] text-gray-500 dark:text-gray-400">(필수)</div>
            </div>
          </div>
        </>
      )}
      <div
        className="border-0 border-b border-gray-300 dark:border-gray-600 pb-2 cursor-text"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) {
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex flex-wrap gap-2 mb-2">
          {categories.map((category, index) => (
            <span
              key={category}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
            >
              <span>{category}</span>
              {index === 0 && <span className="text-xs text-gray-500 dark:text-gray-400">(메인)</span>}
              {index === 1 && <span className="text-xs text-gray-500 dark:text-gray-400">(서브)</span>}
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={(event) => {
                  event.stopPropagation();
                  removeCategory(index);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled || isMaxReached}
          placeholder={isMaxReached ? '최대 2개까지 입력 가능합니다' : '입력 후 엔터 또는 콤마로 구분'}
          className="!border-0 focus-visible:ring-0 !px-0 text-lg h-auto py-1 w-auto min-w-[280px] !bg-transparent !rounded-none placeholder:text-gray-500 dark:placeholder:text-gray-300 text-gray-900 dark:text-gray-50"
          style={{ width: inputValue ? `${Math.max(280, inputValue.length * 14)}px` : '280px' }}
        />
        {!inputValue && categories.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-1">
            최대 2개 입력 가능 (메인, 서브)
          </p>
        )}
        {isMaxReached && (
          <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 pl-1">
            카테고리는 최대 2개까지만 입력 가능합니다
          </p>
        )}
      </div>
    </div>
  );
}
