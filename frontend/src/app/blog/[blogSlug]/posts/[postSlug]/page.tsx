'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import ContentRenderer from '@/components/ui/ContentRenderer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostHeaderWithReport from '@/components/posts/PostHeaderWithReport';
import AuthorInfo from '@/components/posts/AuthorInfo';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import CommentSection from '@/components/comments/CommentSection';
import { useAuth } from '@/hooks/useAuth';
import { usePost, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LikeButton from '@/components/ui/LikeButton';
import { toast } from 'sonner';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blog, setBlog] = useState<Blog | null>(null);
  const queryClient = useQueryClient();
  const hasViewed = useRef(false);

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

        {/* Post header with report functionality */}
        <PostHeaderWithReport
          post={post}
          canEdit={canEditDelete}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopy={handleCopyContent}
          liked={post.liked}
          likeCount={post.likeCount}
          onLike={handleLike}
          onShare={handleShare}
        />

        {/* Author info */}
        <AuthorInfo
          author={post.author}
        />

        {/* Post content */}
        <article className="prose prose-lg dark:prose-invert max-w-none mt-8">
          <ContentRenderer content={post.content} />
        </article>

        {/* Post actions */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <LikeButton
              liked={post.liked}
              likeCount={post.likeCount}
              onClick={handleLike}
              disabled={likeMutation.isPending}
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

        {/* Comments Section */}
        <CommentSection
          postId={post.id.toString()}
          postAuthorId={post.author?.id?.toString()}
        />
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