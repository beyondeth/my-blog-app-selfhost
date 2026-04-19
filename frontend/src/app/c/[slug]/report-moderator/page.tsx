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
  { value: 'harassment', label: 'Abuse of power / harassment' },
  { value: 'inappropriate_content', label: 'Ignoring rule violations' },
  { value: 'spam', label: 'Spam / forced promotion' },
  { value: 'hate_speech', label: 'Hate speech / discrimination' },
  { value: 'other', label: 'Other' },
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
      toast.error('Choose a moderator to report.');
      return;
    }
    if (!isAuthenticated) {
      toast.error('Sign in to submit a report.');
      router.push(`/login?redirect=${encodeURIComponent(`/c/${slug}/report-moderator`)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const reportedModerator = moderators?.find((m) => m.userId === selectedModerator);
      const descriptionLines = [
        `Community: c/${community.slug}`,
        `Reported moderator: ${reportedModerator?.user?.username ?? 'Unknown user'} (${selectedModerator})`,
        details.trim() ? `Details: ${details.trim()}` : null,
        evidenceUrl.trim() ? `Evidence link: ${evidenceUrl.trim()}` : null,
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
        throw new Error(error.message || 'Failed to submit the report.');
      }

      toast.success('Your report has been submitted. Our team will review it.');
      setDetails('');
      setEvidenceUrl('');
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong while submitting the report.');
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
                Report a moderator / request recovery
              </CardTitle>
              <CardDescription>
                Use this form for urgent moderation issues. Reports go directly to the site admin team, so please include factual details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isAuthenticated && (
                <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  You need to <Link href={`/login?redirect=${encodeURIComponent(`/c/${slug}/report-moderator`)}`} className="font-semibold text-blue-600">sign in</Link> before you can submit a report.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="moderator">Moderator to report</Label>
                  <Select value={selectedModerator} onValueChange={setSelectedModerator} disabled={!moderators?.length}>
                    <SelectTrigger id="moderator">
                      <SelectValue placeholder={moderators?.length ? 'Select a moderator' : 'Loading moderators'} />
                    </SelectTrigger>
                    <SelectContent>
                      {moderators?.map((mod) => (
                        <SelectItem key={mod.userId} value={mod.userId}>
                          {mod.user?.username || mod.userId}
                          {mod.role === 'owner' ? ' · Owner' : mod.role === 'admin' ? ' · Admin' : ' · Moderator'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
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
                  <Label htmlFor="details">Details</Label>
                  <Textarea
                    id="details"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Describe what happened and why this needs admin attention."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evidence">Evidence link (optional)</Label>
                  <Input
                    id="evidence"
                    type="url"
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                    placeholder="Screenshot, archive, or supporting record"
                  />
                </div>

                <Button type="submit" disabled={!isAuthenticated || isSubmitting || !moderators?.length} className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Submit report
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
                Before you submit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Use this form if a moderator is abusing permissions, has locked the community, or a recovery request is needed.</p>
              <p>Include concrete actions, dates, screenshots, and anything else that helps us review the incident quickly.</p>
            </CardContent>
          </Card>
          <CommunitySidebar community={community} showJoinButton={false} />
        </aside>
      </div>
    </div>
  );
}
