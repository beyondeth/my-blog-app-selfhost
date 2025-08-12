'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import ContentRenderer from '@/components/ui/ContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeader from '@/components/posts/PostHeader';
import AuthorInfo from '@/components/posts/AuthorInfo';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { usePost, useDeletePost, useTogglePostLike, useBatchLikeManager } from '@/hooks/usePosts';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LikeButton from '@/components/ui/LikeButton';

interface Blog {
  id: string;
  slug: string;
  name: string;
  description?: string;
  owner?: {
    id: string;
    username: string;
    email: string;
  };
}

export default function BlogPostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blog, setBlog] = useState<Blog | null>(null);
  const queryClient = useQueryClient();
  const hasViewed = useRef(false);
  const { updateLike } = useBatchLikeManager();

  const blogSlug = params.blogSlug as string;
  const postSlug = params.postSlug as string;

  // Fetch blog info
  useEffect(() => {
    if (!blogSlug) return;

    const fetchBlog = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/slug/${blogSlug}`
        );
        if (response.ok) {
          const blogData = await response.json();
          setBlog(blogData);
        }
      } catch (error) {
        console.error('Error fetching blog:', error);
      }
    };

    fetchBlog();
  }, [blogSlug]);

  // Fetch post details
  const { data: post, isLoading, error, isError } = usePost(postSlug);
  const deletePostMutation = useDeletePost();
  const likeMutation = useTogglePostLike(postSlug, () => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요를 누를 수 있습니다.');
  });

  useEffect(() => {
    if (post) {
      setLiked(post.liked);
      setLikeCount(post.likeCount);
    }
  }, [post]);

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
        router.push(`/blog/${blogSlug}`);
      },
      onError: () => {
        // Keep dialog open on error for retry
      }
    });
  }, [post, deletePostMutation, router, blogSlug]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending) {
      setDeleteDialogOpen(false);
    }
  }, [deletePostMutation.isPending]);

  const handleLike = useCallback(() => {
    if (!post) return;
    // Immediate UI update
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      updateLike(post.id, false);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      updateLike(post.id, true);
    }
  }, [post, liked, updateLike]);

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

  useEffect(() => {
    if (!hasViewed.current && post?.id) {
      hasViewed.current = true;
      // Increment view count
      fetch(`/api/v1/posts/${post.id}/view`, { method: 'POST' }).catch(console.error);
    }
  }, [post?.id]);

  if (isLoading) {
    return <LoadingSpinner message="게시글을 불러오는 중..." />;
  }

  if (isError || !post) {
    return (
      <ErrorMessage 
        message={error?.message || '게시글을 찾을 수 없습니다.'}
        showBackButton={true}
      />
    );
  }

  const isAuthor = user?.id === post.author?.id;
  const canEditDelete = isAuthor || isAdmin;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back to blog button */}
        <button
          onClick={() => router.push(`/blog/${blogSlug}`)}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          {blog ? `${blog.name}으로 돌아가기` : '블로그로 돌아가기'}
        </button>

        {/* Post header */}
        <PostHeader
          post={post}
          canEdit={canEditDelete}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Author info */}
        <AuthorInfo
          author={post.author}
          publishedAt={post.publishedAt}
        />

        {/* Post content */}
        <article className="prose prose-lg dark:prose-invert max-w-none mt-8">
          <ContentRenderer content={post.content} />
        </article>

        {/* Post actions */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <LikeButton
              liked={liked}
              likeCount={likeCount}
              onClick={handleLike}
              loading={likeMutation.isPending}
            />
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-4.474 0-8.268 3.12-9.032 7.326m0 0A9.001 9.001 0 0012 21c4.474 0 8.268-3.12 9.032-7.326" />
              </svg>
              <span>공유</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
        itemName={`"${post.title}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${post.title}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </div>
  );
}