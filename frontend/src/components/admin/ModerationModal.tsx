import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { defaultApiClient as api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { FiAlertTriangle, FiUserX, FiShieldOff, FiInfo } from 'react-icons/fi';

interface ModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment';
  targetId: string;
}

interface ModerationContext {
  userId: string;
  username: string;
  email: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  title?: string;
  content?: string;
  userCreatedAt: string;
  ipAddressFull?: string; // Add full IP field for blocking action
}

export default function ModerationModal({ isOpen, onClose, targetType, targetId }: ModerationModalProps) {
  const { user } = useAuth();
  const [context, setContext] = useState<ModerationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState(''); // Admin internal memo
  const [action, setAction] = useState<'BAN_USER' | 'BLOCK_IP' | 'WARN'>('WARN');
  const [suspendDuration, setSuspendDuration] = useState<string>('permanent'); // permanent, 1, 3, 7, 30, 90

  const fetchContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<ModerationContext>(`/moderation/context/${targetType}/${targetId}`);
      setContext(data);
    } catch (error) {
      console.error('Failed to fetch moderation context', error);
      toast.error('정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    if (isOpen && targetId) {
      void fetchContext();
    }
  }, [fetchContext, isOpen, targetId]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return toast.error('사유를 입력해주세요.');
    }

    try {
      if (action === 'BAN_USER') {
        if (suspendDuration === 'permanent') {
          await api.post('/moderation/ban-user', {
            userId: context?.userId,
            reason,
            memo,
            evidence: { targetType, targetId, content: context?.content }
          });
          toast.success(`유저(${context?.username})를 영구 정지했습니다.`);
        } else {
          // 일시 정지 (Suspension)
          const durationDays = parseInt(suspendDuration);
          await api.post('/moderation/suspend-user', {
            userId: context?.userId,
            durationDays,
            reason,
            memo,
          });
          toast.success(`유저(${context?.username})를 ${durationDays}일간 정지했습니다.`);
        }
      } else if (action === 'BLOCK_IP') {
        const targetIp = context?.ipAddressFull;
        if (!targetIp) {
            return toast.error('차단할 IP 정보가 없습니다 (구버전 게시물)');
        }
        await api.post('/moderation/block-ip', {
          ip: targetIp, // Use full IP
          userId: context?.userId,
          reason,
          memo,
        });
        toast.success(`IP(${context?.ipAddress})를 차단했습니다.`);
      } 
      // WARN is not yet implemented in backend, simple toast for now
      else if (action === 'WARN') {
         toast('경고 기능은 준비중입니다.', { icon: '🚧' });
      }

      onClose();
    } catch (error: any) {
      console.error('Moderation action failed', error);
      const errorMessage = error.response?.data?.message || '제재 처리에 실패했습니다.';
      toast.error(errorMessage);
    }
  };

  // Logic for disable button
  const isActionDisabled = isLoading || !context || (action === 'BLOCK_IP' && !context?.ipAddressFull);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-red-600">
            <FiShieldOff />
            관리자 제재 (Moderation)
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left: User & Context Info */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4 text-sm">
            <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
              <FiInfo /> 대상 정보
            </h3>
            
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : context ? (
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 block text-xs">Username</span>
                  <span className="font-medium text-base">{context.username}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">User ID</span>
                  <code className="text-xs bg-gray-200 px-1 rounded">{context.userId}</code>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Email</span>
                  <span>{context.email}</span>
                </div>
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <span className="text-yellow-700 block text-xs font-bold">IP Address</span>
                  <span className="font-mono text-red-600 font-bold">{context.ipAddress || 'Not Captured'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Target Content</span>
                  <p className="text-gray-700 truncate">{context.title || context.content?.substring(0, 50)}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">정보를 불러올 수 없습니다.</p>
            )}
          </div>

          {/* Right: Action Form */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">조치 유형</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAction('WARN')}
                  className={`p-2 rounded border text-sm font-medium transition-colors ${
                    action === 'WARN' 
                      ? 'bg-yellow-100 border-yellow-400 text-yellow-800' 
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <FiAlertTriangle className="mx-auto mb-1" />
                  경고
                </button>
                <button
                  onClick={() => setAction('BAN_USER')}
                  className={`p-2 rounded border text-sm font-medium transition-colors ${
                    action === 'BAN_USER' 
                      ? 'bg-red-100 border-red-400 text-red-800' 
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <FiUserX className="mx-auto mb-1" />
                  계정 정지
                </button>
                <button
                  onClick={() => setAction('BLOCK_IP')}
                  className={`p-2 rounded border text-sm font-medium transition-colors ${
                    action === 'BLOCK_IP' 
                      ? 'bg-gray-800 border-black text-white' 
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <FiShieldOff className="mx-auto mb-1" />
                  IP 차단
                </button>
              </div>
            </div>

            {/* Duration Selector for BAN_USER */}
            {action === 'BAN_USER' && (
              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">정지 기간 설정</label>
                <div className="relative">
                  <select
                    value={suspendDuration}
                    onChange={(e) => setSuspendDuration(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-white dark:bg-gray-950"
                  >
                    <option value="permanent">영구 정지 (Permanent)</option>
                    <option value="1">1일 (24시간)</option>
                    <option value="3">3일</option>
                    <option value="7">7일</option>
                    <option value="30">30일 (1개월)</option>
                    <option value="90">90일 (3개월)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">
                제재 사유 (유저에게 표시됨) <span className="text-red-500">*</span>
              </label>
              <Textarea 
                placeholder="예: 운영정책 위반 (도배 및 스팸)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-20"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block text-gray-500">
                관리자 메모 (내부용)
              </label>
              <Textarea 
                placeholder="예: 동일 IP 다중 계정 의심됨"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="h-20 bg-yellow-50/50"
              />
            </div>

            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={isActionDisabled}
            >
             {action === 'WARN' ? '경고 발송' : action === 'BAN_USER' ? '계정 정지 실행' : 'IP 차단 실행'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
