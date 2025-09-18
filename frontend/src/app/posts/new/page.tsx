"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCreatePost } from '@/hooks/usePosts';
import { FiEdit3, FiType, FiAlignLeft, FiImage } from 'react-icons/fi';
import { BlogRichTextEditor } from '@/editor';

export default function NewPostPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]);
  
  const { user } = useAuth();
  const router = useRouter();
  const createPostMutation = useCreatePost();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Multi-user blog system - all logged in users can write
    // 나중에 여기서 사용자의 블로그를 선택하도록 할 수 있음
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const newPost = await createPostMutation.mutateAsync({
        title,
        content,
        category: category || undefined,
        attachedFileIds: attachedFileIds.length > 0 ? attachedFileIds : undefined,
      });
      // 성공 시 해당 글 상세(slug) 페이지로 이동
      router.push(`/posts/${newPost.slug || newPost.id}`);
    } catch (error: any) {
      setError(error.message || '게시글 작성에 실패했습니다.');
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleFilesChange = (fileIds: string[]) => {
    setAttachedFileIds(fileIds);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로그인 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <FiEdit3 className="mr-3 h-6 w-6" />
              새 게시글 작성
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Rich Text Editor로 이미지, 동영상, 파일을 포함한 멋진 글을 작성해보세요.
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
                onClick={() => router.back()}
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