'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDeletePost } from '@/hooks/usePosts';
import { useAuth } from '@/providers/AuthProviderV2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Pencil, Clock, AlertCircle, Loader2, Trash2, Lock, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import type { Post } from '@/types';

type ManagementTab = 'drafts' | 'published_public' | 'published_private';

const TAB_META: Record<ManagementTab, { label: string; empty: string }> = {
  drafts: {
    label: '초안',
    empty: '작성 중인 초안이 없습니다.',
  },
  published_public: {
    label: '발행됨(공개)',
    empty: '공개 상태의 발행 글이 없습니다.',
  },
  published_private: {
    label: '발행됨(비공개)',
    empty: '비공개 상태의 발행 글이 없습니다.',
  },
};

function buildMineUrl(tab: ManagementTab): string {
  const base = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/mine`;

  const params = new URLSearchParams();

  if (tab === 'drafts') {
    params.set('status', 'draft');
  } else {
    params.set('status', 'published');
    params.set('visibility', tab === 'published_private' ? 'private' : 'public');
  }

  return `${base}?${params.toString()}`;
}

async function fetchMinePosts(tab: ManagementTab): Promise<Post[]> {
  const response = await fetch(buildMineUrl(tab), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch managed posts');
  }

  return response.json();
}

export default function DraftsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const deletePost = useDeletePost();

  const [activeTab, setActiveTab] = useState<ManagementTab>('drafts');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [togglingPostId, setTogglingPostId] = useState<string | null>(null);
  const [exitingPostIds, setExitingPostIds] = useState<Set<string>>(new Set());
  const actionButtonBase =
    'h-8 px-3 text-xs font-medium rounded-md border transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const neutralActionButton =
    'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100';
  const dangerActionButton =
    'border-gray-300 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:border-red-900/70 dark:hover:bg-red-950/30 dark:hover:text-red-300';

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/drafts');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    setExitingPostIds(new Set());
  }, [activeTab]);

  const {
    data: posts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['my-posts', activeTab],
    queryFn: () => fetchMinePosts(activeTab),
    enabled: !!user,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const title = useMemo(() => TAB_META[activeTab].label, [activeTab]);
  const isBlogGloballyPrivate = posts?.[0]?.blog?.isPublic === false;

  const handleDeleteClick = (postId: string) => {
    setDeleteTargetId(postId);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    deletePost.mutate(deleteTargetId, {
      onSuccess: () => {
        toast.success('포스트가 삭제되었습니다.');
        setDeleteTargetId(null);
        queryClient.invalidateQueries({ queryKey: ['my-posts'] });
      },
      onError: () => {
        toast.error('포스트 삭제에 실패했습니다.');
      },
    });
  };

  const handleToggleVisibility = async (post: Post) => {
    if (!post.id || togglingPostId) return;

    const nextVisibility = post.visibility === 'private' ? 'public' : 'private';
    if (post.blog?.isPublic === false && nextVisibility === 'public') return;
    setTogglingPostId(post.id);

    try {
      await postsAPI.updatePostVisibility(post.id, nextVisibility, post.version);
      setExitingPostIds((prev) => new Set(prev).add(post.id));
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await queryClient.invalidateQueries({ queryKey: ['my-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['unified-feed'] });
    } catch (error) {
      console.error('Failed to toggle post visibility:', error);
      setExitingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    } finally {
      setTogglingPostId(null);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
        <h1 className="text-2xl font-bold mb-6">포스트 관리</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
        <h1 className="text-2xl font-bold mb-6">포스트 관리</h1>
        <Card className="p-6 text-center dark:bg-[#131A22]">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 dark:text-red-400">목록을 불러오는 중 오류가 발생했습니다.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">포스트 관리</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {title} {posts?.length ?? 0}개
        </span>
      </div>

      <div className="mb-6 flex gap-2">
        {(Object.keys(TAB_META) as ManagementTab[]).map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={activeTab === tab ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_META[tab].label}
          </Button>
        ))}
      </div>

      {activeTab !== 'drafts' && isBlogGloballyPrivate && (
        <div className="mb-3 inline-flex items-center rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          전체 비공개 중: 개별 공개 불가
        </div>
      )}

      {!posts || posts.length === 0 ? (
        <Card className="p-12 text-center dark:bg-[#131A22]">
          <FileText className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{TAB_META[activeTab].empty}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isPrivate = post.visibility === 'private';
            const canToggleVisibility = activeTab !== 'drafts' && !!post.id;
            const isExiting = exitingPostIds.has(post.id);
            const isPublicTransitionBlocked =
              post.blog?.isPublic === false && isPrivate;

            return (
              <div
                key={post.id}
                className={`transition-all duration-200 ease-out ${
                  isExiting ? 'opacity-0 -translate-y-1 scale-[0.99]' : 'opacity-100 translate-y-0 scale-100'
                }`}
              >
                <Card className="hover:border-gray-400 dark:hover:border-gray-600 transition-colors dark:bg-[#131A22]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold truncate">{post.title || '(제목 없음)'}</h2>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(post.updatedAt), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                          {post.category && (
                            <>
                              <span>•</span>
                              <span>{post.category}</span>
                            </>
                          )}
                          {activeTab !== 'drafts' && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                {isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                                {isPrivate ? '비공개' : '공개'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canToggleVisibility && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleVisibility(post)}
                            disabled={deletePost.isPending || togglingPostId === post.id || isExiting || isPublicTransitionBlocked}
                            className={`${actionButtonBase} ${neutralActionButton} gap-1`}
                            title={
                              isPublicTransitionBlocked
                                ? '전체 비공개 중'
                                : isPrivate
                                  ? '공개로 변경'
                                  : '비공개로 변경'
                            }
                          >
                            {togglingPostId === post.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isPrivate ? (
                              <Globe className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                            {isPrivate ? '공개로 변경' : '비공개로 변경'}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className={`${actionButtonBase} ${dangerActionButton} gap-1`}
                          onClick={() => handleDeleteClick(post.id)}
                          disabled={deletePost.isPending || isExiting}
                          title="포스트 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                          삭제
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/p/${post.id}/edit`)}
                          className={`${actionButtonBase} ${neutralActionButton} gap-1`}
                          title={activeTab === 'drafts' ? '작성 이어가기' : '포스트 수정'}
                          disabled={isExiting}
                        >
                          <Pencil className="h-4 w-4" />
                          {activeTab === 'drafts' ? '이어쓰기' : '수정'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="포스트 삭제"
        description="정말로 이 포스트를 삭제하시겠습니까? 삭제된 포스트는 복구할 수 없습니다."
        confirmText="삭제하기"
        cancelText="취소"
        confirmButtonClassName="!text-red-600 dark:!text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        isLoading={deletePost.isPending}
      />
    </div>
  );
}
