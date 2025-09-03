'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePost, useUpdatePost } from '@/hooks/usePosts';
import { FiEdit3, FiType, FiAlignLeft, FiImage, FiArrowLeft } from 'react-icons/fi';
import BlogRichTextEditor from '@/components/posts/RichTextEditor';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
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

export default function BlogEditPostPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]);
  const [thumbnailId, setThumbnailId] = useState<string>('');
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const blogSlug = params.blogSlug as string;
  const postSlug = params.postSlug as string;
  
  const { data: post, isLoading: postLoading, error: postError } = usePost(postSlug);
  const updatePostMutation = useUpdatePost();

  // Fetch blog info
  useEffect(() => {
    if (!blogSlug) return;

    const fetchBlog = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/slug/${blogSlug}`
        );

        if (!response.ok) {
          toast.error('블로그를 찾을 수 없습니다.');
          router.push('/');
          return;
        }

        const blogData = await response.json();
        setBlog(blogData);
      } catch (error) {
        console.error('Error fetching blog:', error);
        toast.error('블로그 정보를 불러올 수 없습니다.');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [blogSlug, router]);

  // Load post data
  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setCategory(post.category || '');
      
      // Set attached file IDs if they exist
      if (post.attachedFiles && post.attachedFiles.length > 0) {
        setAttachedFileIds(post.attachedFiles.map((file: any) => file.id));
      }
      
      // Set thumbnail if exists
      if (post.thumbnailFileId) {
        setThumbnailId(post.thumbnailFileId);
      }
    }
  }, [post]);

  // Check permissions
  useEffect(() => {
    if (!loading && !postLoading && post && user && blog) {
      const isAuthor = post.author?.id === user.id;
      const isBlogOwner = blog.owner?.id === user.id;
      
      if (!isAuthor && !isBlogOwner && !isAdmin) {
        toast.error('이 글을 수정할 권한이 없습니다.');
        router.push(`/blog/${blogSlug}/posts/${postSlug}`);
      }
    }
  }, [loading, postLoading, post, user, blog, isAdmin, router, blogSlug, postSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!post || !blog) {
      setError('게시글 정보를 확인할 수 없습니다.');
      return;
    }

    try {
      await updatePostMutation.mutateAsync({
        id: post.id,
        data: {
          title,
          content,
          category: category || undefined,
          attachedFileIds: attachedFileIds.length > 0 ? attachedFileIds : undefined,
          thumbnailFileId: thumbnailId || undefined,
        }
      });
      
      toast.success('글이 성공적으로 수정되었습니다!');
      router.push(`/blog/${blogSlug}/posts/${post.slug || post.id}`);
    } catch (error: any) {
      setError(error.message || '게시글 수정에 실패했습니다.');
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleFilesChange = (fileIds: string[]) => {
    setAttachedFileIds(fileIds);
  };

  const handleThumbnailSelect = (fileId: string) => {
    setThumbnailId(fileId);
  };

  if (loading || postLoading) {
    return <LoadingSpinner message="게시글을 불러오는 중..." />;
  }

  if (postError || !post) {
    return (
      <ErrorMessage 
        message={postError?.message || '게시글을 찾을 수 없습니다.'}
        showBackButton={true}
      />
    );
  }

  if (!user || !blog) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/blog/${blogSlug}/posts/${postSlug}`)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            게시글로 돌아가기
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <FiEdit3 className="mr-3 h-6 w-6" />
              게시글 수정
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">{blog.name}</span>의 글을 수정합니다
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiType className="inline mr-2 h-4 w-4" />
                제목
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="멋진 제목을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                카테고리 (선택사항)
              </label>
              <input
                id="category"
                name="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="예: 개발, 일상, 리뷰 등"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiAlignLeft className="inline mr-2 h-4 w-4" />
                내용
              </label>
              
              <BlogRichTextEditor
                content={content}
                onChange={handleContentChange}
                onFilesChange={handleFilesChange}
                onThumbnailSelect={handleThumbnailSelect}
                enableImageManager={true}
                maxImages={5}
                className="min-h-[500px]"
                enableCleanupOnUnmount={false}
              />
              
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-4">
                <span className="flex items-center">
                  <FiImage className="mr-1 h-4 w-4" />
                  이미지/파일을 드래그하거나 툴바에서 업로드하세요
                </span>
                {attachedFileIds.length > 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    첨부된 파일: {attachedFileIds.length}개
                  </span>
                )}
                {thumbnailId && (
                  <span className="text-green-600 dark:text-green-400">
                    썸네일 설정됨
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.push(`/blog/${blogSlug}/posts/${postSlug}`)}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                취소
              </button>
              
              <button
                type="submit"
                disabled={updatePostMutation.isPending || !title.trim() || !content.trim()}
                className="px-8 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatePostMutation.isPending ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    수정 중...
                  </span>
                ) : (
                  '게시글 수정'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}