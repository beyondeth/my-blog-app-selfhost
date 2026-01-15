'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDrafts, useDeletePost } from '@/hooks/usePosts';
import { useAuth } from '@/providers/AuthProviderV2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Pencil, Clock, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function DraftsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: drafts, isLoading, isError, error } = useDrafts();
  const deletePost = useDeletePost();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/drafts');
    }
  }, [user, isAuthLoading, router]);

  const handleDeleteClick = (postId: string) => {
    setDeleteTargetId(postId);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      deletePost.mutate(deleteTargetId, {
        onSuccess: () => {
          toast.success('초안이 삭제되었습니다.');
          setDeleteTargetId(null);
        },
        onError: () => {
          toast.error('초안 삭제에 실패했습니다.');
        }
      });
    }
  };

  // 로딩 상태
  if (isAuthLoading || isLoading) {
    return (
      <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
        <h1 className="text-2xl font-bold mb-6">내 초안</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">초안을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
        <h1 className="text-2xl font-bold mb-6">내 초안</h1>
        <Card className="p-6 text-center dark:bg-[#131A22]">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 dark:text-red-400">
            초안을 불러오는 중 오류가 발생했습니다.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </Card>
      </div>
    );
  }

  // 빈 목록
  if (!drafts || drafts.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
        <h1 className="text-2xl font-bold mb-6">내 초안</h1>
        <Card className="p-12 text-center dark:bg-[#131A22]">
          <FileText className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            작성 중인 초안이 없습니다.
          </p>
        </Card>

        {/* 빈 목록일 때도 ConfirmDialog 등은 렌더링될 수 있게 위치를 조정하거나 
            여기서는 렌더링할 필요 없으니 그냥 두고,
            return 전에 Dialog를 배치하는 구조로 변경해야 함.
            하지만 여기서는 early return이므로 Dialog 렌더링 불필요.
        */}
      </div>
    );
  }

  // 초안 목록
  return (
    <div className="container max-w-4xl mx-auto pt-24 pb-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">내 초안</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {drafts.length}개의 초안
        </span>
      </div>

      <div className="space-y-4">
        {drafts.map((draft) => (
          <Card 
            key={draft.id} 
            className="hover:border-gray-400 dark:hover:border-gray-600 transition-colors dark:bg-[#131A22]"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {draft.title || '(제목 없음)'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNow(new Date(draft.updatedAt), { 
                        addSuffix: true, 
                        locale: ko 
                      })}
                    </span>
                    {draft.category && (
                      <>
                        <span>•</span>
                        <span>{draft.category}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 gap-1"
                    onClick={() => handleDeleteClick(draft.id)}
                    disabled={deletePost.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    삭제
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => router.push(`/p/${draft.id}/edit`)}
                    className="gap-1"
                  >
                    <Pencil className="h-4 w-4" />
                    이어쓰기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog 
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="초안 삭제"
        description="정말로 이 초안을 삭제하시겠습니까? 삭제된 초안은 복구할 수 없습니다."
        confirmText="삭제하기"
        cancelText="취소"
        confirmButtonClassName="!text-red-600 dark:!text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        isLoading={deletePost.isPending}
      />
    </div>
  );
}
