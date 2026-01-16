'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { EditorPickPost, useAdminEditorPicks, useReorderEditorPicks, useToggleEditorPick } from '@/hooks/useEditorPicks';
import { useInfiniteCursorPosts } from '@/hooks/usePosts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, Star, Loader2 } from 'lucide-react';
import type { Post } from '@/types';
import { toast } from 'sonner';

type EditorPickToggleTarget = {
  id: string;
  isEditorPick?: boolean;
};

function EditorPickToggleButton({
  post,
  disabled,
}: {
  post: EditorPickToggleTarget;
  disabled?: boolean;
}) {
  const toggleMutation = useToggleEditorPick(post.id!);
  const isPending = (toggleMutation as { isPending?: boolean }).isPending ?? (toggleMutation as any).isLoading;

  return (
    <Button
      type="button"
      variant={post.isEditorPick ? 'secondary' : 'default'}
      size="sm"
      onClick={() => toggleMutation.mutate()}
      disabled={disabled || isPending}
      className="min-w-[90px]"
    >
      {post.isEditorPick ? '제거' : '추가'}
    </Button>
  );
}

type EditorPickListItem = EditorPickPost | Post;

function EditorPickItem({ post }: { post: EditorPickListItem }) {
  if (!post) return null;
  const postHref = post.blog?.slug
    ? `/${post.blog.slug}/${post.slug || post.id}`
    : '/c';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2A2A2A] dark:bg-[#1F1F1F] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-[#FDFDFD] line-clamp-1">
            {post.title}
          </p>
          {post.blog?.name && (
            <Badge variant="outline" className="text-xs">
              {post.blog.name}
            </Badge>
          )}
          {post.isEditorPick && (
            <Badge className="text-xs">Editor&apos;s Pick</Badge>
          )}
        </div>
        {post.excerpt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '미발행'}</span>
          <span>·</span>
          <span>{post.viewCount ?? 0} views</span>
          <span>·</span>
          <span>{post.isPublished ? '공개' : '비공개'}</span>
        </div>
      </div>
      <Link
        href={postHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        상세 보기
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

export default function EditorPicksAdminPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const {
    data: editorPickData,
    isLoading: isEditorPicksLoading,
    refetch: refetchEditorPicks,
  } = useAdminEditorPicks(10);
  const editorPickPosts = useMemo(() => editorPickData?.posts ?? [], [editorPickData?.posts]);
  const pickLimitReached = editorPickPosts.length >= 5;
  const reorderMutation = useReorderEditorPicks(() => refetchEditorPicks());
  const reorderIsPending =
    (reorderMutation as { isPending?: boolean }).isPending ?? (reorderMutation as any).isLoading;
  const [orderedPickIds, setOrderedPickIds] = useState<string[]>([]);
  const lastSyncedOrderRef = React.useRef<string | null>(null);

  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isSearchLoading,
    refetch: refetchSearch,
  } = useInfiniteCursorPosts({
    search: searchTerm || undefined,
    limit: 10,
    sort: 'recent',
  });

  const searchResults = useMemo(
    () => searchData?.pages.flatMap((page) => page.posts) ?? [],
    [searchData?.pages],
  );

  const editorPickIds = useMemo(
    () => editorPickPosts.map((post) => post.id!),
    [editorPickPosts],
  );

  const orderedPickPosts = useMemo(() => {
    if (orderedPickIds.length === 0) {
      return editorPickPosts;
    }
    const postMap = new Map(editorPickPosts.map((post) => [post.id!, post]));
    const ordered = orderedPickIds
      .map((id) => postMap.get(id))
      .filter((post): post is EditorPickPost => !!post);
    const remaining = editorPickPosts.filter((post) => !orderedPickIds.includes(post.id!));
    return [...ordered, ...remaining];
  }, [editorPickPosts, orderedPickIds]);

  const hasOrderChanges = useMemo(() => {
    const currentOrder = orderedPickPosts.map((post) => post.id!);
    const serverOrder = editorPickPosts.map((post) => post.id!);
    if (currentOrder.length !== serverOrder.length) {
      return true;
    }
    return currentOrder.some((id, index) => id !== serverOrder[index]);
  }, [editorPickPosts, orderedPickPosts]);

  React.useEffect(() => {
    const serialized = editorPickIds.join('|');
    if (lastSyncedOrderRef.current === serialized) {
      return;
    }
    lastSyncedOrderRef.current = serialized;
    setOrderedPickIds(editorPickIds);
  }, [editorPickIds]);

  const movePick = (index: number, direction: -1 | 1) => {
    setOrderedPickIds((prev) => {
      const currentOrder = prev.length > 0 ? prev : orderedPickPosts.map((post) => post.id!);
      if (currentOrder.length === 0) {
        return prev;
      }
      const next = [...currentOrder];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  React.useEffect(() => {
    if (reorderMutation.isSuccess) {
      toast.success('Editor’s Pick 순서를 저장했습니다.');
    }
  }, [reorderMutation.isSuccess]);

  React.useEffect(() => {
    if (reorderMutation.isError) {
      const error = reorderMutation.error as Error;
      toast.error(error?.message || 'Editor’s Pick 순서 저장에 실패했습니다.');
    }
  }, [reorderMutation.isError, reorderMutation.error]);

  const handleSaveOrder = () => {
    const orderedIds = orderedPickPosts
      .map((post) => post.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 5);

    if (orderedIds.length === 0) {
      toast.error('저장할 Editor’s Pick이 없습니다.');
      return;
    }
    reorderMutation.mutate(orderedIds);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-[#FDFDFD]">Editor&apos;s Picks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            커뮤니티 시그널에 노출될 포스트를 최대 5개까지 관리합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            refetchEditorPicks();
            refetchSearch();
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">현재 Editor&apos;s Picks</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">{editorPickPosts.length}/5 선택됨</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveOrder}
              disabled={!hasOrderChanges || orderedPickPosts.length === 0 || reorderIsPending}
              className="gap-2"
            >
              {reorderIsPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '순서 저장'
              )}
            </Button>
            <Star className="h-5 w-5 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditorPicksLoading ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 dark:border-[#2A2A2A] dark:text-gray-500">
              로딩 중...
            </div>
          ) : editorPickPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 dark:border-[#2A2A2A] dark:text-gray-500">
              아직 등록된 Editor&apos;s Pick이 없습니다.
            </div>
          ) : (
            orderedPickPosts.map((post, index) => (
              <div key={post.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2A2A2A] dark:bg-[#1F1F1F]">
                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#FDFDFD] line-clamp-1">
                    {post?.title}
                  </p>
                  {post?.excerpt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[520px]">
                      {post.excerpt}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 w-[190px] justify-end">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => movePick(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => movePick(index, 1)}
                      disabled={index === orderedPickPosts.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  {post && post.id && (
                    <EditorPickToggleButton 
                        post={{ 
                            ...post, 
                            id: post.id!,
                            isEditorPick: post.isEditorPick ?? true 
                        }} 
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">포스트 검색</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="제목, 요약으로 검색하세요"
                className="pl-9"
              />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {pickLimitReached ? '최대 5개까지 선택됨' : `남은 슬롯 ${5 - editorPickPosts.length}개`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSearchLoading ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 dark:border-[#2A2A2A] dark:text-gray-500">
              검색 결과 불러오는 중...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 dark:border-[#2A2A2A] dark:text-gray-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            searchResults.map((post) => (
              <div key={post.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <EditorPickItem post={post} />
                  <EditorPickToggleButton
                    post={{
                        ...post,
                        id: post.id!,
                        isEditorPick: post.isEditorPick ?? false,
                    }}
                    disabled={pickLimitReached && !post.isEditorPick}
                  />
              </div>
            ))
          )}
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
