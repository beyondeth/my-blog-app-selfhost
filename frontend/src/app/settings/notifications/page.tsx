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
      <Switch checked={checked} onCheckedChange={onToggle} aria-label={`${label} setting`} />
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
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <div className={`${SETTINGS_CARD_CLASS} p-6 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300`}>
          Please sign in to continue.
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
            <span>Notification controls</span>
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-[#1F2229] px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
              Beta
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-1">Notifications</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Only keep the alerts you want to receive.</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`${SETTINGS_PRIMARY_BUTTON_CLASS} whitespace-nowrap`}
        >
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={`${SETTINGS_CARD_CLASS} p-5 sm:p-6 space-y-6`}>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300">
              <FiMail className="h-4 w-4" />
              Email notifications
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-1">Activity and reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Receive important activity updates and reports by email.</p>
          </div>

          <div className="space-y-5">
            <NotificationToggleRow
              icon={FiMessageSquare}
              label="New comments"
              description="Get notified when someone comments on your posts."
              checked={settings.email.comments}
              onToggle={(value) => handleToggle('email', 'comments', value)}
            />
            <NotificationToggleRow
              icon={FiHeart}
              label="Likes"
              description="Get notified when someone likes your posts."
              checked={settings.email.likes}
              onToggle={(value) => handleToggle('email', 'likes', value)}
            />
            <NotificationToggleRow
              icon={FiUserPlus}
              label="New followers"
              description="Get notified when someone new follows you."
              checked={settings.email.follows}
              onToggle={(value) => handleToggle('email', 'follows', value)}
            />
          </div>

          <div className="space-y-5 border-t border-gray-100 dark:border-[#2F3440] pt-5">
            <NotificationToggleRow
              icon={FiTrendingUp}
              label="Weekly report"
              description="A weekly summary of key metrics and trends."
              checked={settings.email.weeklyReport}
              onToggle={(value) => handleToggle('email', 'weeklyReport', value)}
            />
            <NotificationToggleRow
              icon={FiCalendar}
              label="Monthly report"
              description="A monthly report with growth and headline metrics."
              checked={settings.email.monthlyReport}
              onToggle={(value) => handleToggle('email', 'monthlyReport', value)}
            />
            <NotificationToggleRow
              icon={FiDollarSign}
              label="Product updates and promotions"
              description="Receive new feature updates and event news."
              checked={settings.email.marketing}
              onToggle={(value) => handleToggle('email', 'marketing', value)}
            />
          </div>
        </div>

        <div className={`${SETTINGS_CARD_CLASS} p-5 sm:p-6 space-y-6`}>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300">
              <FiSmartphone className="h-4 w-4" />
              Push notifications
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-1">Real-time alerts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Get instant notifications in your browser and on mobile.</p>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1B1F27] p-4 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300 flex gap-3">
            <FiAlertCircle className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-300 flex-shrink-0 mt-0.5" />
            <div>
              <p>Push notifications require browser notification permission.</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 dark:text-gray-300 mt-1">Update this in your browser settings &gt; Notifications.</p>
            </div>
          </div>

          <div className="space-y-5">
            <NotificationToggleRow
              icon={FiMessageSquare}
              label="New comments"
              description="See new comments as soon as they arrive."
              checked={settings.push.comments}
              onToggle={(value) => handleToggle('push', 'comments', value)}
            />
            <NotificationToggleRow
              icon={FiHeart}
              label="Likes"
              description="Do not miss live reactions."
              checked={settings.push.likes}
              onToggle={(value) => handleToggle('push', 'likes', value)}
            />
            <NotificationToggleRow
              icon={FiUserPlus}
              label="New followers"
              description="Get alerted when a new connection appears."
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
          Notification settings were updated successfully.
        </div>
      )}
    </div>
  );
}
