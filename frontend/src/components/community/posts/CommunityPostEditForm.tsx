"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { FloatingTitleField, TagInputField } from '@/components/posts/form-fields';
import { toast } from 'sonner';
import "@/styles/elevated-editor.css"; 
// Note: We're reusing BlogSimpleEditor as initially planned, but wrapped in a community-aware form
import { BlogSimpleEditor } from '@/editor'; 
import { normalizeImageUrl } from '@/utils/imageUtils';
import { useUploadFile } from '@/hooks/useFiles';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '@/utils/markdownConversion';
import HtmlContentRenderer from '@/components/ui/content-renderer/HtmlContentRenderer';
import { apiClient } from '@/lib/api';
import { validateContentSecurity } from '@/utils/contentSecurity';
import { Save, ImageIcon, Film, Plus, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import FlairBadge from '@/components/community/FlairBadge';
import PublishTargetSelector, { type PublishTarget } from '@/components/publish/PublishTargetSelector';
import type { CommunityPost } from '@/types/community';
import { useCommunity } from '@/hooks/community';
import { useVideoUpload } from '@/hooks/video/useVideoUpload';
import { serializeImageAttributes, type MarkdownImageInfo } from '@/types/image-metadata.types';
import { MarkdownImageCard } from '@/components/posts/MarkdownImageCard';
import { HybridMarkdownEditor, HybridMarkdownEditorRef } from '@/components/posts/HybridMarkdownEditor';
import { MarkdownYouTubeCard } from '@/components/posts/MarkdownYouTubeCard';
import {
  appendYouTubeThumbnailMarker,
  extractYouTubeIdsFromMarkdown,
  extractYouTubeThumbnailMarker,
  stripYouTubeThumbnailMarker,
} from '@/utils/youtubeMarkdown';

// Define schema for community post editing
const communityPostFormSchema = z.object({
  title: z.string()
    .min(1, { message: "제목을 입력해주세요." })
    .max(200, { message: "제목은 200자 이하로 입력해주세요." }),
  content: z.string()
    .min(1, { message: "내용을 입력해주세요." }),
  flairId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attachedFileIds: z.array(z.string()).optional(),
  thumbnailImageId: z.string().optional(),
});

type CommunityPostFormValues = z.infer<typeof communityPostFormSchema>;
type EditorMode = 'rich' | 'markdown';
const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg)$/i;
const FALLBACK_USER_BLOG = {
  id: 'my-blog',
  slug: 'my-blog',
  name: '내 블로그',
};

// MarkdownImageInfo 타입은 @/types/image-metadata.types에서 import
interface MarkdownImageMeta { url: string; name?: string; }

function isLikelyImageUrl(url: string): boolean {
    if (!url) return false;
    const normalized = url.split(/[?#]/)[0]?.trim();
    return !!normalized && IMAGE_URL_PATTERN.test(normalized);
}

function convertInlineLinksToImages(markdown: string): string {
    if (!markdown) return '';
    return markdown.replace(/\[([^\]]+)]\(([^)]+)\)/g, (match, label, rawUrl, offset, fullText) => {
        if (offset > 0 && fullText[offset - 1] === '!') return match;
        const sanitizedUrl = rawUrl.trim();
        if (!isLikelyImageUrl(sanitizedUrl)) return match;
        return `![${label}](${sanitizedUrl})`;
    });
}

interface CommunityPostEditFormProps {
  initialData: CommunityPost;
  communitySlug: string;
  isLoading?: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function CommunityPostEditForm({
  initialData,
  communitySlug,
  isLoading = false,
  onSubmit,
  onCancel,
}: CommunityPostEditFormProps) {
  const isSubmittingRef = useRef(false);
  // Infer initial mode: if content_markdown represents the source of truth, use markdown mode
  const rawMarkdownContent = initialData.content_markdown ?? '';
  const initialYouTubeThumbnailId = extractYouTubeThumbnailMarker(rawMarkdownContent);
  const cleanedMarkdownContent = stripYouTubeThumbnailMarker(rawMarkdownContent);
  const initialMode = rawMarkdownContent ? 'markdown' : 'rich';
  const [editorMode, setEditorMode] = useState<EditorMode>(initialMode);
  const [isSwitchingEditorMode, setIsSwitchingEditorMode] = useState(false);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingEditorMode, setPendingEditorMode] = useState<EditorMode | null>(null);
  const [selectedYouTubeThumbnailId, setSelectedYouTubeThumbnailId] = useState<string | null>(initialYouTubeThumbnailId);
  const [markdownYouTubeIds, setMarkdownYouTubeIds] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(initialData.isNsfw ?? false);
  const [isSpoiler, setIsSpoiler] = useState(initialData.isSpoiler ?? false);
  
