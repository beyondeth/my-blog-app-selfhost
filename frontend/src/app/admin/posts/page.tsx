'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Eye,
  Heart,
  MessageSquare,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  XCircle,
  Edit,
  Trash,
  Download,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAdminPosts, useUpdatePostStatus, useBulkPostAction } from '@/hooks/useAdmin';
import { t } from '@/constants/adminTranslations';

interface Post {
  id: string;
  title: string;
  slug: string;
  author: {
    id: string;
    username: string;
  };
  blog?: {
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

export default function PostsManagement() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: 'publish' | 'unpublish' | 'delete' | null;
  }>({ open: false, action: null });

  // API Hooks
  const { data, isLoading, refetch, isFetching } = useAdminPosts(page, 20, {
    search: searchTerm || undefined,
    isPublished: statusFilter === 'published' ? true : statusFilter === 'draft' ? false : undefined,
    category: categoryFilter || undefined,
  });
  const updateStatusMutation = useUpdatePostStatus();
  const bulkActionMutation = useBulkPostAction();

  const posts = data?.posts || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const hasMore = page < totalPages;

  useEffect(() => {
    if (data?.posts) {
      if (page === 1) {
        // Reset posts when filters change
        setAllPosts(data.posts);
      } else {
        // Append posts when loading more
        setAllPosts(prev => [...prev, ...data.posts]);
      }
    }
  }, [data, page]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
    setAllPosts([]);
    refetch();
  }, [searchTerm, statusFilter, categoryFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value === 'all' ? '' : value);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value === 'all' ? '' : value);
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const handleTogglePublish = async (postId: string, currentStatus: boolean) => {
    updateStatusMutation.mutate(
      { postId, isPublished: !currentStatus },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const handleBulkAction = async () => {
    if (!bulkActionDialog.action || selectedPosts.length === 0) return;

    bulkActionMutation.mutate(
      { postIds: selectedPosts, action: bulkActionDialog.action },
      {
        onSuccess: () => {
          setSelectedPosts([]);
          setBulkActionDialog({ open: false, action: null });
          refetch();
        },
      }
    );
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === allPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(allPosts.map(p => p.id));
    }
  };

  const handleSelectPost = (postId: string) => {
    if (selectedPosts.includes(postId)) {
      setSelectedPosts(selectedPosts.filter(id => id !== postId));
    } else {
      setSelectedPosts([...selectedPosts, postId]);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('isPublished', statusFilter === 'published' ? 'true' : 'false');
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/posts/export?${params}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export posts');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `posts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('포스트를 성공적으로 내보냈습니다');
    } catch (error) {
      console.error('Error exporting posts:', error);
      toast.error('포스트 내보내기에 실패했습니다');
    }
  };

  const categories = Array.from(new Set(allPosts.map(p => p.category).filter(Boolean))) as string[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.posts.title}</h1>
        <p className="text-gray-600 mt-1">{t.posts.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.posts.totalPosts}</p>
                <p className="text-2xl font-semibold">{total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.posts.published}</p>
                <p className="text-2xl font-semibold">
                  {allPosts.filter(p => p.isPublished).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.posts.drafts}</p>
                <p className="text-2xl font-semibold">
                  {allPosts.filter(p => !p.isPublished).length}
                </p>
              </div>
              <Edit className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.posts.totalViews}</p>
                <p className="text-2xl font-semibold">
                  {allPosts.reduce((acc, p) => acc + p.viewCount, 0).toLocaleString()}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t.posts.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter || 'all'} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="상태로 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.posts.allStatus}</SelectItem>
                <SelectItem value="published">{t.status.published}</SelectItem>
                <SelectItem value="draft">{t.status.draft}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter || 'all'} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="카테고리로 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.posts.allCategories}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t.actions.refresh}
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {t.actions.export}
            </Button>
          </div>
          
          {selectedPosts.length > 0 && (
            <div className="flex items-center gap-4 mt-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedPosts.length}{t.posts.selectedPosts}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkActionDialog({ open: true, action: 'publish' })}
              >
                {t.actions.publish}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkActionDialog({ open: true, action: 'unpublish' })}
              >
                {t.actions.unpublish}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkActionDialog({ open: true, action: 'delete' })}
                className="text-red-600 hover:text-red-700"
              >
                {t.actions.delete}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPosts([])}
              >
                {t.actions.clearSelection}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={selectedPosts.length === allPosts.length && allPosts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>{t.posts.title}</TableHead>
                <TableHead>{t.posts.author}</TableHead>
                <TableHead>{t.posts.status}</TableHead>
                <TableHead>{t.posts.category}</TableHead>
                <TableHead>{t.posts.stats}</TableHead>
                <TableHead>{t.posts.publishedDate}</TableHead>
                <TableHead className="text-right">{t.posts.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && page === 1 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : allPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {t.posts.noPostsFound}
                  </TableCell>
                </TableRow>
              ) : (
                allPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedPosts.includes(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium line-clamp-1">{post.title}</p>
                        <p className="text-xs text-gray-500">{post.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{post.author.username}</p>
                        {post.blog && (
                          <p className="text-xs text-gray-500">{post.blog.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.isPublished ? 'default' : 'secondary'}>
                        {post.isPublished ? t.status.published : t.status.draft}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {post.category || <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {post.viewCount}
                        </span>
                        <span className="flex items-center">
                          <Heart className="h-3 w-3 mr-1" />
                          {post.likeCount}
                        </span>
                        <span className="flex items-center">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {post.commentCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.publishedAt
                        ? format(new Date(post.publishedAt), 'MMM d, yyyy')
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => window.open(`/posts/${post.slug}`, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t.posts.viewPost}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTogglePublish(post.id, post.isPublished)}
                          >
                            {post.isPublished ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                {t.actions.unpublish}
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {t.actions.publish}
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/posts/edit/${post.slug}`, '_blank')}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t.posts.editPost}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              if (confirm('이 포스트를 삭제하시겠습니까?')) {
                                bulkActionMutation.mutate(
                                  { postIds: [post.id], action: 'delete' },
                                  { onSuccess: () => refetch() }
                                );
                              }
                            }}
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            {t.actions.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isFetching}
            className="px-8"
          >
            {isFetching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                로딩 중...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                더보기 ({allPosts.length} / {total})
              </>
            )}
          </Button>
        </div>
      )}
      {!hasMore && allPosts.length > 0 && (
        <div className="text-center mt-6 text-sm text-gray-500">
          모든 포스트를 불러왔습니다 (총 {total}개)
        </div>
      )}

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setBulkActionDialog({ open: false, action: null });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkActionDialog.action === 'publish' && '포스트 게시'}
              {bulkActionDialog.action === 'unpublish' && '포스트 게시 취소'}
              {bulkActionDialog.action === 'delete' && '포스트 삭제'}
            </DialogTitle>
            <DialogDescription>
              {bulkActionDialog.action === 'publish' && 
                `${selectedPosts.length}개의 포스트를 게시하시겠습니까?`}
              {bulkActionDialog.action === 'unpublish' && 
                `${selectedPosts.length}개의 포스트를 게시 취소하시겠습니까?`}
              {bulkActionDialog.action === 'delete' && 
                `${selectedPosts.length}개의 포스트를 삭제하시겠습니까? 이 작업은 실행 취소할 수 없습니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkActionDialog({ open: false, action: null })}
            >
              {t.actions.cancel}
            </Button>
            <Button
              variant={bulkActionDialog.action === 'delete' ? 'destructive' : 'default'}
              onClick={handleBulkAction}
              disabled={bulkActionMutation.isPending}
            >
              {bulkActionMutation.isPending ? '처리 중...' : t.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}