"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreatePost } from '@/hooks/usePosts';
import { useMyBlogs } from '@/hooks/useBlogs';
import type { UploadedImageInfo } from '@/editor';
import Spinner from '@/components/ui/Spinner';

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

// Zod 스키마 정의 (기존과 동일)
const postSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  content: z.string().min(1, '내용을 입력해주세요.'),
  category: z.string().optional(),
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

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
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
  
  // 이미지 목록이 변경될 때마다 form의 fileIds를 업데이트 (기존과 동일)
  useEffect(() => {
    const fileIds = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .map(img => img.id);
    setValue('fileIds', fileIds);

    const allImageIds = images.filter(img => !img.isUploading).map(img => img.id);
    
    if (allImageIds.length > 0) {
      const currentSelectionValid = selectedThumbnailId && allImageIds.includes(selectedThumbnailId);
      
      if (!currentSelectionValid) {
        setSelectedThumbnailId(allImageIds[0]);
      }
    } else if (selectedThumbnailId) {
      setSelectedThumbnailId('');
    }
  }, [images, selectedThumbnailId, setValue]);

  // Upload validation handler (기존과 동일)
  const handleUploadValidationChange = (isValid: boolean, reason?: string) => {
    setIsUploadValid(isValid);
    setUploadValidationReason(reason);
  };
  
  // 폼 제출 핸들러 (기존과 동일)
  const onSubmit = async (data: PostFormData) => {
    if (!isUploadValid) {
      toast.error(`업로드 제한 초과: ${uploadValidationReason}`);
      return;
    }
    
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const postData: any = {
        title: data.title,
        content: data.content,
        tags: data.tags,
        category: data.category,
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
      
      // 성공 시 해당 블로그의 포스트로 이동
      if (blog) {
        router.push(`/blog/${blog.slug}/posts/${result.slug}`);
      } else {
        router.push(`/posts/${result.slug}`);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('포스트 저장에 실패했습니다.');
    } finally {
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">새 포스트 작성</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            제목
          </label>
          <input
            {...register('title')}
            type="text"
            id="title"
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="제목을 입력하세요"
          />
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            카테고리
          </label>
          <input
            {...register('category')}
            type="text"
            id="category"
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="카테고리 (선택사항)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            내용
          </label>
          <Controller
            name="content"
            control={control}
            render={({ field }) => (
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
                placeholder="내용을 입력하세요..."
              />
            )}
          />
          {errors.content && (
            <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isUploadValid || isSubmitting || createPostMutation.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!isUploadValid ? uploadValidationReason : undefined}
          >
            {isSubmitting || createPostMutation.isPending ? '저장중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}