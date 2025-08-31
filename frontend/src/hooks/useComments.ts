'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Comment, CommentForm } from '@/types';
import { useAuth } from '@/hooks/useAuth';

// 댓글 조회 훅
export function useComments(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => apiClient.getComments(postId),
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 10,   // 10분
    enabled: options?.enabled !== false && !!postId && postId !== 'undefined',
  });
}

// 댓글 작성 훅 - Optimistic Update
export function useCreateComment(postId: string, onReplyAdded?: (parentId: string) => void) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (data: CommentForm) => apiClient.createComment(data),
    onMutate: async (newComment) => {
      // 진행 중인 리페치 취소
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });

      // 이전 데이터 백업
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);

      // 임시 ID로 optimistic comment 생성
      const tempComment: Comment = {
        id: `temp-${Date.now()}`,
        content: newComment.content,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        postId: newComment.postId,
        parentCommentId: newComment.parentCommentId || undefined,
        author: user || {
          id: 'temp-user-id',
          username: '나',
          email: '',
          profileImage: '',
          bio: '',
          role: 'user' as const,
          authProvider: 'local' as const,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        post: {} as any, // 임시
        replies: [],
        likesCount: 0,
        dislikesCount: 0
      };

      // Optimistic update
      if (previousComments) {
        const updatedComments = addCommentToTree(previousComments, tempComment);
        queryClient.setQueryData(['comments', postId], updatedComments);
        
        // 답글인 경우 콜백으로 부모 ID 전달
        if (newComment.parentCommentId && onReplyAdded) {
          // 부모 댓글 찾기
          const findParentId = (comments: Comment[], parentId: string): string | null => {
            for (const comment of comments) {
              if (comment.id === parentId) {
                return comment.parentCommentId || comment.id; // 최상위 부모 반환
              }
              if (comment.replies) {
                const found = findParentId(comment.replies, parentId);
                if (found) return found;
              }
            }
            return null;
          };
          
          const rootParentId = findParentId(previousComments, newComment.parentCommentId);
          if (rootParentId) {
            onReplyAdded(rootParentId);
          }
        }
      }

      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // 에러 시 이전 상태로 롤백
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
    },
    onSuccess: (data, variables, context) => {
      // 성공 시 실제 데이터로 교체
      queryClient.invalidateQueries({ 
        queryKey: ['comments', postId],
        refetchType: 'none' // 리페치하지 않고 캐시만 무효화
      });
      
      // 실제 댓글 데이터로 업데이트
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);
      if (previousComments) {
        const updatedComments = replaceCommentInTree(previousComments, data);
        queryClient.setQueryData(['comments', postId], updatedComments);
      }
    },
  });
}

// 댓글 수정 훅 - Optimistic Update
export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => 
      apiClient.updateComment(id, content),
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);
      
      if (previousComments) {
        const updatedComments = updateCommentInTree(previousComments, id, content);
        queryClient.setQueryData(['comments', postId], updatedComments);
      }
      
      return { previousComments };
    },
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['comments', postId],
        refetchType: 'none'
      });
    },
  });
}

// 댓글 삭제 훅 - Optimistic Update
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteComment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);
      
      if (previousComments) {
        const updatedComments = deleteCommentInTree(previousComments, id);
        queryClient.setQueryData(['comments', postId], updatedComments);
      }
      
      return { previousComments };
    },
    onError: (err, id, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['comments', postId],
        refetchType: 'none'
      });
    },
  });
}

// Helper functions for tree operations
function addCommentToTree(comments: Comment[], newComment: Comment): Comment[] {
  if (!newComment.parentCommentId) {
    // 루트 댓글
    return [newComment, ...comments];
  }
  
  // 답글
  return comments.map(comment => {
    if (comment.id === newComment.parentCommentId) {
      return {
        ...comment,
        replies: [newComment, ...(comment.replies || [])]
      };
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: addCommentToTree(comment.replies, newComment)
      };
    }
    
    return comment;
  });
}

function replaceCommentInTree(comments: Comment[], realComment: Comment): Comment[] {
  return comments.map(comment => {
    if (comment.id.startsWith('temp-') && comment.content === realComment.content) {
      return realComment;
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: replaceCommentInTree(comment.replies, realComment)
      };
    }
    
    return comment;
  });
}

function updateCommentInTree(comments: Comment[], id: string, content: string): Comment[] {
  return comments.map(comment => {
    if (comment.id === id) {
      return { ...comment, content, updatedAt: new Date().toISOString() };
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, id, content)
      };
    }
    
    return comment;
  });
}

function deleteCommentInTree(comments: Comment[], id: string): Comment[] {
  return comments.map(comment => {
    if (comment.id === id) {
      return { ...comment, isDeleted: true };
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: deleteCommentInTree(comment.replies, id)
      };
    }
    
    return comment;
  });
}

