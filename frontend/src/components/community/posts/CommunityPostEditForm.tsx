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
import {
  convertMarkdownToHtml,
  convertHtmlToMarkdown,
  getRichEditorCompatibilityIssues,
} from '@/utils/markdownConversion';
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
import { hasPendingImageUpload } from '@/editor/utils/pending-image-upload';

// Define schema for community post editing
const communityPostFormSchema = z.object({
  title: z.string()
    .min(1, { message: "Please enter a title." })
    .max(200, { message: "Title must be 200 characters or fewer." }),
  content: z.string()
    .min(1, { message: "Please enter the content." }),
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
  name: 'My blog',
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
  const [markdownImageProgress, setMarkdownImageProgress] = useState(0);
  const [isRichTextImageUploading, setIsRichTextImageUploading] = useState(false);
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
      attachedFileIds: Array.from(new Set([
        ...(initialData.attachedFiles?.map((file) => file.id).filter(Boolean) ?? []),
        ...(initialData.thumbnailImageId ? [initialData.thumbnailImageId] : []),
      ])),
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
    const currentFileIds = form.getValues('attachedFileIds') || [];
    form.setValue('attachedFileIds', Array.from(new Set([...currentFileIds, ...fileIds])), {
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
      toast.warning('Could not find the image to use as the thumbnail.');
      return;
    }
    handleThumbnailChange(fileId);
  }, [form, handleThumbnailChange]);

  const handleYouTubeThumbnailSelect = useCallback((videoId: string) => {
    if (!videoId) return;
    setSelectedYouTubeThumbnailId(videoId);
    handleThumbnailChange(null);
    toast.success('YouTube video set as the thumbnail.');
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
        const issues = getRichEditorCompatibilityIssues(currentContent);
        if (issues.length > 0) {
          toast.error(`Some elements cannot be converted safely to the rich editor: ${issues.join(', ')}`);
          return;
        }
        const html = convertMarkdownToHtml(currentContent);
        form.setValue('content', html || '<p></p>', { shouldDirty: true, shouldTouch: true });
      }
      setEditorMode(mode);
    } catch (error) {
      console.error('Failed to switch editor mode', error);
      toast.error('Failed to switch editor modes.');
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
      toast.warning('You can save after the video upload and processing are complete.');
      return;
    }
    if (
      isRichTextImageUploading
      || isMarkdownImageUploading
      || hasPendingImageUpload(data.content)
    ) {
      toast.warning('You can save after the image upload is complete.');
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

    const contentWithYouTubeMarker = appendYouTubeThumbnailMarker(
      isMarkdownMode ? data.content : convertHtmlToMarkdown(data.content),
      selectedYouTubeThumbnailId,
    );
    const convertedHtml = convertMarkdownToHtml(contentWithYouTubeMarker);
    const hasPreferredYouTube = /data-youtube-video[^>]*data-thumbnail=["']true["']/i.test(
      isMarkdownMode ? convertedHtml : data.content,
    );

    const formData = {
      title: data.title,
      content: convertedHtml,
      contentMarkdown: contentWithYouTubeMarker,
      flairId: data.flairId,
      tags: data.tags,
      attachedFileIds: data.attachedFileIds,
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

  const handleMarkdownImageFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      toast.error('SVG images cannot be uploaded.');
      return;
    }
    setIsMarkdownImageUploading(true);
    setMarkdownImageProgress(0);
    try {
      const result = await markdownImageUploadMutation.mutateAsync({
        file,
        fileType: 'image' as const,
        onProgress: setMarkdownImageProgress,
      });

      const fileId = result.id;
      const imageUrl = normalizeImageUrl(result.accessUrl || result.fileUrl || '');
      if (!fileId || !imageUrl) {
        throw new Error('The image upload response was invalid.');
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

      toast.success('Image inserted into the post.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload the image.';
      toast.error(message);
    } finally {
      setIsMarkdownImageUploading(false);
      setMarkdownImageProgress(0);
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
        toast.success('Video added to the post.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload the video.';
      toast.error(message);
    } finally {
      setIsMarkdownVideoUploading(false);
    }
  }, [insertMarkdownSnippet, uploadMarkdownVideo]);

  const markdownVideoStatusMessage = useMemo(() => {
    if (markdownVideoState.stage === 'uploading') {
      return `Uploading video (${Math.round(markdownVideoState.uploadProgress)}%)`;
    }
    if (markdownVideoState.stage === 'processing') {
      return 'Processing video on the server...';
    }
    if (markdownVideoState.stage === 'complete') {
      return 'Video upload completed.';
    }
    if (markdownVideoState.stage === 'error') {
      return markdownVideoState.error ?? 'An error occurred while uploading the video.';
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
  const isImageBusy = isRichTextImageUploading || isMarkdownImageUploading;
  const isSaveDisabled = isSaving || isVideoBusy || isImageBusy;
  const currentThumbnailFileId = watchedThumbnailImageId || null;
  const hasPublishTarget = Boolean(publishTarget);

  return (
    <>
      {publishTarget && (
        <div className="mb-3 pt-8">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-100">Publishing to:</span>
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
                Your draft is saved automatically while you write.
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
                        label="Title"
                        placeholder="Share your story..."
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
                        <Label className="text-sm font-medium">Flair (optional)</Label>
                        <Select
                          value={field.value ?? '__none__'}
                          onValueChange={(value) => field.onChange(value === '__none__' ? undefined : value)}
                          disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a flair">
                                {selectedCommunityFlair && (
                                  <FlairBadge flair={selectedCommunityFlair} size="sm" />
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No flair</SelectItem>
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
                        Adult or sensitive content
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
                      <Label className="text-sm font-medium">Spoiler</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Content that includes spoilers
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
                      <TagInputField field={field} disabled={isLoading} label="Tags" />
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
                      : 'Preview content will appear here.';

                  return (
                    <FormItem>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          <span>Write your post</span>
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
                              {mode === 'rich' ? 'Rich text' : 'Markdown'}
                            </button>
                          ))}
                          {isSwitchingEditorMode && (
                            <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
                              Switching...
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
                                Upload image
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => markdownVideoInputRef.current?.click()}
                                disabled={isMarkdownVideoUploading}
                              >
                                <Film className="h-4 w-4 mr-1.5" />
                                Upload video
                              </Button>
                              {isMarkdownImageUploading && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Uploading image ({markdownImageProgress}%)
                                </span>
                              )}
                              {markdownVideoStatusMessage && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {markdownVideoStatusMessage}
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                After upload, you can choose a thumbnail from the list below.
                              </span>
                            </div>
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                <HybridMarkdownEditor
                                  key={`markdown-${initialData?.id ?? 'community-edit'}`}
                                  ref={markdownEditorRef}
                                  content={field.value}
                                  onChange={(value) => field.onChange(value)}
                                  className="min-h-[260px] lg:min-h-[360px]"
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Images can be edited visually, while text follows Markdown syntax.
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Pasting an image URL automatically converts it to <code>![image]</code>.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 lg:p-6 bg-white dark:bg-gray-900">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
                                  <span>Live preview</span>
                                  <span className="text-[11px] text-gray-400 dark:text-gray-500">Images, tables, and code render instantly.</span>
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
                                  Uploaded images
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  You can choose the thumbnail from an image or YouTube video.
                                </span>
                              </div>
                              {isResolvingFileMetadata && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Loading image details...
                                </p>
                              )}
                              {markdownImages.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {markdownImages.map((image) => (
                                    <MarkdownImageCard
                                      key={image.id}
                                      image={image}
                                      isActiveThumbnail={!selectedYouTubeThumbnailId && currentThumbnailFileId === image.id}
                                      onSetThumbnail={setThumbnailByFileId}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  No uploaded images yet. Add one with the button above to preview it here and set a thumbnail.
                                </p>
                              )}
                            </div>
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  YouTube in this post
                                </p>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  If your post includes YouTube links, you can use them as thumbnails here.
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
                                  Add a YouTube link to the post and it will appear here.
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
                                placeholder="Write your content..."
                                thumbnailImageId={watchedThumbnailImageId || undefined}
                                onThumbnailChange={handleThumbnailChange}
                                onFileIdsChange={handleFileIdsChange}
                                onUploadStateChange={({ isUploading }) => {
                                  setIsRichTextImageUploading(isUploading);
                                }}
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaveDisabled}
              onClick={(e) => {
                if (isSaveDisabled && (isVideoBusy || isImageBusy)) {
                  e.preventDefault();
                  e.stopPropagation();
                  toast.warning(
                    isImageBusy
                      ? 'You can save after the image upload is complete.'
                      : 'You can save after the video upload and processing are complete.',
                  );
                }
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-w-[88px] text-[13px] font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100 shadow-lg"
              aria-label={isSaving ? "Saving" : "Save"}
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
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
        title="Change editor mode"
        description="Switching editor modes may convert or remove some formatting. Do you want to continue?"
        confirmText="Continue"
      />
    </>
  );
}
