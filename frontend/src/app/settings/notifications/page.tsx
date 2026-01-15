'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { Switch } from '@/components/ui/switch';
import { FiBell, FiMail, FiSmartphone, FiMessageSquare, FiHeart, FiUserPlus, FiTrendingUp, FiDollarSign, FiAlertCircle, FiCalendar } from 'react-icons/fi';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';

interface NotificationSettings {
  email: {
    comments: boolean;
    likes: boolean;
    follows: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
    marketing: boolean;
  };
  push: {
    comments: boolean;
    likes: boolean;
    follows: boolean;
  };
}

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      comments: true,
      likes: true,
      follows: true,
      weeklyReport: false,
      monthlyReport: true,
      marketing: false,
    },
    push: {
      comments: true,
      likes: false,
      follows: true,
    },
  });

  type NotificationToggleRowProps = {
    icon: ComponentType<{ className?: string }>;
    label: string;
    description?: string;
    checked: boolean;
    onToggle: (value: boolean) => void;
  };

  const NotificationToggleRow = ({ icon: Icon, label, description, checked, onToggle }: NotificationToggleRowProps) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-gray-100 dark:bg-[#1F2229] p-2">
          <Icon className="h-4 w-4 text-gray-500 dark:text-gray-300 dark:text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
          {description && <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} aria-label={`${label} 설정`} />
    </div>
  );

  const handleToggle = (type: 'email' | 'push', setting: string, value?: boolean) => {
    setSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [setting]: value !== undefined ? value : !(prev[type] as any)[setting],
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // TODO: Implement notification settings API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300`}>
          로그인이 필요합니다
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300">
            <FiBell className="h-4 w-4" />
            <span>알림 제어</span>
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-[#1F2229] px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
              Beta
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-1">알림 설정</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">받고 싶은 알림만 선택해 집중력을 유지하세요.</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`${SETTINGS_PRIMARY_BUTTON_CLASS} whitespace-nowrap`}
        >
          {loading ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={`${SETTINGS_CARD_CLASS} p-5 sm:p-6 space-y-6`}>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300">
              <FiMail className="h-4 w-4" />
              이메일 알림
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-1">활동 및 리포트</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">주요 활동과 리포트를 이메일로 받아보세요.</p>
          </div>

          <div className="space-y-5">
            <NotificationToggleRow
              icon={FiMessageSquare}
              label="새 댓글"
              description="내 글에 댓글이 달리면 알려드려요"
              checked={settings.email.comments}
              onToggle={(value) => handleToggle('email', 'comments', value)}
            />
            <NotificationToggleRow
              icon={FiHeart}
              label="좋아요"
              description="누군가 내 글을 좋아요하면 알려드려요"
              checked={settings.email.likes}
              onToggle={(value) => handleToggle('email', 'likes', value)}
            />
            <NotificationToggleRow
              icon={FiUserPlus}
              label="새 팔로워"
              description="새로운 팔로워가 생기면 알려드려요"
              checked={settings.email.follows}
              onToggle={(value) => handleToggle('email', 'follows', value)}
            />
          </div>

          <div className="space-y-5 border-t border-gray-100 dark:border-[#2F3440] pt-5">
            <NotificationToggleRow
              icon={FiTrendingUp}
              label="주간 리포트"
              description="한 주간의 주요 지표와 트렌드 요약"
              checked={settings.email.weeklyReport}
              onToggle={(value) => handleToggle('email', 'weeklyReport', value)}
            />
            <NotificationToggleRow
              icon={FiCalendar}
              label="월간 리포트"
              description="월간 성장율과 핵심 지표 리포트"
              checked={settings.email.monthlyReport}
              onToggle={(value) => handleToggle('email', 'monthlyReport', value)}
            />
            <NotificationToggleRow
              icon={FiDollarSign}
              label="제품 업데이트 및 프로모션"
              description="신규 기능과 이벤트 소식을 받아보세요"
              checked={settings.email.marketing}
              onToggle={(value) => handleToggle('email', 'marketing', value)}
            />
          </div>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} p-5 sm:p-6 space-y-6`}>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300">
              <FiSmartphone className="h-4 w-4" />
              푸시 알림
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-1">실시간 알림</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">브라우저와 모바일에서 즉시 알림을 받아보세요.</p>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1B1F27] p-4 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 flex gap-3">
            <FiAlertCircle className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-300 flex-shrink-0 mt-0.5" />
            <div>
              <p>푸시 알림은 브라우저 알림 권한이 필요합니다.</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300 mt-1">브라우저 설정 &gt; 알림에서 허용으로 변경해주세요.</p>
            </div>
          </div>

          <div className="space-y-5">
            <NotificationToggleRow
              icon={FiMessageSquare}
              label="새 댓글"
              description="새 메시지를 바로 확인하세요"
              checked={settings.push.comments}
              onToggle={(value) => handleToggle('push', 'comments', value)}
            />
            <NotificationToggleRow
              icon={FiHeart}
              label="좋아요"
              description="실시간 반응을 놓치지 마세요"
              checked={settings.push.likes}
              onToggle={(value) => handleToggle('push', 'likes', value)}
            />
            <NotificationToggleRow
              icon={FiUserPlus}
              label="새 팔로워"
              description="새로운 연결이 생기면 알려드립니다"
              checked={settings.push.follows}
              onToggle={(value) => handleToggle('push', 'follows', value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${DESTRUCTIVE_SURFACE_CLASS}`}>
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          알림 설정이 성공적으로 업데이트되었습니다!
        </div>
      )}
    </div>
  );
}
