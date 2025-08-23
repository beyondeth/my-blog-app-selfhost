"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePost } from '@/hooks/usePosts';
import { FiEdit3, FiType, FiAlignLeft, FiImage, FiArrowLeft } from 'react-icons/fi';
import BlogRichTextEditor from '@/components/posts/RichTextEditor';
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

export default function BlogNewPostPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const blogSlug = params.blogSlug as string;
  const createPostMutation = useCreatePost();

  // Fetch blog info and check ownership
  useEffect(() => {
    if (!user || !blogSlug) {
      setLoading(false);
      return;
    }

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

        // Check if user is the blog owner
        if (blogData.owner?.id !== user.id) {
          toast.error('이 블로그에 글을 작성할 권한이 없습니다.');
          router.push(`/blog/${blogSlug}`);
          return;
        }
      } catch (error) {
        console.error('Error fetching blog:', error);
        toast.error('블로그 정보를 불러올 수 없습니다.');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [user, blogSlug, router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 이미 제출 중이거나 mutation이 진행 중이면 중복 실행 방지
    if (isSubmitting || createPostMutation.isPending) {
      return;
    }

    if (!blog) {
      setError('블로그 정보를 확인할 수 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true); // 작성 완료 진행 중 플래그 설정
      
      const newPost = await createPostMutation.mutateAsync({
        title,
        content,
        category: category || undefined,
        attachedFileIds: attachedFileIds.length > 0 ? attachedFileIds : undefined,
        // The backend will automatically assign the post to the user's blog
      });
      
      toast.success('글이 성공적으로 작성되었습니다!');
      // Redirect to the post in the blog context
      // Use the blog slug from the current page since we already have it
      router.push(`/blog/${blogSlug}/posts/${newPost.slug || newPost.id}`);
    } catch (error: any) {
      setIsSubmitting(false); // 에러 발생 시 플래그 리셋
      setError(error.message || '게시글 작성에 실패했습니다.');
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleFilesChange = (fileIds: string[]) => {
    setAttachedFileIds(fileIds);
  };

  const handleCancel = async () => {
    // 작성 취소 시 업로드된 파일들 수동 cleanup
    try {
      // RichTextEditor에서 imageTracker 인스턴스를 가져오기 위해
      // 글로벌 이벤트를 통해 force cleanup 요청
      window.dispatchEvent(new CustomEvent('cleanup-uploaded-files', { detail: { force: true } }));
      
      // 약간의 지연 후 페이지 이동
      setTimeout(() => {
        router.push(`/blog/${blogSlug}`);
      }, 100);
    } catch (error) {
      console.error('Failed to cleanup files:', error);
      // 에러가 있어도 페이지는 이동
      router.push(`/blog/${blogSlug}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">블로그 정보 확인 중...</p>
        </div>
      </div>
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
            onClick={() => router.push(`/blog/${blogSlug}`)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            {blog.name}으로 돌아가기
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <FiEdit3 className="mr-3 h-6 w-6" />
              새 게시글 작성
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">{blog.name}</span>에 새 글을 작성합니다
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
                className="min-h-[500px]"
                enableCleanupOnUnmount={!isSubmitting}
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
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                취소
              </button>
              
              <button
                type="submit"
                disabled={createPostMutation.isPending || !title.trim() || !content.trim()}
                className="px-8 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createPostMutation.isPending ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    작성 중...
                  </span>
                ) : (
                  '게시글 작성'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}