  // Markdown handling state
  const markdownEditorRef = useRef<HybridMarkdownEditorRef | null>(null);
  const markdownImageInputRef = useRef<HTMLInputElement | null>(null);
  const markdownVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [markdownImages, setMarkdownImages] = useState<MarkdownImageInfo[]>([]);
  const [isMarkdownImageUploading, setIsMarkdownImageUploading] = useState(false);
  const [isMarkdownVideoUploading, setIsMarkdownVideoUploading] = useState(false);
  const markdownImageUploadMutation = useUploadFile();
  const {
    state: markdownVideoState,
    uploadVideo: uploadMarkdownVideo,
    reset: resetMarkdownVideo,
  } = useVideoUpload({
    onError: (message) => {
      toast.error(message);
    },
  });
  const fileMetadataRef = useRef<Map<string, MarkdownImageMeta>>(new Map());
  const pendingFileMetadataRef = useRef<Set<string>>(new Set());
  const [isResolvingFileMetadata, setIsResolvingFileMetadata] = useState(false);
  const autoConversionSkipRef = useRef(false);

  // Community data for Flairs
  const { data: community } = useCommunity(communitySlug);
  const availableCommunityFlairs = useMemo(
    () => community?.flairs?.filter((flair) => flair.isEnabled && flair.type === 'post') ?? [],
    [community?.flairs],
  );
  const publishTarget = useMemo<PublishTarget | null>(() => {
    const resolvedCommunity = community ?? initialData.community;
    const id = resolvedCommunity?.id ?? initialData.communityId ?? communitySlug;
    const slug = resolvedCommunity?.slug ?? initialData.communitySlug ?? communitySlug;
    const name = resolvedCommunity?.name ?? initialData.communityName ?? communitySlug;

    if (!id || !slug || !name) {
      return null;
    }

    return {
      type: 'community',
      id,
      slug,
      name,
      iconUrl: resolvedCommunity?.iconUrl ?? initialData.community?.iconUrl ?? undefined,
      iconFit: resolvedCommunity?.iconImageFit ?? initialData.community?.iconImageFit ?? undefined,
    };
  }, [
    community,
    communitySlug,
    initialData.community,
    initialData.communityId,
    initialData.communityName,
    initialData.communitySlug,
  ]);

  const form = useForm<CommunityPostFormValues>({
    resolver: zodResolver(communityPostFormSchema),
    defaultValues: {
      title: initialData.title || '',
      content: initialMode === 'markdown' ? cleanedMarkdownContent : (initialData.content || ''),
      flairId: initialData.flairId || undefined,
      tags: initialData.tags || [],
      attachedFileIds: initialData.thumbnailImageId ? [initialData.thumbnailImageId] : [],
      thumbnailImageId: initialData.thumbnailImageId || undefined,
    },
  });

  const watchedContent = form.watch('content');
  const watchedFileIds = form.watch('attachedFileIds');
  const watchedThumbnailImageId = form.watch('thumbnailImageId');
  const selectedFlairId = form.watch('flairId');
  const selectedCommunityFlair = useMemo(
    () => (selectedFlairId ? availableCommunityFlairs.find((flair) => flair.id === selectedFlairId) || null : null),
    [availableCommunityFlairs, selectedFlairId],
  );

  useEffect(() => {
    if (selectedFlairId && !availableCommunityFlairs.some((flair) => flair.id === selectedFlairId)) {
      form.setValue('flairId', undefined, { shouldDirty: true, shouldTouch: true });
    }
  }, [availableCommunityFlairs, form, selectedFlairId]);

