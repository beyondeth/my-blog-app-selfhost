import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { apiClient } from '@/lib/api';

// 디버그 모드 설정
const DEBUG_MODE = process.env.NODE_ENV === 'development';
const debugLog = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    console.log(message, data || '');
  }
};

export type PostFormValues = {
  title: string;
  content: string;
  category?: string;
};

interface UsePostEditOptions {
  slugOrId: string;
}

/**
 * Context7 권장 패턴: 백엔드 중심 권한 체크
 * 프론트엔드에서는 최소한의 UI 상태만 관리하고
 * 실제 권한 체크는 백엔드에서 처리 (403/401 에러)
 */
export function usePostEdit({ slugOrId }: UsePostEditOptions) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Context7 권장: React Query로 데이터 페칭 최적화
  const {
    data: post,
    isLoading: isLoadingPost,
    error: postError,
  } = useQuery({
    queryKey: ['post', slugOrId],
         queryFn: async () => {
       debugLog('🔍 [POST EDIT] Fetching post:', slugOrId);
       // slug인지 ID인지 판단하여 적절한 메서드 사용
       const isNumericId = /^\d+$/.test(slugOrId);
       if (isNumericId) {
         return await apiClient.getPost(slugOrId);
       } else {
         return await apiClient.getPostBySlug(slugOrId);
       }
     },
    enabled: !!slugOrId,
  });

  // Context7 권장: 이미지 처리 로직 분리
  const { processedContent } = useImageProcessor({
    content: post?.content,
    attachedFiles: post?.attachedFiles,
  });

  // Context7 권장: 폼 초기값 메모이제이션
  const initialData = useMemo(() => {
    if (!post) return { title: '', content: '', category: '' };
    
    return {
      title: post.title || '',
      content: processedContent || '',
      category: post.category || '',
    };
  }, [post, processedContent]);

     // Context7 권장: 업데이트 뮤테이션 최적화
   const updatePostMutation = useMutation({
     mutationFn: async (formData: PostFormValues) => {
       if (!post?.id) {
         throw new Error('게시글 정보를 찾을 수 없습니다.');
       }
       debugLog('📝 [POST EDIT] Updating post:', { postId: post.id, formData });
       return await apiClient.updatePost(post.id, formData);
     },
    onSuccess: useCallback((updatedPost: any) => {
      debugLog('✅ [POST EDIT] Post updated successfully:', updatedPost);
      // 상세페이지에서 사용하는 queryKey 모두에 최신 데이터 반영
      if (updatedPost.slug) {
        queryClient.setQueryData(['posts', 'detail', updatedPost.slug], updatedPost);
        queryClient.invalidateQueries({ queryKey: ['posts', 'detail', updatedPost.slug] });
      }
      if (updatedPost.id) {
        queryClient.setQueryData(['posts', 'detail', updatedPost.id], updatedPost);
      }
      // 목록 invalidate (필요시)
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      // 상세 페이지로 이동
      router.push(`/posts/${updatedPost.slug || updatedPost.id}`);
    }, [queryClient, router]),
    onError: useCallback((error: any) => {
      debugLog('❌ [POST EDIT] Update failed:', error);
      
      // Context7 권장: 백엔드 에러 메시지 그대로 사용
      const errorMessage = error.response?.data?.message || '게시글 수정에 실패했습니다.';
      
      // 권한 없음 에러 처리 (백엔드에서 403 반환)
      if (error.response?.status === 403) {
        alert('권한이 없습니다. 본인이 작성한 글만 수정할 수 있습니다.');
        router.push('/');
        return;
      }
      
      // 인증 에러 처리 (백엔드에서 401 반환)
      if (error.response?.status === 401) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      
      alert(errorMessage);
    }, [router]),
  });

  // Context7 권장: 핸들러 함수 메모이제이션
  const handleFormSubmit = useCallback(async (formData: PostFormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await updatePostMutation.mutateAsync(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [updatePostMutation, isSubmitting]);

  const handleCancel = useCallback(() => {
    if (post) {
      router.push(`/posts/${post.slug || post.id}`);
    } else {
      router.push('/');
    }
  }, [post, router]);

  // Context7 권장: 단순한 로딩 상태 체크
  const isLoading = isLoadingPost || isSubmitting;
  
  return {
    // 데이터
    post,
    initialData,
    processedContent,
    
    // 상태
    isLoading,
    isSubmitting,
    postError,
    
    // 핸들러
    handleFormSubmit,
    handleCancel,
    
    // 뮤테이션
    updatePostMutation,
  };
} 