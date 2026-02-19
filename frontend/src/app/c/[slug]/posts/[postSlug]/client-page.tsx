'use client';

import React, { useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCommunity } from '@/hooks/community';
import {
  useCommunityPost,
  useCommunityPostVote,
  useDeleteCommunityPost,
  useIncrementPostView,
  useTogglePostPin,
  useTogglePostLock,
} from '@/hooks/community/useCommunityPosts';
import { useIsBookmarked, useToggleBookmark } from '@/hooks/useBookmarks';
import CommunityPostContent from '@/components/community/posts/CommunityPostContent';
import CommunityTrendingSection from '@/components/community/posts/CommunityTrendingSection';
import CommentSectionPaginated from '@/components/comments/CommentSectionPaginated';
import CommunitySidebar from '@/components/community/CommunitySidebar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { CommunityPost } from '@/types/community';

interface PostDetailClientProps {
  initialPost?: CommunityPost | null;
  params: Promise<{ slug: string; postSlug: string }>;
}

/**
 * 커뮤니티 게시물 상세 페이지 Client Component
 * - 게시물 상세 내용
 * - 댓글 목록
 * - 커뮤니티 사이드바
 */
export default function PostDetailClient({ initialPost, params }: PostDetailClientProps) {
  const { slug, postSlug } = use(params);
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // 삭제 다이얼로그 상태
  const [deletePostDialogOpen, setDeletePostDialogOpen] = useState(false);

  // 커뮤니티 정보 조회
  const {
    data: community,
    isLoading: isCommunityLoading,
    isError: isCommunityError,
    error: communityError,
  } = useCommunity(slug);

  // 게시물 조회
  const {
    data: post,
    isLoading: isPostLoading,
    isError: isPostError,
    error: postError,
  } = useCommunityPost(slug, postSlug, {
    initialData: initialPost ?? undefined,
  });

  // 조회수 증가
  useIncrementPostView(slug, post?.id);

  // Mutations
  const postVoteMutation = useCommunityPostVote(slug);
  const deletePostMutation = useDeleteCommunityPost(slug);
  // 모더레이션 mutations
  const togglePinMutation = useTogglePostPin(slug);
  const toggleLockMutation = useTogglePostLock(slug);

  // 북마크 state
  const { data: bookmarkStatus } = useIsBookmarked(post?.id || '');
  const bookmarkMutation = useToggleBookmark(post?.id || '', () => router.push('/login'));

  // 게시물 투표 핸들러
  const handlePostVote = useCallback((voteType: 'upvote' | 'downvote') => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!post) return;
    postVoteMutation.mutate({ postId: post.id, postSlug, voteType });
  }, [isAuthenticated, router, postVoteMutation, post, postSlug]);

  // 게시물 수정 핸들러
  const handleEditPost = useCallback(() => {
    router.push(`/c/${slug}/posts/${postSlug}/edit`);
  }, [router, slug, postSlug]);

  // 게시물 삭제 핸들러
  const handleDeletePost = useCallback(() => {
    setDeletePostDialogOpen(true);
  }, []);

  // 게시물 고정/해제 핸들러 (MODERATOR+)
  const handleTogglePin = useCallback((isPinned: boolean) => {
    if (!post) return;
    togglePinMutation.mutate({ postId: post.id, postSlug, isPinned });
  }, [togglePinMutation, postSlug, post]);

  // 게시물 잠금/해제 핸들러 (MODERATOR+)
  const handleToggleLock = useCallback((isLocked: boolean) => {
    if (!post) return;
    toggleLockMutation.mutate({ postId: post.id, postSlug, isLocked });
  }, [toggleLockMutation, postSlug, post]);

  const handleBookmarkClick = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!post) return;
    bookmarkMutation.mutate();
  }, [isAuthenticated, router, post, bookmarkMutation]);

  const confirmDeletePost = useCallback(async () => {
    if (!post) return;
    try {
      await deletePostMutation.mutateAsync({ postId: post.id, postSlug });
      router.push(`/c/${slug}`);
    } catch {
      // 에러 처리
    }
    setDeletePostDialogOpen(false);
  }, [deletePostMutation, post, postSlug, router, slug]);


  // 로딩 상태
  if (isCommunityLoading || isPostLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 네비게이션 바 스켈레톤 */}
        <div className="bg-white dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex gap-8">
            {/* 게시물 스켈레톤 */}
            <main className="flex-1 min-w-0">
              <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
                <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </main>

            {/* 사이드바 스켈레톤 */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (isPostError || isCommunityError) {
    const errorSource = (postError ?? communityError) as Error | null;
    const isPrivateAccessError =
      errorSource instanceof Error &&
      (((errorSource as Error & { status?: number }).status ?? 0) === 403 ||
        errorSource.message.includes('초대 전용'));

    if (isPrivateAccessError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              초대 전용 커뮤니티입니다
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              멤버만 접근할 수 있습니다. 초대 링크가 필요합니다.
            </p>
            <div className="flex items-center justify-center gap-3">
              {!isAuthenticated && (
                <Button onClick={() => router.push('/login')}>
                  로그인
                </Button>
              )}
              <Button variant="outline" onClick={() => router.back()}>
                뒤로 가기
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (postError instanceof Error && postError.message.includes('404')) {
      notFound();
    }
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            게시물을 불러올 수 없습니다
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {postError instanceof Error ? postError.message : '알 수 없는 오류가 발생했습니다.'}
          </p>
          <Button onClick={() => router.back()}>뒤로 가기</Button>
        </div>
      </div>
    );
  }

  if (!post || !community) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 상단 네비게이션 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/c"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <Home className="h-4 w-4" />
              </Link>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <Link
                href={`/c/${slug}`}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                c/{slug}
              </Link>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]">
                {post.title}
              </span>
            </nav>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* 게시물 + 댓글 영역 */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* 게시물 내용 */}
            <CommunityPostContent
              post={post}
              communitySlug={slug}
              userRole={community.userMembership?.role}
              currentUserId={user?.id}
              onVote={handlePostVote}
              isVotePending={postVoteMutation.isPending}
              onEditClick={handleEditPost}
              onDeleteClick={handleDeletePost}
              onTogglePinClick={handleTogglePin}
              onToggleLockClick={handleToggleLock}
              isModerationPending={togglePinMutation.isPending || toggleLockMutation.isPending}
              onBookmarkClick={handleBookmarkClick}
              isBookmarked={!!bookmarkStatus?.bookmarked}
            />

            {/* 댓글 섹션 - 블로그 스타일 (상단 border만) */}
            <section id="comments" className="mt-8 pt-8">
              <CommentSectionPaginated
                postId={post.id}
                postAuthorId={post.author?.id}
                totalCommentCount={post.commentCount}
                context={{ type: 'community', communitySlug: slug, postId: post.id }}
                isCommunityLocked={community.isLocked}
                lockedAt={community.lockedAt}
                lockedBy={community.lockedBy}
                communitySlug={slug}
                communityId={community.id}
              />
            </section>

            {/* Trending Posts Section */}
            <CommunityTrendingSection
              communitySlug={slug}
              currentPostId={post.id}
            />
          </main>

          {/* 사이드바 (데스크톱) */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-20">
              <CommunitySidebar
                community={community}
                showJoinButton={isAuthenticated}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 게시물 삭제 다이얼로그 */}
      <AlertDialog open={deletePostDialogOpen} onOpenChange={setDeletePostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePost}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
