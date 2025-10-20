'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Types
interface DashboardStats {
  users: {
    total: number;
    active: number;
    new: number;
    growth: number;
  };
  posts: {
    total: number;
    published: number;
    draft: number;
    growth: number;
  };
  comments: {
    total: number;
    today: number;
    growth: number;
  };
  reports: {
    pending: number;
    resolved: number;
    total: number;
  };
  engagement: {
    views: number;
    likes: number;
    shares: number;
  };
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  postsCount?: number;
  commentsCount?: number;
}

interface AdminPost {
  id: string;
  title: string;
  slug: string;
  author: {
    id: string;
    username: string;
  };
  blog: {
    id: string;
    name: string;
  };
  isPublished: boolean;
  publishedAt?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface AdminReport {
  id: string;
  type: 'post' | 'comment' | 'user';
  reason: string;
  description?: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed' | 'escalated';
  priority: number;
  targetId: string;
  reportedBy: {
    id: string;
    username: string;
  };
  reviewedBy?: {
    id: string;
    username: string;
  };
  actionTaken?: string;
  createdAt: string;
  reviewedAt?: string;
  target?: any; // Post, Comment, or User entity
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId: string;
  user?: {
    username: string;
  };
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
}

// API Functions
async function fetchWithAuth(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (response.status === 404) {
      throw new Error('Resource not found');
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  // For DELETE requests, the response might be empty
  if (options?.method === 'DELETE') {
    return response.text().then(text => text ? JSON.parse(text) : {});
  }

  return response.json();
}

// Dashboard Hooks
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => fetchWithAuth(`${API_URL}/admin/dashboard/stats`),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useRecentActivity() {
  return useQuery<AuditLog[]>({
    queryKey: ['admin', 'activity'],
    queryFn: () => fetchWithAuth(`${API_URL}/admin/audit/recent?limit=10`),
  });
}

// Users Management Hooks
export function useAdminUsers(page = 1, limit = 20, filters?: any) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  // Add filters to params if they exist
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
  }

  return useQuery({
    queryKey: ['admin', 'users', page, limit, filters],
    queryFn: async () => {
      const response = await fetchWithAuth(`${API_URL}/admin/users?${params}`);
      // Transform the response to match the expected format
      return {
        users: response.data || [],
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        page: response.page || page,
      };
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      fetchWithAuth(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User role updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user role');
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      fetchWithAuth(`${API_URL}/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user status');
    },
  });
}

// Posts Management Hooks
export function useAdminPosts(page = 1, limit = 20, filters?: any) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  // Add filters to params if they exist
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
  }

  return useQuery({
    queryKey: ['admin', 'posts', page, limit, JSON.stringify(filters || {})],
    queryFn: async () => {
      const response = await fetchWithAuth(`${API_URL}/posts?${params}`);
      // Return the response as-is since the backend already provides the correct structure
      return response;
    },
    staleTime: 30000, // 30초간 fresh 유지 (30초 내 재방문 시 API 호출 안함)
    gcTime: 5 * 60 * 1000, // 5분간 캐시 보관
    refetchOnWindowFocus: false, // 윈도우 포커스 시 refetch 방지
    placeholderData: (previousData) => previousData, // 이전 데이터를 placeholder로 사용
  });
}

export function useUpdatePostStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, isPublished }: { postId: string; isPublished: boolean }) =>
      fetchWithAuth(`${API_URL}/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      toast.success('Post status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update post status');
    },
  });
}

export function useBulkPostAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postIds, action }: { postIds: string[]; action: 'publish' | 'unpublish' | 'delete' }) => {
      // Handle bulk actions by calling individual endpoints
      const promises = postIds.map(postId => {
        if (action === 'delete') {
          return fetchWithAuth(`${API_URL}/posts/${postId}`, {
            method: 'DELETE',
          });
        } else {
          return fetchWithAuth(`${API_URL}/posts/${postId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isPublished: action === 'publish' }),
          });
        }
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      toast.success('Bulk action completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to perform bulk action');
    },
  });
}

// Reports Management Hooks
export function useAdminReports(page = 1, limit = 20, status?: string, type?: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (status) params.append('status', status);
  if (type) params.append('type', type);

  return useQuery({
    queryKey: ['admin', 'reports', page, limit, status, type],
    queryFn: async () => {
      const response = await fetchWithAuth(`${API_URL}/reports?${params}`);
      // Transform the response to match the expected format
      return {
        reports: response.reports || response.data || [],
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        page: response.page || page,
      };
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      reportId, 
      status, 
      actionTaken, 
      moderatorNotes 
    }: { 
      reportId: string; 
      status: string; 
      actionTaken?: string;
      moderatorNotes?: string;
    }) =>
      fetchWithAuth(`${API_URL}/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, actionTaken, moderatorNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      toast.success('Report updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update report');
    },
  });
}

export function useBatchUpdateReports() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      reportIds, 
      status, 
      actionTaken 
    }: { 
      reportIds: string[]; 
      status: string; 
      actionTaken?: string;
    }) =>
      fetchWithAuth(`${API_URL}/reports/batch/update`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          reportIds, 
          update: { status, actionTaken } 
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      toast.success('Reports updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update reports');
    },
  });
}

// Audit Logs Hooks
export function useAuditLogs(page = 1, limit = 50, filters?: any) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...filters,
  });

  return useQuery({
    queryKey: ['admin', 'audit', page, limit, filters],
    queryFn: () => fetchWithAuth(`${API_URL}/admin/audit?${params}`),
  });
}

// Statistics Hooks
export function useReportStatistics(startDate?: Date, endDate?: Date) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());

  return useQuery({
    queryKey: ['admin', 'reports', 'statistics', startDate, endDate],
    queryFn: () => fetchWithAuth(`${API_URL}/reports/statistics?${params}`),
  });
}

export function useContentStatistics() {
  return useQuery({
    queryKey: ['admin', 'content', 'statistics'],
    queryFn: () => fetchWithAuth(`${API_URL}/admin/posts/statistics`),
  });
}

// System Settings Hooks
export function useSystemSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => fetchWithAuth(`${API_URL}/admin/settings`),
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: any) =>
      fetchWithAuth(`${API_URL}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });
}