  useEffect(() => {
    const thumbnailId = initialData.thumbnailImageId;
    const thumbnailUrl =
      initialData.thumbnailImageUrl ||
      initialData.thumbnailUrl ||
      initialData.thumbnailImage?.url ||
      '';
    if (!thumbnailId || !thumbnailUrl) {
      return;
    }

    const normalized = normalizeImageUrl(thumbnailUrl);
    if (!normalized) {
      return;
    }
    fileMetadataRef.current.set(thumbnailId, {
      url: normalized,
      name: 'thumbnail',
    });
  }, [
    initialData.thumbnailImage?.url,
    initialData.thumbnailImageId,
    initialData.thumbnailImageUrl,
    initialData.thumbnailUrl,
  ]);


  // --- Helper functions from EditPostForm (simplified/adapted) ---

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

      if (!Array.isArray(currentIds) || currentIds.length === 0) {
        setMarkdownImages([]);
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

  const handleThumbnailChange = useCallback((thumbnailImageId: string | null) => {
    if (thumbnailImageId) {
      setSelectedYouTubeThumbnailId(null);
    }
    form.setValue('thumbnailImageId', thumbnailImageId || '', {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [form]);

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
        resetMarkdownVideo();
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
  }, [form, resetMarkdownVideo]);


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


  const handleSubmit = (data: CommunityPostFormValues) => {
    if (isSubmittingRef.current || isLoading || isLocalSubmitting) return;

    const isVideoBusy =
      isMarkdownVideoUploading ||
      markdownVideoState.stage === 'uploading' ||
      markdownVideoState.stage === 'processing';
    if (isVideoBusy) {
      toast.warning('비디오 업로드/처리가 끝난 후에 저장할 수 있습니다.');
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

    const convertedHtml = isMarkdownMode ? convertMarkdownToHtml(data.content) : data.content;
    const hasPreferredYouTube = !isMarkdownMode && /data-youtube-video[^>]*data-thumbnail=["']true["']/i.test(convertedHtml);
    const contentWithYouTubeMarker = isMarkdownMode
      ? appendYouTubeThumbnailMarker(data.content, selectedYouTubeThumbnailId)
      : data.content;

    const formData = {
      title: data.title,
      content: convertedHtml,
      contentMarkdown: isMarkdownMode ? contentWithYouTubeMarker : undefined,
      flairId: data.flairId,
      tags: data.tags,
      thumbnailImageId: hasPreferredYouTube ? '' : data.thumbnailImageId || undefined,
      isNsfw,
      isSpoiler,
    };
    
    // API Spec check: existing edit might expect `content_markdown` if markdown?
    // Based on `EditPostForm`, it sends `content_type` and `content_markdown`.
    // Let's stick to a generic data object that `useUpdateCommunityPost` can handle or transform.
    // However, `useUpdateCommunityPost` likely expects a Partial<UpdateCommunityPostDto>.
    
    // We'll pass the data to the parent onSubmit which calls the mutation.
    // The parent (page.tsx) needs to ensure the data shape matches what the mutation expects.
    
    try {
        onSubmit(formData);
    } catch (error) {
        isSubmittingRef.current = false;
        setIsLocalSubmitting(false);
        throw error;
    }
  };


  // --- Markdown / Media Handling ---
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

  const handleInsertImageFromList = useCallback(
    (image: MarkdownImageInfo) => {
      if (!image?.url) {
        toast.error('이미지 정보를 불러오지 못했습니다.');
        return;
      }
      
      if (markdownEditorRef.current) {
        markdownEditorRef.current.insertImageBlock({
          url: image.url,
          alt: image.name || 'image',
          size: 'default',
          caption: '',
          fileId: image.id,
        });
        toast.success('이미지를 본문에 삽입했습니다.');
        return;
      }
      
      const attrs = serializeImageAttributes({
        id: image.id,
        size: 'default',
        caption: '',
      });
      
      insertMarkdownSnippet(`![${image.name || 'image'}](${image.url})${attrs}`);
      toast.success('이미지를 본문에 삽입했습니다.');
    },
    [insertMarkdownSnippet],
  );

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

      fileMetadataRef.current.set(fileId, {
        url: imageUrl,
        name: file.name || 'image',
      });

      const { fileIds: nextFileIds } = appendFileId(fileId);
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

      if (!form.getValues('thumbnailImageId')) {
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

  useEffect(() => {
    if (editorMode !== 'markdown') {
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
              console.warn('[CommunityPostEditForm] Failed to fetch file metadata', error);
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


  // Sync loading state
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
      setIsLocalSubmitting(false);
    }
  }, [isLoading]);

  const isVideoBusy =
    isMarkdownVideoUploading ||
    markdownVideoState.stage === 'uploading' ||
    markdownVideoState.stage === 'processing';
  const isSaving = isLoading || isLocalSubmitting;
  const isSaveDisabled = isSaving || isVideoBusy;
  const currentThumbnailFileId = watchedThumbnailImageId || null;
  const hasPublishTarget = Boolean(publishTarget);

  return (
    <>
      {publishTarget && (
        <div className="mb-3 pt-8">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-100">발행 위치:</span>
            <PublishTargetSelector
              value={publishTarget}
              onChange={() => undefined}
              userBlog={FALLBACK_USER_BLOG}
              disabled
            />
          </div>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className={`space-y-4 ${hasPublishTarget ? '' : 'pt-12'} px-4`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                작성 중인 내용은 자동으로 임시 저장됩니다.
              </p>
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
                        placeholder="당신의 이야기를 들려주세요..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                {availableCommunityFlairs.length > 0 && (
                  <FormField
                    control={form.control}
                    name="flairId"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-sm font-medium">말머리 (선택)</Label>
                        <Select
                          value={field.value ?? '__none__'}
                          onValueChange={(value) => field.onChange(value === '__none__' ? undefined : value)}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="말머리 선택">
                                {selectedCommunityFlair && (
                                  <FlairBadge flair={selectedCommunityFlair} size="sm" />
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">말머리 없음</SelectItem>
                            {availableCommunityFlairs.map((flair) => (
                              <SelectItem key={flair.id} value={flair.id}>
                                <FlairBadge flair={flair} size="sm" />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      disabled={isLoading}
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
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

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
                              accept="image/*"
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
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                <HybridMarkdownEditor
                                  ref={markdownEditorRef}
                                  content={field.value}
                                  onChange={(value) => field.onChange(value)}
                                  className="min-h-[260px] lg:min-h-[360px]"
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지는 시각적으로 편집할 수 있으며, 텍스트는 Markdown 문법을 따릅니다.
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  이미지 링크를 붙여넣으면 자동으로 <code>![이미지]</code> 형식으로 바뀝니다.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 lg:p-6 bg-white dark:bg-gray-900">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
                                  <span>실시간 미리보기</span>
                                  <span className="text-[11px] text-gray-400 dark:text-gray-500">이미지, 표, 코드까지 즉시 반영돼요.</span>
                                </p>
                              <HtmlContentRenderer
                                content={convertMarkdownToHtml(previewContent)}
                                options={{ enableImageModal: false }}
                                className="markdown-content prose-gray dark:prose-invert max-w-none text-sm leading-6 break-words"
                              />
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
                                      isActiveThumbnail={!selectedYouTubeThumbnailId && currentThumbnailFileId === image.id}
                                      onInsert={handleInsertImageFromList}
                                      onSetThumbnail={setThumbnailByFileId}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  업로드한 이미지가 없습니다. 위의 버튼으로 이미지를 추가하면 여기에서 미리보고 썸네일을 지정할 수 있어요.
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
                              <BlogSimpleEditor
                                content={field.value}
                                onChange={field.onChange}
                                placeholder=" 내용을 입력하세요..."
                                thumbnailImageId={watchedThumbnailImageId || undefined}
                                onThumbnailChange={handleThumbnailChange}
                                onFileIdsChange={handleFileIdsChange}
                              />
                            </div>
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

          <div className="flex justify-end gap-3 px-4 -mt-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSaveDisabled}
              onClick={(e) => {
                if (isSaveDisabled && isVideoBusy) {
                  e.preventDefault();
                  e.stopPropagation();
                  toast.warning('비디오 업로드/처리가 끝난 후에 저장할 수 있습니다.');
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
    </>
  );
}
