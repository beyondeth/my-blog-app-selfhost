"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePost } from '@/hooks/usePosts';
import { useBlogBySlug } from '@/hooks/useBlogs';
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

// Zod 스키마 정의
const postSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  content: z.string().min(1, '내용을 입력해주세요.'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  fileIds: z.array(z.string()).optional(),
});

type PostFormData = z.infer<typeof postSchema>;

export default function BlogNewPostPage({ params }: { params: { blogSlug: string } }) {
  const router = useRouter();
  const { blogSlug } = params;
  const { data: blog, isLoading: isBlogLoading } = useBlogBySlug(blogSlug);
  const { user, isLoading: isUserLoading } = useAuth();
  const createPostMutation = useCreatePost();
  
  // 상태를 여기서 중앙 관리 (Single Source of Truth)
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
  
  // 이미지 목록이 변경될 때마다 form의 fileIds를 업데이트
  useEffect(() => {
    // YouTube 썸네일(yt_thumb_로 시작)은 실제 파일이 아니므로 제외
    const fileIds = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .map(img => img.id);
    setValue('fileIds', fileIds);

    // 썸네일 자동 선택 및 유효성 체크
    const allImageIds = images.filter(img => !img.isUploading).map(img => img.id);
    
    if (allImageIds.length > 0) {
      // 현재 선택이 유효한지 확인
      const currentSelectionValid = selectedThumbnailId && allImageIds.includes(selectedThumbnailId);
      
      if (!currentSelectionValid) {
        // 유효하지 않으면 첫 번째 이미지 자동 선택
        setSelectedThumbnailId(allImageIds[0]);
      }
    } else if (selectedThumbnailId) {
      // 이미지가 없으면 선택 초기화
      setSelectedThumbnailId('');
    }
  }, [images, selectedThumbnailId, setValue]);

  // Upload validation handler
  const handleUploadValidationChange = (isValid: boolean, reason?: string) => {
    setIsUploadValid(isValid);
    setUploadValidationReason(reason);
  };
  
  // 폼 제출 핸들러
  const onSubmit = async (data: PostFormData) => {
    // Prevent submission if upload limits exceeded
    if (!isUploadValid) {
      toast.error(`업로드 제한 초과: ${uploadValidationReason}`);
      return;
    }
    
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      
      // 백엔드 DTO에 맞게 데이터 변환
      const postData: any = {
        title: data.title,
        content: data.content,
        tags: data.tags,
        category: data.category,
        attachedFileIds: data.fileIds, // fileIds를 attachedFileIds로 변경
      };
      
      // 썸네일 처리 - YouTube든 일반 이미지든 thumbnail 필드로 전송
      if (selectedThumbnailId) {
        if (selectedThumbnailId.startsWith('yt_thumb_')) {
          // YouTube 썸네일인 경우 URL을 찾아서 thumbnail 필드로 전송
          const selectedImage = images.find(img => img.id === selectedThumbnailId);
          if (selectedImage) {
            // YouTube 썸네일 URL을 그대로 저장 (YouTube 도메인 포함)
            postData.thumbnail = selectedImage.url;
          } else {
          }
        } else {
          // 일반 업로드된 이미지인 경우 파일 프록시 URL로 전송
          postData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
        }
      } else {
      }
      
      const result = await createPostMutation.mutateAsync(postData);
      
      router.push(`/blog/${blogSlug}/posts/${result.slug}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('포스트 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading states
  if (isBlogLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">블로그를 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // Check if user owns this blog
  if (!user || String(blog.userId) !== String(user.id)) {
    console.log('Permission check:', { blogUserId: blog.userId, userId: user?.id });
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">이 블로그에 포스트를 작성할 권한이 없습니다.</p>
          <p className="text-sm text-red-600 mt-2">
            블로그 소유자만 포스트를 작성할 수 있습니다.
          </p>
        </div>
      </div>
    );
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
                onImagesChange={setImages}  // Add this to get images from editor
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