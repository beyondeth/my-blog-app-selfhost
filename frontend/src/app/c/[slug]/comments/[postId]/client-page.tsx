'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
import CommunityPostContent from '@/components/community/posts/CommunityPostContent';
import CommunityTrendingSection from '@/components/community/posts/CommunityTrendingSection';
import CommentSectionPaginated from '@/components/comments/CommentSectionPaginated';
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

interface CommunityPostDetailClientProps {
  communitySlug: string;
  postSlug: string;
  initialPost?: CommunityPost;
}

/**
 * 커뮤니티 게시물 상세 클라이언트 컴포넌트
 *
 * @description
 * - Reddit 스타일 URL: /c/{slug}/comments/{postId}
 * - 서버 컴포넌트에서 전달받은 초기 데이터 사용
 * - 실시간 상태 관리 (투표, 댓글 등)
 */
export default function CommunityPostDetailClient({
  communitySlug,
  postSlug,
  initialPost,
}: CommunityPostDetailClientProps) {
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
  } = useCommunity(communitySlug);

  // 게시물 조회 (초기 데이터 사용)
  const {
    data: post,
    isLoading: isPostLoading,
    isError: isPostError,
    error: postError,
  } = useCommunityPost(communitySlug, postSlug, {
    initialData: initialPost,
  });

  // 조회수 증가
  useIncrementPostView(communitySlug, postSlug);

  // Mutations
  const postVoteMutation = useCommunityPostVote(communitySlug);
  const deletePostMutation = useDeleteCommunityPost(communitySlug);
  const togglePinMutation = useTogglePostPin(communitySlug);
  const toggleLockMutation = useTogglePostLock(communitySlug);

  // 게시물 투표 핸들러
  const handlePostVote = useCallback((voteType: 'upvote' | 'downvote') => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!post) return;
    postVoteMutation.mutate({ postId: post.id, postSlug, voteType });
  }, [isAuthenticated, router, postVoteMutation, post, postSlug]);

  // 게시물 수정 핸들러 (새 URL 구조 사용)
  const handleEditPost = useCallback(() => {
    router.push(`/c/${communitySlug}/comments/${postSlug}/edit`);
  }, [router, communitySlug, postSlug]);

  // 게시물 삭제 핸들러
  const handleDeletePost = useCallback(() => {
    setDeletePostDialogOpen(true);
  }, []);

  // 게시물 고정/해제 핸들러
  const handleTogglePin = useCallback((isPinned: boolean) => {
    togglePinMutation.mutate({ postSlug, isPinned });
  }, [togglePinMutation, postSlug]);

  // 게시물 잠금/해제 핸들러
  const handleToggleLock = useCallback((isLocked: boolean) => {
    toggleLockMutation.mutate({ postSlug, isLocked });
  }, [toggleLockMutation, postSlug]);

  const confirmDeletePost = useCallback(async () => {
    if (!post) return;
    try {
      await deletePostMutation.mutateAsync({ postId: post.id, postSlug });
      router.push(`/c/${communitySlug}`);
    } catch {
      // 에러 처리
    }
    setDeletePostDialogOpen(false);
  }, [deletePostMutation, post, postSlug, router, communitySlug]);


  // 로딩 상태
  if (isCommunityLoading || isPostLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex gap-8">
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:pr-[12ch]">
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Link
            href={`/c/${communitySlug}`}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
          >
            c/{communitySlug}
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[220px]">
            {post.title}
          </span>
        </div>

        <CommunityPostContent
          post={post}
          communitySlug={communitySlug}
          userRole={community.userMembership?.role}
          currentUserId={user?.id}
          onVote={handlePostVote}
          isVotePending={postVoteMutation.isPending}
          onEditClick={handleEditPost}
          onDeleteClick={handleDeletePost}
          onTogglePinClick={handleTogglePin}
          onToggleLockClick={handleToggleLock}
          isModerationPending={togglePinMutation.isPending || toggleLockMutation.isPending}
          variant="article"
          className="pb-0"
        />

        <section id="comments" className="mt-16 pt-8">
          <CommentSectionPaginated
            postId={post.id}
            postAuthorId={post.author?.id}
            totalCommentCount={post.commentCount}
            context={{ type: 'community', communitySlug, postId: post.id }}
            isCommunityLocked={community.isLocked}
            lockedAt={community.lockedAt}
            lockedBy={community.lockedBy}
            communitySlug={communitySlug}
          />
        </section>

        {/* Trending Posts Section */}
        <CommunityTrendingSection
          communitySlug={communitySlug}
          currentPostId={post.id}
        />
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
