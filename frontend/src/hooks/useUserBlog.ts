'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { blogLogger } from '@/utils/logger';

interface Blog {
  id: string;
  slug: string;
  name: string;
  description?: string;
  userId: string;
}

export function useUserBlog() {
  const { user } = useAuth();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserBlog = useCallback(async () => {
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
  }, [user]);

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
    if (!user) {
      return '/login';
    }

    if (blog) {
      return `/blog/${blog.slug}/posts/new`;
    }

    // If no blog, redirect to blog creation
    return '/blog/new';
  };

  // Refresh function for external use (e.g., after blog creation)
  const refresh = useCallback(() => {
    blogLogger.debug('[useUserBlog] Manual refresh triggered');
    return fetchUserBlog();
  }, [fetchUserBlog]);

  return { blog, loading, error, checkAndRedirect, refresh };
}