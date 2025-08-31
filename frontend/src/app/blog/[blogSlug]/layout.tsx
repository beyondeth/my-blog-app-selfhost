'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Blog {
  id: string;
  slug: string;
  name: string;
  isPublic?: boolean;
  owner?: {
    id: string;
    username: string;
    email: string;
  };
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const blogSlug = params.blogSlug as string;

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
          
          // Check if blog is private and user is not the owner
          if (blogData.isPublic === false && (!user || String(blogData.owner?.id) !== String(user?.id))) {
            setIsPrivate(true);
          }
        } else {
          // If blog not found or error, let individual pages handle it
          setBlog(null);
        }
      } catch (error) {
        console.error('Error fetching blog:', error);
        setBlog(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [blogSlug, user]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Show private blog message for all routes under this blog
  if (isPrivate) {
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

  // Render children for public blogs or blog owner
  return <>{children}</>;
}