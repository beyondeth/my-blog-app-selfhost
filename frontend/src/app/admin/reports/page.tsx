'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Flag,
  MoreVertical,
  Search,
  RefreshCw,
  FileText,
  MessageSquare,
  User,
  XCircle,
  AlertCircle,
  Info,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { t } from '@/constants/adminTranslations';
import { 
  useAdminReports, 
  useReportStatistics, 
  useUpdateReport, 
  useBatchUpdateReports 
} from '@/hooks/useAdmin';

interface Report {
  id: string;
  type: 'post' | 'comment' | 'user';
  reason: string;
  description?: string;
  targetId: string;
  reportedById: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed' | 'escalated';
  actionTaken?: string;
  moderatorNotes?: string;
  reviewedById?: string;
  reviewedAt?: string;
  priority: number;
  createdAt: string;
  communityId?: string;
  reportedModeratorId?: string;
  metadata?: Record<string, any>;
  actionPayload?: Record<string, any>;
  reportedBy?: {
    id: string;
    username: string;
    email: string;
  };
  post?: {
    id: string;
    title: string;
    authorId: string;
  };
  comment?: {
    id: string;
    content: string;
    authorId: string;
  };
  targetUser?: {
    id: string;
    username: string;
    email: string;
  };
  actionLogs?: ReportActionLog[];
}

interface ReportActionLog {
  id: string;
  action: string;
  status: 'pending' | 'success' | 'failed';
  executorId: string;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  errorMessage?: string | null;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  spam: t.reports.spam,
  hate_speech: t.reports.hateSpeed,
  inappropriate_content: t.reports.inappropriate,
  harassment: t.reports.harassment,
  copyright_violation: t.reports.copyright,
  misinformation: t.reports.misinformation,
  other: t.reports.other,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  under_review: 'bg-primary/10 text-primary',
  resolved: 'bg-secondary text-secondary-foreground',
  dismissed: 'bg-muted/50 text-muted-foreground',
  escalated: 'bg-destructive/10 text-destructive',
};

const STATUS_LABELS: Record<string, string> = {
  pending: t.status.pending,
  under_review: t.status.under_review,
  resolved: t.status.resolved,
  dismissed: t.status.dismissed,
  escalated: t.status.escalated,
};

type PayloadField = {
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
  type?: 'textarea' | 'text';
};

type ActionOption = {
  value: string;
  label: string;
  description: string;
  requiresCommunity?: boolean;
};

const COMMUNITY_ACTIONS = new Set([
  'community_locked',
  'community_unlocked',
  'snapshot_captured',
  'moderator_removed',
]);

const ACTION_PAYLOAD_FIELDS: Record<string, PayloadField[]> = {
  warning_issued: [
    { key: 'message', label: '경고 메시지', placeholder: '사용자에게 전달할 메시지를 입력하세요', type: 'textarea' },
  ],
  content_removed: [
    { key: 'reason', label: '삭제 사유', placeholder: '삭제 사유 (선택)' },
  ],
  user_suspended: [
    { key: 'durationDays', label: '정지 기간(일)', placeholder: '예: 7', helper: '숫자만 입력하세요' },
    { key: 'reason', label: '정지 사유', placeholder: '정지 사유를 입력하세요', type: 'textarea' },
  ],
  user_banned: [
    { key: 'reason', label: '차단 사유', placeholder: '차단 사유를 입력하세요', type: 'textarea' },
  ],
  user_restored: [
    { key: 'reason', label: '해제 사유', placeholder: '정지를 해제하는 이유를 입력하세요', type: 'textarea' },
  ],
  community_locked: [
    { key: 'reason', label: '잠금 사유', placeholder: '예: 폭주 매니저 대응' },
  ],
  community_unlocked: [
    { key: 'reason', label: '해제 사유', placeholder: '예: 조사 완료' },
  ],
  snapshot_captured: [
    { key: 'reason', label: '스냅샷 이름', placeholder: '예: 잠금 직전 상태' },
    { key: 'metadata.note', label: '메모 (선택)', placeholder: '필요한 부가 설명을 입력하세요', type: 'textarea' },
  ],
  moderator_removed: [
    { key: 'reason', label: '제거 사유', placeholder: '예: 권한 남용 확인' },
  ],
};

