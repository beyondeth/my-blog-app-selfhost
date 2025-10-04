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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, ArrowLeft, FileText, Type, FolderOpen } from 'lucide-react';
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
  category: z.string()
    .max(50, { message: "카테고리는 50자 이하로 입력해주세요." })
    .optional(),
  thumbnail: z.string().optional(),
  attachedFileIds: z.array(z.string()).optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface EditPostFormProps {
  initialData?: {
    title: string;
    content: string;
    category?: string;
    thumbnail?: string;
    attachedFiles?: FileUpload[];
  };
  isLoading?: boolean;
  onSubmit: (data: PostFormValues) => void;
  onCancel: () => void;
  submitButtonText?: string;
  title?: string;
}

export default function EditPostForm({
  initialData,
  isLoading = false,
  onSubmit,
  onCancel,
  submitButtonText = "저장",
  title = "게시글 수정"
}: EditPostFormProps) {
  // 이미지 및 썸네일 상태 관리 (new-story/page.tsx와 동일)
  const [images, setImages] = useState<UploadedImageInfo[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');
  const [isUploadValid, setIsUploadValid] = useState<boolean>(true);
  const [uploadValidationReason, setUploadValidationReason] = useState<string | undefined>();

  // DB의 attachedFiles를 UploadedImageInfo 배열로 변환 (useMemo 사용)
  // 에디터 초기화 시 한 번만 사용되는 초기 이미지 데이터
  const initialImages = useMemo(() => {
    if (initialData?.attachedFiles && initialData.attachedFiles.length > 0) {
      return initialData.attachedFiles.map(file => {
        let imageUrl = file.fileUrl;

        // fileUrl이 상대 경로인 경우 프록시 경로로 변환
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          imageUrl = `/api/v1/files/proxy/${imageUrl}`;
        }

        return {
          id: String(file.id),
          url: imageUrl || `/api/v1/files/${file.id}/download`,
          name: file.fileName || file.originalName || `file-${file.id}`,
          size: file.fileSize || 0,
          isUploading: false,
        };
      });
    }
    return [];
  }, [initialData?.attachedFiles]);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      category: initialData?.category || '',
      thumbnail: initialData?.thumbnail || '',
      attachedFileIds: [],
    },
  });

  // 초기 썸네일 ID 설정
  useEffect(() => {
    if (initialData?.thumbnail) {
      // /api/v1/files/{id}/download 형식에서 ID 추출
      const match = initialData.thumbnail.match(/\/files\/([^/]+)\//);
      if (match) {
        setSelectedThumbnailId(match[1]);
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
    // 썸네일 처리 (new-story/page.tsx와 동일)
    const formData: any = {
      ...data,
    };

    if (selectedThumbnailId) {
      if (selectedThumbnailId.startsWith('yt_thumb_')) {
        const selectedImage = images.find(img => img.id === selectedThumbnailId);
        if (selectedImage) {
          formData.thumbnail = selectedImage.url;
        }
      } else {
        formData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
      }
    }

    onSubmit(formData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            취소
          </Button>
        </div>
        <Separator />
      </div>

      {/* 폼 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 제목 */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="게시글 제목을 입력하세요"
                        {...field}
                        disabled={isLoading}
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription>
                      독자의 관심을 끌 수 있는 매력적인 제목을 작성해보세요.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 카테고리 */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      카테고리
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="카테고리를 입력하세요 (선택사항)"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      게시글을 분류할 카테고리를 입력하세요.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 내용 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                내용
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>내용 *</FormLabel>
                    <FormControl>
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
                          placeholder="게시글 내용을 작성하세요..."
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      마크다운과 리치 텍스트 편집을 지원합니다. 이미지를 드래그하거나 붙여넣기할 수 있습니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
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