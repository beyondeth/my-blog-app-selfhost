"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePost } from '@/hooks/usePosts';
import { useBlogBySlug } from '@/hooks/useBlogs';
import { UploadedImageInfo, BlogRichTextEditor } from '@/editor';
import Spinner from '@/components/ui/Spinner';

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
    const fileIds = images.filter(img => !img.isUploading).map(img => img.id);
    setValue('fileIds', fileIds);

    // 썸네일이 유효한지 확인
    if (selectedThumbnailId && !fileIds.includes(selectedThumbnailId)) {
      setSelectedThumbnailId(''); // 썸네일이 삭제되었으면 초기화
    }
  }, [images, selectedThumbnailId, setValue]);

  // 폼 제출 핸들러
  const onSubmit = async (data: PostFormData) => {
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
            postData.thumbnail = selectedImage.url;
          }
        } else {
          // 일반 업로드된 이미지인 경우 파일 프록시 URL로 전송
          postData.thumbnail = `/api/v1/files/${selectedThumbnailId}/download`;
        }
      }
      
      const result = await createPostMutation.mutateAsync(postData);
      
      router.push(`/blog/${blogSlug}/posts/${result.slug}`);
    } catch (error) {
      console.error('Failed to create post:', error);
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
            className="w-full px-3 py-2 border rounded-md"
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
            className="w-full px-3 py-2 border rounded-md"
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
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={createPostMutation.isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {createPostMutation.isLoading ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}