// 댓글 좋아요/싫어요 debounce 관리자
const commentLikeDebouncer = (() => {
  const pendingActions = new Map<string, { action: 'like' | 'dislike', timeout: NodeJS.Timeout }>();
  
  return {
    scheduleAction: (commentId: string, action: 'like' | 'dislike', callback: () => void) => {
      // 기존 타이머가 있다면 취소
      const existing = pendingActions.get(commentId);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      
      // 새로운 타이머 설정 (10초)
      const timeout = setTimeout(() => {
        callback();
        pendingActions.delete(commentId);
      }, 10000);
      
      pendingActions.set(commentId, { action, timeout });
    },
    
    cancelAction: (commentId: string) => {
      const existing = pendingActions.get(commentId);
      if (existing) {
        clearTimeout(existing.timeout);
        pendingActions.delete(commentId);
      }
    },
    
    flushAll: () => {
      pendingActions.forEach((pending, commentId) => {
        clearTimeout(pending.timeout);
      });
      pendingActions.clear();
    }
  };
})();

// 댓글 좋아요 토글 훅 - Debounced with Optimistic Update
export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      // 즉시 UI 업데이트, 서버 전송은 10초 후
      return Promise.resolve({ success: true });
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);
      
      if (previousComments) {
        const updatedComments = updateCommentLikeInTree(previousComments, commentId, 'like');
        queryClient.setQueryData(['comments', postId], updatedComments);
        
        // 10초 후 서버에 전송
        commentLikeDebouncer.scheduleAction(commentId, 'like', async () => {
          try {
            await apiClient.toggleCommentLike(commentId);
            // 서버 응답 후 데이터 동기화
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          } catch (error) {
            console.error('Failed to sync comment like to server:', error);
            // 실패 시 롤백
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          }
        });
      }
      
      return { previousComments };
    },
    onError: (err, commentId, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
      // 에러 시 대기 중인 액션 취소
      commentLikeDebouncer.cancelAction(commentId);
    },
  });
}

// 댓글 싫어요 토글 훅 - Debounced with Optimistic Update
export function useToggleCommentDislike(postId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      // 즉시 UI 업데이트, 서버 전송은 10초 후
      return Promise.resolve({ success: true });
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]);
      
      if (previousComments) {
        const updatedComments = updateCommentLikeInTree(previousComments, commentId, 'dislike');
        queryClient.setQueryData(['comments', postId], updatedComments);
        
        // 10초 후 서버에 전송
        commentLikeDebouncer.scheduleAction(commentId, 'dislike', async () => {
          try {
            await apiClient.toggleCommentDislike(commentId);
            // 서버 응답 후 데이터 동기화
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          } catch (error) {
            console.error('Failed to sync comment dislike to server:', error);
            // 실패 시 롤백
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          }
        });
      }
      
      return { previousComments };
    },
    onError: (err, commentId, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
      // 에러 시 대기 중인 액션 취소
      commentLikeDebouncer.cancelAction(commentId);
    },
  });
}

// Helper functions for like/dislike operations
function updateCommentLikeInTree(comments: Comment[], commentId: string, action: 'like' | 'dislike'): Comment[] {
  return comments.map(comment => {
    if (comment.id === commentId) {
      // 현재 사용자의 상태를 확인하고 올바른 toggle 로직 적용
      if (action === 'like') {
        // 좋아요 클릭: 싫어요가 있으면 제거하고 좋아요 추가/제거
        const wasDisliked = comment.userDisliked || false;
        const wasLiked = comment.userLiked || false;
        return { 
          ...comment, 
          likesCount: (comment.likesCount || 0) + (wasLiked ? -1 : 1),
          dislikesCount: wasDisliked ? Math.max(0, (comment.dislikesCount || 0) - 1) : (comment.dislikesCount || 0),
          userLiked: !wasLiked,
          userDisliked: false
        };
      } else {
        // 싫어요 클릭: 좋아요가 있으면 제거하고 싫어요 추가/제거
        const wasLiked = comment.userLiked || false;
        const wasDisliked = comment.userDisliked || false;
        return { 
          ...comment, 
          dislikesCount: (comment.dislikesCount || 0) + (wasDisliked ? -1 : 1),
          likesCount: wasLiked ? Math.max(0, (comment.likesCount || 0) - 1) : (comment.likesCount || 0),
          userDisliked: !wasDisliked,
          userLiked: false
        };
      }
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: updateCommentLikeInTree(comment.replies, commentId, action)
      };
    }
    
    return comment;
  });
}

function updateCommentCountsInTree(comments: Comment[], commentId: string, likesCount: number, dislikesCount: number): Comment[] {
  return comments.map(comment => {
    if (comment.id === commentId) {
      return { ...comment, likesCount, dislikesCount };
    }
    
    if (comment.replies) {
      return {
        ...comment,
        replies: updateCommentCountsInTree(comment.replies, commentId, likesCount, dislikesCount)
      };
    }
    
    return comment;
  });
}