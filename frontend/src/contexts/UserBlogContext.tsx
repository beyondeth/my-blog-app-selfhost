'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useUserBlog } from '@/hooks/useUserBlog';

interface Blog {
  id: string;
  slug: string;
  name: string;
  description?: string;
  userId: string;
}

interface UserBlogContextType {
  blog: Blog | null;
  loading: boolean;
  error: string | null;
  checkAndRedirect: () => Promise<string>;
  refresh: () => Promise<void>;
}

const UserBlogContext = createContext<UserBlogContextType | undefined>(undefined);

export function UserBlogProvider({ children }: { children: React.ReactNode }) {
  const userBlogData = useUserBlog();

  return (
    <UserBlogContext.Provider value={userBlogData}>
      {children}
    </UserBlogContext.Provider>
  );
}

export function useUserBlogContext() {
  const context = useContext(UserBlogContext);
  if (context === undefined) {
    throw new Error('useUserBlogContext must be used within a UserBlogProvider');
  }
  return context;
}