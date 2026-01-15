"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { usePost } from '@/hooks/usePosts';
import { useUpdatePost } from '@/hooks/useUpdatePost';
import { useQueryClient } from '@tanstack/react-query';
import EditPostForm from '@/components/posts/EditPostForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { toast } from 'sonner';
import { validateUUID } from '@/lib/utils/uuid';

/**
 * 통합 수정 페이지
 *
 * - 모든 수정 요청의 단일 진입점
 * - post.blog 데이터 활용 (별도 fetch 불필요)
 * - 프론트엔드 권한 체크 (isAuthor || isBlogOwner || isAdmin)
 * - EditPostForm 컴포넌트 재사용
 */
export default function EditPostPage() {
  const { postId } = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  // Next.js 16: useParams()의 반환값이 undefined일 수 있음
  const postIdOrSlug = Array.isArray(postId) ? postId[0] : (postId || '');
  
  // 초안 편집은 인증이 필수이므로, 사용자 정보가 로드된 후에만 요청을 보냅니다.
  const { data: post, isLoading, error } = usePost(postIdOrSlug, { 
    enabled: !!user && !!postIdOrSlug 
  });
  const updatePost = useUpdatePost();

  // 프론트엔드 권한 체크
  useEffect(() => {
    if (!isLoading && post && user) {
      const isAuthor = post.author?.id === user.id;
      const isBlogOwner = post.blog?.owner?.id === user.id || post.blog?.userId === user.id;

      if (!isAuthor && !isBlogOwner && !isAdmin) {
        toast.error('이 글을 수정할 권한이 없습니다.');
        // 새 URL 구조로 리다이렉트
        if (post.blog?.slug) {
          router.push(`/${post.blog.slug}/${post.slug || post.id}`);
        } else {
          router.push('/');
        }
      }
    }
  }, [isLoading, post, user, isAdmin, router, postIdOrSlug]);

  if (isLoading) return <LoadingSpinner message="게시글을 불러오는 중..." />;
  if (error || !post) return <ErrorMessage message={`게시글을 불러올 수 없습니다. (${error?.message || 'Unknown error'})`} showBackButton={true} />;

  // Blog 정보 추출 (post.blog에서)
  const blogInfo = post.blog ? {
    name: post.blog.name,
    slug: post.blog.slug
  } : undefined;

  return (
    <EditPostForm
      initialData={{
        ...post,
        // 데이터 정합성 보정: status가 'draft'이면 isPublished를 false로 간주
        isPublished: post.status === 'draft' ? false : post.isPublished
      }}
      isLoading={updatePost.isPending}
      onSubmit={(formData, isPublished) => {
        // thumbnailImageId 유효성 검사 및 처리
        const validFormData = {
          ...formData,
          // thumbnailImageId가 있고 빈 문자열이 아니고 유효한 UUID인 경우에만 포함
          ...(formData.thumbnailImageId && formData.thumbnailImageId.trim() !== '' && {
            thumbnailImageId: validateUUID(formData.thumbnailImageId)
          }),
          // 발행 상태 업데이트 (명시적으로 전달된 경우 사용, 아니면 기존 상태 유지)
          isPublished: isPublished ?? post.isPublished ?? true,
        };

        // 디버그 로그
        console.log('🎯 [EDIT_PAGE] Submitting form with data:', {
          formData,
          validFormData,
          originalPostThumbnailId: post.thumbnailImageId
        });

        updatePost.mutate({ id: post.id, data: validFormData });
        // 수정 성공 후 추가적인 refetch를 위해 약간의 지연 후 실행
        setTimeout(() => {
          // 도착한 페이지에서 즉시 fresh 데이터를 가져오도록 캐시 무효화
          if (post?.slug) {
            queryClient.invalidateQueries({ queryKey: ['posts', 'detail', post.slug] });
            queryClient.invalidateQueries({ queryKey: ['posts', 'detail', post.id] });
          }
        }, 100);
      }}
      onCancel={() => window.history.back()}
      blogInfo={blogInfo}
    />
  );
} 