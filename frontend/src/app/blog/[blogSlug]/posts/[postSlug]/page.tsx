'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import HtmlContentRenderer from '@/components/ui/HtmlContentRenderer';
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
import { cn } from '@/lib/utils';

interface Blog {
  id: string;
  slug: string;
  name: string;
  description?: string;
  allowComments?: boolean;
  isPublic?: boolean;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [blogError, setBlogError] = useState<string | null>(null);
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
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/slug/${blogSlug}`,
          {
            credentials: 'include'
          }
        );
        if (response.ok) {
          const blogData = await response.json();
          setBlog(blogData);
          setBlogError(null);
          
        } else if (response.status === 404) {
          setBlogError('블로그를 찾을 수 없습니다.');
        } else {
          setBlogError('블로그 정보를 불러오는데 실패했습니다.');
        }
      } catch (error) {
        console.error('Error fetching blog:', error);
        setBlogError('블로그 정보를 불러오는데 실패했습니다.');
      }
    };

    fetchBlog();
  }, [blogSlug, user]);

  // Fetch post details
  const { data: post, error, isError } = usePost(postSlug);
  const deletePostMutation = useDeletePost();
  const likeMutation = useTogglePostLike(postSlug, () => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요를 누를 수 있습니다.');
  });


  const handleEdit = useCallback(() => {
    if (post && blog) {
      router.push(`/blog/${blog.slug}/posts/${post.slug || post.id}/edit`);
    }
  }, [post, blog, router]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!post || deletePostMutation.isPending) return;
    
    setIsDeleting(true);
    
    try {
      await deletePostMutation.mutateAsync(post.id);
      // 애니메이션 후 리다이렉트
      setTimeout(() => {
        router.push(`/blog/${blogSlug}`);
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


  useEffect(() => {
    if (!hasViewed.current && post?.id) {
      hasViewed.current = true;
      // Increment view count
      fetch(`/api/v1/posts/${post.id}/view`, { method: 'POST' }).catch(console.error);
    }
  }, [post?.id]);

  if (isError) {
    // 실제 에러인 경우 (404 등)
    return (
      <ErrorMessage 
        message={error?.message || '게시글을 찾을 수 없습니다.'}
        showBackButton={true}
      />
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
        className={cn(
          "max-w-5xl mx-auto px-6 py-16 transition-all duration-500 relative",
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
          onBack={() => router.push(`/blog/${blogSlug}`)}
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
        />

        {/* Article Body - 14px 크기, 모티브 블로그와 동일한 색상 */}
        <div className="blog-content">
          <HtmlContentRenderer content={post.content} />
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-100">
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
                      className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                        isAITag
                          ? 'bg-pink-100 text-pink-900 hover:bg-pink-200'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
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

        {/* 댓글 섹션 - 블로그가 댓글을 허용하는 경우에만 표시 */}
        {blog && blog.allowComments === true && post.id && (
          <CommentSection 
            postId={String(post.id)}
            postAuthorId={post.author?.id?.toString()}
          />
        )}
      </article>
      
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending || isDeleting}
        itemName={`"${post.title}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${post.title}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </>
  );
}