const ACTION_PAYLOAD_DEFAULTS: Record<string, Record<string, any>> = {
  user_suspended: { durationDays: '7' },
};

function updatePayloadValue(
  payload: Record<string, any> = {},
  key: string,
  value: string,
): Record<string, any> {
  const segments = key.split('.');
  const cloned = { ...payload };
  let current: Record<string, any> = cloned;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value || undefined;
    } else {
      current[segment] = { ...(current[segment] || {}) };
      current = current[segment];
    }
  });
  return cloned;
}

function getPayloadValue(payload: Record<string, any> = {}, key: string) {
  return key
    .split('.')
    .reduce<any>((acc, segment) => (acc ? acc[segment] : undefined), payload) ?? '';
}

const PRIORITY_LABELS: Record<number, { label: string; description: string; color: string }> = {
  5: { label: t.reports.critical, description: t.reports.criticalDesc, color: 'text-red-600 font-bold' },
  4: { label: t.reports.high, description: t.reports.highDesc, color: 'text-orange-600 font-semibold' },
  3: { label: t.reports.medium, description: t.reports.mediumDesc, color: 'text-yellow-600' },
  2: { label: t.reports.low, description: t.reports.lowDesc, color: 'text-blue-600' },
  1: { label: t.reports.info, description: t.reports.infoDesc, color: 'text-gray-600' },
};

const ACTION_OPTIONS: ActionOption[] = [
  { value: 'no_action', label: t.reports.noAction, description: '신고는 확인했으나 별도 조치 불필요' },
  { value: 'warning_issued', label: t.reports.warnUser, description: '사용자에게 경고 메시지 전송' },
  { value: 'content_removed', label: t.reports.removeContent, description: '신고된 게시물/댓글 삭제 처리' },
  { value: 'user_suspended', label: t.reports.suspendUser, description: '일시적으로 사용자 계정 정지 (7일)' },
  { value: 'user_banned', label: t.reports.banUser, description: '영구적으로 사용자 계정 차단' },
  { value: 'user_restored', label: t.reports.restoreUser, description: '정지 또는 차단된 사용자를 즉시 복구' },
  { value: 'community_locked', label: '커뮤니티 잠금', description: '해당 커뮤니티 전체를 잠그고 글/댓글 입력 차단', requiresCommunity: true },
  { value: 'community_unlocked', label: '커뮤니티 잠금 해제', description: '잠금된 커뮤니티를 다시 활성화', requiresCommunity: true },
  { value: 'snapshot_captured', label: '복구 스냅샷 생성', description: '현재 상태를 백업하여 추후 롤백에 대비', requiresCommunity: true },
  { value: 'moderator_removed', label: '운영진 제거', description: '신고된 운영진을 즉시 권한 해제', requiresCommunity: true },
];

const getActionLabel = (value: string) =>
  ACTION_OPTIONS.find((option) => option.value === value)?.label || value;

