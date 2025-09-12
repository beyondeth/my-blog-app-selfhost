'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { blogLogger } from '@/utils/logger';
import { Blog } from '@/types';

export function useUserBlog() {
  const { user, isLoading: authLoading } = useAuth();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserBlog = useCallback(async () => {
    // 인증 상태가 로딩 중이면 대기
    if (authLoading) {
      blogLogger.debug('[useUserBlog] Auth still loading, waiting...');
      return;
    }

    if (!user) {
      blogLogger.debug('[useUserBlog] No user, clearing blog state');
      setBlog(null);
      return;
    }

    blogLogger.debug('[useUserBlog] Fetching blog for user');
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/my-blogs`,
        {
          credentials: 'include',
        }
      );

      blogLogger.debug('[useUserBlog] API Response status', { status: response.status });

      if (response.ok) {
        const blogs = await response.json();
        blogLogger.debug('[useUserBlog] API Response data received');
        // Since users can only have one blog, take the first one
        if (blogs && blogs.length > 0) {
          blogLogger.info('[useUserBlog] Found user blog');
          setBlog(blogs[0]);
        } else {
          blogLogger.debug('[useUserBlog] No blogs found for user');
          setBlog(null);
        }
      } else if (response.status === 404) {
        blogLogger.debug('[useUserBlog] 404 - No blogs found');
        setBlog(null);
      } else {
        const errorText = await response.text();
        blogLogger.error('[useUserBlog] API Error', { status: response.status });
        setError('Failed to fetch user blog');
      }
    } catch (err) {
      blogLogger.error('[useUserBlog] Network Error');
      setError('Failed to fetch user blog');
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchUserBlog();
  }, [fetchUserBlog]);

  // Listen for custom refresh events
  useEffect(() => {
    const handleRefresh = () => {
      blogLogger.debug('[useUserBlog] Received refresh event, refetching...');
      fetchUserBlog();
    };

    window.addEventListener('userBlogRefresh', handleRefresh);
    return () => window.removeEventListener('userBlogRefresh', handleRefresh);
  }, [fetchUserBlog]);

  const checkAndRedirect = async (): Promise<string> => {
    if (authLoading) {
      return '/'; // 로딩 중이면 홈으로
    }

    if (!user) {
      return '/login';
    }

    if (blog) {
      return `/new-story`;
    }

    // If no blog exists (shouldn't happen for new users), redirect to home
    // This might occur for existing users before the auto-blog feature
    console.error('User does not have a blog. This should not happen for new users.');
    return '/';
  };

  // Refresh function for external use (e.g., after blog creation)
  const refresh = useCallback(() => {
    blogLogger.debug('[useUserBlog] Manual refresh triggered');
    return fetchUserBlog();
  }, [fetchUserBlog]);

  return { blog, loading, error, checkAndRedirect, refresh };
}