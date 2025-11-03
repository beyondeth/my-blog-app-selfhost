'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import HtmlContentRenderer from '@/components/ui/content-renderer/HtmlContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeaderWithReport from '@/components/posts/PostHeaderWithReport';
import AuthorInfo from '@/components/posts/AuthorInfo';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import CommentSectionPaginated from '@/components/comments/CommentSectionPaginated';
import { useAuth } from '@/providers/AuthProviderV2';
import { usePost, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useBlogBySlug } from '@/hooks/useBlogs';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LikeButton from '@/components/ui/LikeButton';
import { useToggleBookmark } from '@/hooks/useBookmarks';
import { useToggleEditorPick } from '@/hooks/useEditorPicks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mixpanel } from '@/lib/mixpanel';

/**
 * 댓글 섹션 Lazy Loading 컴포넌트
 * Intersection Observer를 사용하여 스크롤 시에만 댓글 로드
 */
function CommentSectionLazy({ postId, postAuthorId, totalCommentCount }: { postId: string; postAuthorId?: string; totalCommentCount?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect(); // 한 번만 로드
          }
        });
      },
      {
        rootMargin: '200px', // 200px 전에 미리 로드 시작
        threshold: 0.1,
      }
    );

    if (commentRef.current) {
      observer.observe(commentRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={commentRef} data-comment-section>
      {isVisible ? (
        <CommentSectionPaginated postId={postId} postAuthorId={postAuthorId} totalCommentCount={totalCommentCount} />
      ) : (
        <div className="h-40 flex items-center justify-center text-gray-400">
          {/* Placeholder skeleton */}
          <div className="animate-pulse">댓글을 불러오는 중...</div>
        </div>
      )}
    </div>
  );
}

// Props 타입 정의
interface BlogPostDetailClientProps {
  initialPost?: any; // Post 타입으로 나중에 변경 가능
}