export default function ReportsManagement() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({
    status: 'resolved',
    actionTaken: 'no_action',
    moderatorNotes: '',
    actionPayload: {} as Record<string, any>,
  });
  const payloadFields = ACTION_PAYLOAD_FIELDS[reviewData.actionTaken] || [];
  const actionRequiresCommunity = COMMUNITY_ACTIONS.has(reviewData.actionTaken);

  const handleActionSelection = (value: string) => {
    const defaults = ACTION_PAYLOAD_DEFAULTS[value] ?? {};
    setReviewData((prev) => ({
      ...prev,
      actionTaken: value,
      actionPayload: { ...defaults },
    }));
  };

  const handlePayloadChange = (key: string, value: string) => {
    setReviewData((prev) => ({
      ...prev,
      actionPayload: updatePayloadValue(prev.actionPayload, key, value),
    }));
  };

  // API Hooks
  const { data: reportsData, isLoading: loading, refetch: refetchReports } = useAdminReports(
    page, 
    20, 
    statusFilter || undefined, 
    typeFilter || undefined
  );
  const { data: statsData, refetch: refetchStats } = useReportStatistics();
  const updateReportMutation = useUpdateReport();
  const batchUpdateMutation = useBatchUpdateReports();

  const reports = reportsData?.reports || [];
  const totalPages = reportsData?.totalPages || 1;
  const total = reportsData?.total || 0;
  
  const stats = statsData || {
    total: 0,
    pending: 0,
    resolved: 0,
    escalated: 0,
  };

  const disableReviewButton =
    !selectedReport ||
    updateReportMutation.isPending ||
    (actionRequiresCommunity && selectedReport && !selectedReport.communityId);
  const missingCommunityContext =
    actionRequiresCommunity && selectedReport && !selectedReport.communityId;

  const actionLogs = selectedReport?.actionLogs ?? [];
  const communitySlug = selectedReport?.metadata?.communitySlug;

  useEffect(() => {
    refetchReports();
    refetchStats();
  }, [page, typeFilter, statusFilter, refetchReports, refetchStats]);

  const handleReviewReport = async () => {
    if (!selectedReport) return;

    updateReportMutation.mutate(
      {
        reportId: selectedReport.id,
        status: reviewData.status,
        actionTaken: reviewData.actionTaken,
        moderatorNotes: reviewData.moderatorNotes,
        actionPayload: Object.keys(reviewData.actionPayload || {}).length ? reviewData.actionPayload : undefined,
      },
      {
        onSuccess: () => {
          setReviewDialog(false);
          setSelectedReport(null);
          setReviewData({
            status: 'resolved',
            actionTaken: 'no_action',
            moderatorNotes: '',
            actionPayload: {},
          });
          refetchReports();
          refetchStats();
        },
      }
    );
  };

  const handleBatchAction = async (action: string) => {
    const selectedIds = reports
      .filter((r: any) => r.status === 'pending')
      .map((r: any) => r.id);

    if (selectedIds.length === 0) {
      toast.error('업데이트할 대기 중인 신고가 없습니다');
      return;
    }

    batchUpdateMutation.mutate(
      {
        reportIds: selectedIds,
        status: action,
        actionTaken: 'no_action',
      },
      {
        onSuccess: () => {
          refetchReports();
          refetchStats();
        },
      }
    );
  };

  const getTargetInfo = (report: Report) => {
    if (report.type === 'post' && report.post) {
      return { 
        type: 'Post', 
        title: report.post.title,
        link: `/posts/${report.targetId}`,
        icon: FileText
      };
    }
    if (report.type === 'comment' && report.comment) {
      return { 
        type: 'Comment', 
        title: report.comment.content.substring(0, 50) + '...',
        link: null,
        icon: MessageSquare
      };
    }
    if (report.type === 'user' && report.targetUser) {
      return { 
        type: 'User', 
        title: report.targetUser.username,
        link: `/users/${report.targetUser.id}`,
        icon: User
      };
    }
    return { 
      type: 'N/A', 
      title: t.reports.targetNotFound,
      link: null,
      icon: XCircle
    };
  };

  const searchTermLower = searchTerm.trim().toLowerCase();
  const filteredReports = reports.filter((report: any) => {
    if (!searchTermLower) {
      return true;
    }

    const descriptionMatch = report.description?.toLowerCase().includes(searchTermLower);
    const reporterMatch = report.reportedBy?.username
      ?.toLowerCase()
      .includes(searchTermLower);
    const targetMatch = getTargetInfo(report).title.toLowerCase().includes(searchTermLower);

    return Boolean(descriptionMatch || reporterMatch || targetMatch);
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.reports.title}</h1>
        <p className="text-gray-600 mt-1">{t.reports.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.reports.totalReports}</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <Flag className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.reports.pending}</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.reports.resolved}</p>
                <p className="text-2xl font-semibold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.reports.escalated}</p>
                <p className="text-2xl font-semibold text-red-600">{stats.escalated}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
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
                  placeholder={t.reports.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter || 'all'} onValueChange={(value) => setTypeFilter(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="유형별 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 유형</SelectItem>
                <SelectItem value="post">{t.reports.post}</SelectItem>
                <SelectItem value="comment">{t.reports.comment}</SelectItem>
                <SelectItem value="user">{t.reports.user}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="상태별 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="pending">{t.status.pending}</SelectItem>
                <SelectItem value="under_review">{t.status.under_review}</SelectItem>
                <SelectItem value="resolved">{t.status.resolved}</SelectItem>
                <SelectItem value="dismissed">{t.status.dismissed}</SelectItem>
                <SelectItem value="escalated">{t.status.escalated}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { refetchReports(); refetchStats(); }} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t.actions.refresh}
            </Button>
          </div>
          {(statusFilter === 'pending' || statusFilter === '') && reports.some((r: any) => r.status === 'pending') && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchAction('dismissed')}
              >
                대기 중인 신고 모두 기각
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchAction('under_review')}
              >
                모두 검토 중으로 표시
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.reports.type}</TableHead>
                <TableHead>{t.reports.target}</TableHead>
                <TableHead>{t.reports.reason}</TableHead>
                <TableHead>{t.reports.reporter}</TableHead>
                <TableHead>{t.reports.status}</TableHead>
                <TableHead>{t.reports.priority}</TableHead>
                <TableHead>{t.reports.date}</TableHead>
                <TableHead className="text-right">{t.reports.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {t.reports.noReportsFound}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report: any) => {
                  const targetInfo = getTargetInfo(report);
                  return (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {report.type === 'post' && <FileText className="h-4 w-4 text-blue-500" />}
                          {report.type === 'comment' && <MessageSquare className="h-4 w-4 text-green-500" />}
                          {report.type === 'user' && <User className="h-4 w-4 text-purple-500" />}
                          <span className="capitalize">{report.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-xs cursor-help">
                                <div className="flex items-center space-x-2">
                                  <targetInfo.icon className="h-4 w-4 text-gray-400" />
                                  <p className="font-medium truncate">{targetInfo.title}</p>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">{targetInfo.type}: {targetInfo.title}</p>
                              {targetInfo.link && (
                                <p className="text-xs text-gray-400">클릭하여 원본 보기</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {REASON_LABELS[report.reason] || report.reason}
                        </Badge>
                        {report.metadata?.communitySlug && (
                          <p className="text-xs text-muted-foreground mt-1">
                            c/{report.metadata.communitySlug}
                          </p>
                        )}
                        {report.metadata?.reportedModeratorUsername && (
                          <p className="text-xs text-muted-foreground">
                            운영진: {report.metadata.reportedModeratorUsername}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{report.reportedBy?.username || 'Unknown'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[report.status]}>
                          {STATUS_LABELS[report.status] || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center cursor-help">
                                {report.priority >= 4 && (
                                  <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                                )}
                                <span className={PRIORITY_LABELS[report.priority]?.color || 'text-gray-600'}>
                                  {report.priority} - {PRIORITY_LABELS[report.priority]?.label || 'Unknown'}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold">우선순위 {report.priority}</p>
                              <p className="text-sm">{PRIORITY_LABELS[report.priority]?.description || '우선순위 정보 없음'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewData({
                              status: report.status === 'pending' ? 'resolved' : report.status,
                              actionTaken: report.actionTaken || 'no_action',
                              moderatorNotes: report.moderatorNotes || '',
                              actionPayload: report.actionPayload || {},
                            });
                            setReviewDialog(true);
                          }}
                        >
                          {t.reports.review}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            {t.pagination.previous}
          </Button>
          <span className="flex items-center px-3 text-sm">
            {t.pagination.page} {page} {t.pagination.of} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            {t.pagination.next}
          </Button>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="w-[90vw] max-w-2xl md:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{t.reports.reviewReport}</DialogTitle>
            <DialogDescription>{t.reports.reviewReport}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">신고 유형</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {selectedReport.type === 'post' && <FileText className="h-4 w-4 text-blue-500" />}
                    {selectedReport.type === 'comment' && <MessageSquare className="h-4 w-4 text-green-500" />}
                    {selectedReport.type === 'user' && <User className="h-4 w-4 text-purple-500" />}
                    <p className="capitalize">{selectedReport.type}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">신고 이유</p>
                  <Badge className="mt-1" variant="outline">
                    {REASON_LABELS[selectedReport.reason] || selectedReport.reason}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">신고자</p>
                  <p>{selectedReport.reportedBy?.username || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">신고 일시</p>
                  <p>{format(new Date(selectedReport.createdAt), 'yyyy년 MM월 dd일 HH:mm')}</p>
                </div>
              </div>
              
              <div className="p-3 bg-muted border border-border rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">신고 대상</p>
                </div>
                <p className="text-sm text-gray-700">
                  {(() => {
                    const targetInfo = getTargetInfo(selectedReport);
                    return `${targetInfo.type}: ${targetInfo.title}`;
                  })()}
                </p>
              </div>

              {communitySlug && (
                <div className="p-3 rounded border border-blue-200 bg-blue-50">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                    <ShieldAlert className="h-4 w-4" />
                    커뮤니티 컨텍스트
                  </div>
                  <p className="text-sm text-blue-900 mt-1">c/{communitySlug}</p>
                  {selectedReport.metadata?.communityName && (
                    <p className="text-xs text-blue-900/80">
                      {selectedReport.metadata.communityName}
                    </p>
                  )}
                </div>
              )}

              {selectedReport.reportedModeratorId && (
                <div className="text-sm text-gray-600">
                  신고된 운영진:{' '}
                  <span className="font-semibold">
                    {selectedReport.metadata?.reportedModeratorUsername || selectedReport.reportedModeratorId}
                  </span>
                </div>
              )}

              {selectedReport.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">상세 내용</p>
                  <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                    {selectedReport.description}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">{t.reports.status}</label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={reviewData.status}
                  onChange={(event) => setReviewData({ ...reviewData, status: event.target.value })}
                >
                  <option value="pending">{t.status.pending}</option>
                  <option value="under_review">{t.status.under_review}</option>
                  <option value="resolved">{t.status.resolved}</option>
                  <option value="dismissed">{t.status.dismissed}</option>
                  <option value="escalated">{t.status.escalated}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">조치 사항</label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={reviewData.actionTaken}
                  onChange={(event) => handleActionSelection(event.target.value)}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ACTION_OPTIONS.find((opt) => opt.value === reviewData.actionTaken)?.description}
                </p>
              </div>

              {missingCommunityContext && (
                <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <ShieldAlert className="h-4 w-4" />
                  <span>커뮤니티 ID가 없는 신고입니다. 해당 조치를 실행하려면 커뮤니티 정보가 필요합니다.</span>
                </div>
              )}

              {payloadFields.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">추가 정보</p>
                  {payloadFields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          rows={3}
                          value={getPayloadValue(reviewData.actionPayload, field.key)}
                          placeholder={field.placeholder}
                          onChange={(event) => handlePayloadChange(field.key, event.target.value)}
                        />
                      ) : (
                        <Input
                          value={getPayloadValue(reviewData.actionPayload, field.key)}
                          placeholder={field.placeholder}
                          onChange={(event) => handlePayloadChange(field.key, event.target.value)}
                        />
                      )}
                      {field.helper && (
                        <p className="text-xs text-muted-foreground">{field.helper}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">{t.reports.moderatorNotes}</label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={reviewData.moderatorNotes}
                  onChange={(e) => setReviewData({ ...reviewData, moderatorNotes: e.target.value })}
                  placeholder="Add notes about your decision..."
                />
              </div>
            </div>
            )}

            {actionLogs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Activity className="h-4 w-4" /> 조치 히스토리
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {actionLogs.map((log) => (
                    <div key={log.id} className="rounded border border-gray-200 p-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{getActionLabel(log.action)}</span>
                        <Badge
                          variant={
                            log.status === 'success'
                              ? 'secondary'
                              : log.status === 'failed'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground break-all">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')} · executor {log.executorId}
                      </p>
                      {(log.payload || log.result) && (
                        <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {JSON.stringify(
                            {
                              payload: log.payload,
                              result: log.result,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      )}
                      {log.errorMessage && (
                        <p className="text-xs text-red-600">Error: {log.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setReviewDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleReviewReport} disabled={disableReviewButton}>
                Update Report
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
