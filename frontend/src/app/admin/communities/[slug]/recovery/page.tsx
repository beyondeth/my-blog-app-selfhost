'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock, Camera, History, Loader2 } from 'lucide-react';
import { communityService } from '@/services/api/community.service';
import { communityQueryKeys } from '@/hooks/community/useCommunities';
import type { Community, CommunityRecoverySnapshot } from '@/types/community';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import CommunityLockBanner from '@/components/community/CommunityLockBanner';

interface AdminRecoveryPageProps {
  params: Promise<{ slug: string }>;
}

export default function AdminCommunityRecoveryPage({ params }: AdminRecoveryPageProps) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [lockReason, setLockReason] = useState('폭주 매니저 대응');
  const [unlockReason, setUnlockReason] = useState('점검 완료');
  const [snapshotReason, setSnapshotReason] = useState('수동 스냅샷');
  const [snapshotNote, setSnapshotNote] = useState('');

  const { data: community, isLoading: isCommunityLoading } = useQuery<Community>({
    queryKey: ['admin-community', slug],
    queryFn: () => communityService.getCommunity(slug),
    enabled: !!slug,
  });

  const { data: snapshots, isLoading: isSnapshotsLoading, refetch: refetchSnapshots } = useQuery<CommunityRecoverySnapshot[]>({
    queryKey: ['admin-community', slug, 'recovery-snapshots'],
    queryFn: () => communityService.getCommunityRecoverySnapshots(community!.id, 20),
    enabled: !!community,
  });

  const invalidateCommunityCaches = () => {
    queryClient.invalidateQueries({ queryKey: communityQueryKeys.detail(slug) });
    queryClient.invalidateQueries({ queryKey: ['admin-community', slug] });
  };

  const lockMutation = useMutation({
    mutationFn: () => communityService.lockCommunityAdmin(community!.id, { reason: lockReason || undefined }),
    onSuccess: () => {
      toast.success('커뮤니티가 잠금되었습니다.');
      invalidateCommunityCaches();
    },
    onError: (error: any) => toast.error(error.message || '잠금 처리에 실패했습니다.'),
  });

  const unlockMutation = useMutation({
    mutationFn: () => communityService.unlockCommunityAdmin(community!.id, { reason: unlockReason || undefined }),
    onSuccess: () => {
      toast.success('잠금이 해제되었습니다.');
      invalidateCommunityCaches();
    },
    onError: (error: any) => toast.error(error.message || '잠금 해제에 실패했습니다.'),
  });

  const snapshotMutation = useMutation({
    mutationFn: () =>
      communityService.captureCommunityRecoverySnapshot(community!.id, {
        reason: snapshotReason,
        metadata: snapshotNote ? { note: snapshotNote } : undefined,
      }),
    onSuccess: () => {
      toast.success('스냅샷이 생성되었습니다.');
      refetchSnapshots();
    },
    onError: (error: any) => toast.error(error.message || '스냅샷 생성에 실패했습니다.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (snapshotId: string) => communityService.restoreCommunitySnapshot(snapshotId),
    onSuccess: () => {
      toast.success('스냅샷 기준으로 복구되었습니다.');
      invalidateCommunityCaches();
      refetchSnapshots();
    },
    onError: (error: any) => toast.error(error.message || '복구에 실패했습니다.'),
  });

  if (isCommunityLoading || !community) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">커뮤니티 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  const handleRestoreClick = (snapshotId: string) => {
    if (window.confirm('선택한 스냅샷으로 롤백하시겠습니까? 현재 상태가 모두 덮어씌워집니다.')) {
      restoreMutation.mutate(snapshotId);
    }
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <CommunityLockBanner
        isLocked={community.isLocked}
        lockedAt={community.lockedAt}
        lockedBy={community.lockedBy}
        communitySlug={slug}
        showAdminLink
        adminHref={`/admin/communities/${slug}/recovery`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              커뮤니티 잠금
            </CardTitle>
            <CardDescription>커뮤니티 전체를 즉시 잠그고 모든 작성 기능을 차단합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lockReason">잠금 사유</Label>
              <Input
                id="lockReason"
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                placeholder="예: Top-Mod 폭주 감지"
              />
            </div>
            <Button onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending} className="inline-flex items-center gap-2">
              {lockMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              커뮤니티 잠금
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Unlock className="h-4 w-4" />
              잠금 해제
            </CardTitle>
            <CardDescription>이상 상황이 종료되면 커뮤니티를 다시 활성화합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlockReason">해제 메모</Label>
              <Input
                id="unlockReason"
                value={unlockReason}
                onChange={(event) => setUnlockReason(event.target.value)}
                placeholder="예: 조사 완료 / 정상화"
              />
            </div>
            <Button variant="outline" onClick={() => unlockMutation.mutate()} disabled={unlockMutation.isPending} className="inline-flex items-center gap-2">
              {unlockMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              잠금 해제
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            스냅샷 관리
          </CardTitle>
          <CardDescription>게시물/댓글/설정 상태를 보관하여 빠르게 롤백할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="snapshotReason">스냅샷 이름</Label>
              <Input
                id="snapshotReason"
                value={snapshotReason}
                onChange={(event) => setSnapshotReason(event.target.value)}
                placeholder="예: 잠금 직전 상태"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshotNote">메모 (선택)</Label>
              <Textarea
                id="snapshotNote"
                value={snapshotNote}
                onChange={(event) => setSnapshotNote(event.target.value)}
                rows={2}
              />
            </div>
          </div>
          <Button onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending} className="inline-flex items-center gap-2">
            {snapshotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            스냅샷 생성
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            최근 스냅샷
          </CardTitle>
          <CardDescription>최근 생성된 스냅샷을 확인하고 필요한 경우 즉시 롤백할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {isSnapshotsLoading && <p className="text-sm text-muted-foreground">스냅샷 목록을 불러오는 중입니다...</p>}
          {!isSnapshotsLoading && (!snapshots || snapshots.length === 0) && (
            <p className="text-sm text-muted-foreground">아직 생성된 스냅샷이 없습니다.</p>
          )}
          <div className="space-y-4">
            {snapshots?.map((snapshot) => (
              <div key={snapshot.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{snapshot.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(snapshot.createdAt).toLocaleString('ko-KR')} · {snapshot.postsSnapshot.length} posts · {snapshot.commentsSnapshot.length} comments
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRestoreClick(snapshot.id)} disabled={restoreMutation.isPending}>
                    {restoreMutation.isPending ? '복구 중...' : '이 스냅샷으로 복구'}
                  </Button>
                </div>
                {snapshot.metadata?.note && (
                  <p className="mt-2 text-xs text-muted-foreground">메모: {snapshot.metadata.note}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