export default function BlogPostDetailClient({ initialPost }: BlogPostDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const hasViewed = useRef(false);

  const blogSlug = params.blogSlug as string;
  const postSlug = params.postSlug as string;

  // 블로그 정보 가져오기 (alias 리다이렉트 확인용)
  const { data: blog } = useBlogBySlug(blogSlug);

  // 301 리다이렉트 처리 (체크포인트 2: Alias 시스템)
  // old_alias로 접속한 경우 현재 alias로 영구 리다이렉트
  useEffect(() => {
    if (blog && 'shouldRedirect' in blog && blog.shouldRedirect && blog.redirectTo) {
      // SEO를 위한 301 영구 리다이렉트
      const redirectPath = `/${blog.redirectTo}/${postSlug}${searchParams ? `?${searchParams.toString()}` : ''}`;

      // @ 접두사가 있는 경우 항상 추가
      const finalRedirectPath = blog.redirectTo.startsWith('@')
        ? redirectPath
        : redirectPath.replace(`/${blog.redirectTo}`, `/@${blog.redirectTo}`);

      // Next.js 클라이언트 컴포넌트에서는 window.location을 사용하여 리다이렉트
      if (typeof window !== 'undefined') {
        window.location.replace(finalRedirectPath);
      }
    }
  }, [blog, postSlug, searchParams]);

  // Fetch post details - initialPost가 있으면 사용, 없으면 fetch
  const { data: post, error, isError, refetch } = usePost(postSlug, {
    initialData: initialPost,
    enabled: !initialPost, // initialPost가 있으면 fetch 안함
  });
  const deletePostMutation = useDeletePost();
  // 좋아요 토글 뮤테이션 (postId를 mutate 파라미터로 전달)
  const likeMutation = useTogglePostLike(() => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요를 누를 수 있습니다.');
  });

  // 북마크 기능 추가 - post.id 사용
  // post가 로드되지 않았을 때 빈 문자열 대신 명확한 처리
  const bookmarkMutation = useToggleBookmark(post?.id || '', () => {
    alert('로그인이 필요합니다.\n로그인 후 북마크를 추가할 수 있습니다.');
  });

  // Editor's Pick 토글 mutation (Admin 전용)
  const editorPickMutation = useToggleEditorPick(post?.id || '');


  const handleEdit = useCallback(() => {
    if (post) {
      router.push(`/p/${post.id}/edit`);
    }
  }, [post, router]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!post || deletePostMutation.isPending) return;

    setIsDeleting(true);

    try {
      // blogSlug를 명시적으로 전달하여 블로그 캐시 무효화 보장
      await deletePostMutation.mutateAsync({ postId: post.id, blogSlug });
      // 애니메이션 후 리다이렉트
      setTimeout(() => {
        router.push(`/${blogSlug}`);
      }, 300);
    } catch (error: any) {
      setIsDeleting(false);
      // 상세한 에러 메시지 처리
      const errorMessage = error?.response?.data?.message ||
                          error?.message ||
                          '게시글 삭제 중 오류가 발생했습니다';
      toast.error(errorMessage);
      console.error('Delete error:', error);
    }
  }, [post, deletePostMutation, router, blogSlug]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending && !isDeleting) {
      setDeleteDialogOpen(false);
    }
  }, [deletePostMutation.isPending, isDeleting]);

  const handleLike = useCallback(() => {
    if (!post || !user) return; // 로그인하지 않은 경우 실행 안 함
    likeMutation.mutate(post.id);
  }, [post, user, likeMutation]);

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
      // Fallback: copy URL to clipboard
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다!');
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

  // 북마크 핸들러 추가
  const handleBookmark = useCallback(() => {
    if (!post?.id || !user) return; // post.id가 없거나 로그인하지 않은 경우 실행 안 함
    bookmarkMutation.mutate();
  }, [post, user, bookmarkMutation]);

  // Editor's Pick 토글 핸들러 (Admin 전용)
  const handleToggleEditorPick = useCallback(() => {
    if (!post?.id) return;
    editorPickMutation.mutate();
  }, [post, editorPickMutation]);


  useEffect(() => {
    if (!hasViewed.current && post?.id) {
      hasViewed.current = true;
      // Increment view count
      fetch(`/api/v1/posts/${post.id}/view`, { method: 'POST' }).catch(console.error);

      // Mixpanel: 포스트 조회 이벤트 추적
      mixpanel.track('Post Viewed', {
        postId: post.id,
        slug: post.slug || postSlug,
      });
    }
  }, [post?.id]);

  if (isError) {
    // 에러 타입 구분
    const errorStatusCode = (error as any)?.statusCode;
    const errorMessage = (error as any)?.message || '오류가 발생했습니다';

    // 1) 404 에러 - 실제 삭제된 게시글
    if (errorStatusCode === 404) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          {/* 삭제 아이콘 */}
          <div className="mb-8">
            <svg className="w-24 h-24 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>

          <h2 className="text-xl font-medium text-gray-700 mb-8">
            이 게시글은 작성자에 의해 삭제되었습니다.
          </h2>

          <Link
            href="/"
            className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      );
    }

    // 2) 네트워크 에러 - 연결 끊김
    if (!errorStatusCode) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          {/* 네트워크 끊김 아이콘 */}
          <div className="mb-8">
            <svg className="w-24 h-24 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-medium text-gray-700 mb-3">
            연결이 끊겼습니다
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            인터넷 연결을 확인하고 다시 시도해주세요.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => refetch()}
              className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              홈으로 이동
            </Link>
          </div>
        </div>
      );
    }

    // 3) 서버 에러 (500+)
    if (errorStatusCode >= 500) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          {/* 서버 에러 아이콘 */}
          <div className="mb-8">
            <svg className="w-24 h-24 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-medium text-gray-700 mb-3">
            일시적인 서버 오류입니다
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            잠시 후 다시 시도해주세요.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => refetch()}
              className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              홈으로 이동
            </Link>
          </div>
        </div>
      );
    }

    // 4) 기타 에러 (403 등)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        {/* 일반 에러 아이콘 */}
        <div className="mb-8">
          <svg className="w-24 h-24 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-medium text-gray-700 mb-3">
          오류가 발생했습니다
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          {errorMessage}
        </p>

        <Link
          href="/"
          className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          홈으로 이동
        </Link>
      </div>
    );
  }

  // 아직 로딩 중이면 아무것도 표시하지 않음
  if (!post) {
    return null;
  }

  const isAuthor = user?.id === post.author?.id;
  const canEditDelete = isAuthor || isAdmin;

  return (
    <>
      {/* Article Content with deletion effect */}
      <article
        id="post-content"
        className={cn(
          "max-w-5xl mx-auto px-6 py-16 overflow-x-visible transition-all duration-500 relative",
          isDeleting && "opacity-30 blur-sm pointer-events-none scale-[0.98]"
        )}
      >
        {/* Deletion Overlay */}
        {isDeleting && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-2xl">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-gray-200 animate-pulse" />
                  <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-t-red-500 animate-spin" />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-900">게시글을 삭제하는 중...</p>
                <p className="mt-1 text-xs text-gray-500">잠시만 기다려주세요</p>
              </div>
            </div>
          </div>
        )}

        <PostHeaderWithReport
          post={post}
          canEdit={canEditDelete}
          onBack={() => router.back()}
          onEdit={handleEdit}
          onDelete={handleDelete}
          LikeButtonComponent={
            <LikeButton
              liked={post.liked || false}
              likeCount={post.likeCount || 0}
              onClick={handleLike}
            />
          }
          onShare={handleShare}
          onCopy={handleCopyContent}
          onBookmark={handleBookmark}
          bookmarked={post.bookmarked || false}
          bookmarkPending={bookmarkMutation.isPending}
          isAdmin={isAdmin}
          isEditorPick={post.isEditorPick || false}
          onToggleEditorPick={handleToggleEditorPick}
          editorPickPending={editorPickMutation.isPending}
        />

        {/* Article Body - 14px 크기, 모티브 블로그와 동일한 색상 */}
        <div className="blog-content">
          <HtmlContentRenderer content={post.content} />
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {(() => {
                // AI 태그를 맨 앞으로 정렬
                const sortedTags = [...post.tags];
                const aiIndex = sortedTags.findIndex(tag => tag.toLowerCase().startsWith('ai:'));
                if (aiIndex > -1) {
                  const [aiTag] = sortedTags.splice(aiIndex, 1);
                  sortedTags.unshift(aiTag);
                }

                return sortedTags.map((tag, index) => {
                  const isAITag = tag.toLowerCase().startsWith('ai:');
                  return (
                    <span
                      key={index}
                      className={`inline-flex items-center px-3 py-1 text-[13px] font-medium rounded-full cursor-pointer transition-colors ${
                        isAITag
                          ? 'bg-pink-100 text-pink-900 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-200 dark:hover:bg-pink-900/40'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      #{tag}
                    </span>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <AuthorInfo author={post.author} />

        {/* 댓글 섹션 - 블로그가 댓글을 허용하는 경우에만 표시 (Lazy Loading) */}
        {post.blog?.allowComments === true && post.id && (
          <CommentSectionLazy
            postId={String(post.id)}
            postAuthorId={post.author?.id?.toString()}
            totalCommentCount={post.commentCount}
          />
        )}
      </article>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending || isDeleting}
      />
    </>
  );
}