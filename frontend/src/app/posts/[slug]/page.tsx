'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import HtmlContentRenderer from '@/components/ui/HtmlContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeaderWithReport from '@/components/posts/PostHeaderWithReport';
import AuthorInfo from '@/components/posts/AuthorInfo';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useAuth } from '@/providers/AuthProviderV2';
import { usePost, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { shareUrl, copyUrlToClipboard } from '@/utils/navigation';
import LikeButton from '@/components/ui/LikeButton';
import CommentSection from '@/components/comments/CommentSection';
import { toast } from 'sonner';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasViewed = useRef(false);

  const slug = params.slug as string;

  // 상세 fetch는 여기서 한 번만
  const { data: post, error, isError } = usePost(slug);
  const deletePostMutation = useDeletePost();
  const likeMutation = useTogglePostLike(slug, () => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요를 누를 수 있습니다.');
    // TODO: toast/모달/로그인 라우팅 등으로 대체 가능
  });

  // 포스트 데이터가 로드되면 블로그 URL로 리다이렉트 (레거시 URL 처리용)
  // 최신 링크는 이미 /blog/[blogSlug]/posts/[postSlug] 형태로 직접 연결됨
  useEffect(() => {
    // blog 정보가 있지만 현재 /posts/[slug] 경로인 경우에만 리다이렉트
    if (post && post.blog?.slug && window.location.pathname.startsWith('/posts/')) {
      // 올바른 블로그 URL로 리다이렉트
      router.replace(`/blog/${post.blog.slug}/posts/${post.slug || post.id}`);
    }
  }, [post, router]);


  const handleEdit = useCallback(() => {
    if (post) {
      router.push(`/posts/edit/${post.slug || post.id}`);
    }
  }, [post, router]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!post) return;
    
    deletePostMutation.mutate(post.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        router.push('/');
      },
      onError: () => {
        // 에러 시에도 다이얼로그는 열어둠 (재시도 가능)
      }
    });
  }, [post, deletePostMutation, router]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending) {
      setDeleteDialogOpen(false);
    }
  }, [deletePostMutation.isPending]);

  const handleLike = useCallback(() => {
    if (!post) return;
    // 서버에 즉시 요청 (optimistic update는 hook에서 처리)
    likeMutation.mutate(post.id);
  }, [post, likeMutation]);

  const handleShare = useCallback(async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: '흥미로운 글을 공유합니다!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('공유 취소됨');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다!');
    }
  }, [post]);

  const handleCopyContent = useCallback(async () => {
    if (!post) return;
    
    try {
      // HTML을 텍스트로 변환하면서 코드 블록 처리
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = post.content;
      
      // 코드 블록들을 보기 좋게 포맷팅
      const codeBlocks = tempDiv.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const codeText = block.textContent || '';
        const language = block.className.match(/language-(\w+)/)?.[1] || 'code';
        block.textContent = `\n[${language}]\n${codeText}\n`;
      });
      
      // pre 태그만 있는 경우도 처리
      const preBlocks = tempDiv.querySelectorAll('pre:not(:has(code))');
      preBlocks.forEach((block) => {
        const text = block.textContent || '';
        block.textContent = `\n[code]\n${text}\n`;
      });
      
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const fullText = `${post.title}\n\n${textContent}`;
      
      await navigator.clipboard.writeText(fullText);
      toast.success('포스트가 클립보드에 복사되었습니다', {
        duration: 3000,
        position: 'bottom-right',
      });
    } catch (error) {
      console.error('복사 실패:', error);
      toast.error('복사에 실패했습니다', {
        duration: 3000,
        position: 'bottom-right',
      });
    }
  }, [post]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    if (!post || hasViewed.current) return;
    // 5초 이상 머물렀을 때만 viewCount 증가
    const timer = setTimeout(() => {
      queryClient.setQueryData(['posts', 'detail', slug], {
        ...post,
        viewCount: post.viewCount + 1,
      });
      hasViewed.current = true;
      // (별도 API 호출 필요시 이곳에서 처리)
    }, 5000);
    return () => clearTimeout(timer);
  }, [post, queryClient, slug]);

  // 비공개 블로그 체크
  if (post && (post as any).isPrivate) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-gray-600 mb-8 text-lg">비공개 블로그입니다</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <div className="min-h-screen">
        <ErrorMessage 
          message={error?.message || 'Post not found'}
          onBack={() => router.push('/')}
        />
      </div>
    );
  }
  
  // 아직 로딩 중이면 아무것도 표시하지 않음
  if (!post) {
    return null;
  }

  const canEdit = isAdmin || post.author?.id === user?.id;

  return (
    <>
      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        <PostHeaderWithReport 
          post={post}
          canEdit={canEdit}
          onBack={handleBack}
          onEdit={handleEdit}
          onDelete={handleDelete}
          LikeButtonComponent={
            <LikeButton
              liked={post.liked || false}
              likeCount={post.likeCount || 0}
              onClick={handleLike}
              tooltip={!user ? '로그인 후 좋아요 가능' : undefined}
            />
          }
          onShare={handleShare}
          onCopy={handleCopyContent}
        />

        {/* Article Body - 14px 크기, 모티브 블로그와 동일한 색상 */}
        <div className="blog-content">
          <HtmlContentRenderer content={post.content} />
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-100 text-gray-900 rounded-full hover:bg-gray-200 cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <AuthorInfo author={post.author} />

        {/* 댓글 섹션 */}
        <CommentSection postId={String(post.id)} />
      </article>
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
        itemName={`"${post?.title}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${post?.title}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </>
  );
} 