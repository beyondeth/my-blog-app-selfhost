'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Send, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCommunity } from '@/hooks/community';
import { communityQueryKeys } from '@/hooks/community/useCommunities';
import { getCommunityModerators } from '@/services/api/community.service';
import CommunityHeader from '@/components/community/CommunityHeader';
import CommunitySidebar from '@/components/community/CommunitySidebar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { CommunityMember } from '@/types/community';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const MOD_REPORT_REASONS = [
  { value: 'harassment', label: '권한 남용 / 괴롭힘' },
  { value: 'inappropriate_content', label: '규칙 위반 묵인' },
  { value: 'spam', label: '스팸 / 홍보 강요' },
  { value: 'hate_speech', label: '혐오/차별 발언' },
  { value: 'other', label: '기타' },
] as const;

interface ReportModeratorPageProps {
  params: Promise<{ slug: string }>;
}

export default function ReportModeratorPage({ params }: ReportModeratorPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { data: community, isLoading, isError } = useCommunity(slug);
  const { data: moderators } = useQuery<CommunityMember[]>({
    queryKey: [...communityQueryKeys.detail(slug), 'moderators'],
    queryFn: () => getCommunityModerators(slug),
    enabled: !!slug,
  });

  const [selectedModerator, setSelectedModerator] = useState('');
  const [reason, setReason] = useState<(typeof MOD_REPORT_REASONS)[number]['value']>('harassment');
  const [details, setDetails] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading || !community) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="h-48 bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedModerator) {
      toast.error('신고할 매니저를 선택해주세요.');
      return;
    }
    if (!isAuthenticated) {
      toast.error('신고하려면 로그인해주세요.');
      router.push(`/login?redirect=${encodeURIComponent(`/c/${slug}/report-moderator`)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const reportedModerator = moderators?.find((m) => m.userId === selectedModerator);
      const descriptionLines = [
        `커뮤니티: c/${community.slug}`,
        `신고 대상: ${reportedModerator?.user?.username ?? '알 수 없음'} (${selectedModerator})`,
        details.trim() ? `사유 상세: ${details.trim()}` : null,
        evidenceUrl.trim() ? `증빙 링크: ${evidenceUrl.trim()}` : null,
      ].filter(Boolean);

      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'user',
          targetId: selectedModerator,
          reason,
          description: descriptionLines.join('\n'),
          communityId: community.id,
          reportedModeratorId: selectedModerator,
          metadata: {
            communitySlug: community.slug,
            communityName: community.name,
            reportedModeratorUsername: reportedModerator?.user?.username,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || '신고 접수에 실패했습니다.');
      }

      toast.success('신고가 접수되었습니다. 운영팀이 확인 후 조치할 예정입니다.');
      setDetails('');
      setEvidenceUrl('');
    } catch (error: any) {
      toast.error(error.message || '신고 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <CommunityHeader community={community} />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                매니저 신고 / 복구 요청
              </CardTitle>
              <CardDescription>
                폭주하거나 잠적한 매니저를 신고하면 사이트 Admin에게 바로 전달됩니다. 꼭 사실에 근거한 정보를 제공해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isAuthenticated && (
                <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  신고 기능을 이용하려면 <Link href={`/login?redirect=${encodeURIComponent(`/c/${slug}/report-moderator`)}`} className="font-semibold text-blue-600">로그인</Link>이 필요합니다.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="moderator">신고 대상 매니저</Label>
                  <Select value={selectedModerator} onValueChange={setSelectedModerator} disabled={!moderators?.length}>
                    <SelectTrigger id="moderator">
                      <SelectValue placeholder={moderators?.length ? '매니저를 선택하세요' : '매니저 정보를 불러오는 중'} />
                    </SelectTrigger>
                    <SelectContent>
                      {moderators?.map((mod) => (
                        <SelectItem key={mod.userId} value={mod.userId}>
                          {mod.user?.username || mod.userId}
                          {mod.role === 'owner' ? ' · 오너' : mod.role === 'admin' ? ' · 관리자' : ' · 매니저'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">신고 사유</Label>
                  <Select value={reason} onValueChange={(value) => setReason(value as typeof reason)}>
                    <SelectTrigger id="reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOD_REPORT_REASONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">상세 설명</Label>
                  <Textarea
                    id="details"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="어떤 문제가 있었는지 구체적으로 작성해주세요."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evidence">증빙 링크 (선택)</Label>
                  <Input
                    id="evidence"
                    type="url"
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                    placeholder="스크린샷 또는 기록 링크"
                  />
                </div>

                <Button type="submit" disabled={!isAuthenticated || isSubmitting || !moderators?.length} className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  신고 접수
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>

        <aside className="w-full lg:w-80 flex-shrink-0">
          <Card className="mb-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4" />
                매니저 신고 시 참고 사항
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>매니저가 폭주하여 커뮤니티를 삭제하거나 잠금 상태를 유지할 경우 이 폼을 사용해 사이트 Admin에게 직접 도움을 요청할 수 있습니다.</p>
              <p>가능하면 어떤 조치(삭제, 밴, 규칙 변경 등)가 있었는지, 언제 발생했는지 구체적으로 적어주세요.</p>
            </CardContent>
          </Card>
          <CommunitySidebar community={community} showJoinButton={false} />
        </aside>
      </div>
    </div>
  );
}
