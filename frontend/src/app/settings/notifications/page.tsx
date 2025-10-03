'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiBell, FiMail, FiSmartphone, FiMessageSquare, FiHeart, FiUserPlus, FiTrendingUp, FiDollarSign, FiAlertCircle } from 'react-icons/fi';

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

  const handleToggle = (type: 'email' | 'push', setting: string) => {
    setSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [setting]: !(prev[type] as any)[setting],
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
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">로그인이 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림 설정</h2>
          <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          받고 싶은 알림을 선택하세요
        </p>
      </div>

      <div className="space-y-8">
        {/* Email Notifications */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">이메일 알림</h3>
          <div className="space-y-4">
            {/* Activity Notifications */}
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">활동 알림</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiMessageSquare className="mr-2 text-gray-400" />
                    <div>
                      <label htmlFor="email-comments" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        새 댓글
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">내 글에 새 댓글이 달렸을 때</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-comments"
                      checked={settings.email.comments}
                      onChange={() => handleToggle('email', 'comments')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiHeart className="mr-2 text-gray-400" />
                    <div>
                      <label htmlFor="email-likes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        좋아요
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">내 글을 좋아요 했을 때</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-likes"
                      checked={settings.email.likes}
                      onChange={() => handleToggle('email', 'likes')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiUserPlus className="mr-2 text-gray-400" />
                    <div>
                      <label htmlFor="email-follows" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        새 팔로워
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">누군가 나를 팔로우했을 때</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-follows"
                      checked={settings.email.follows}
                      onChange={() => handleToggle('email', 'follows')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Report Notifications */}
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">리포트</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiTrendingUp className="mr-2 text-gray-400" />
                    <div>
                      <label htmlFor="email-weekly" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        주간 리포트
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">매주 블로그 통계 요약</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-weekly"
                      checked={settings.email.weeklyReport}
                      onChange={() => handleToggle('email', 'weeklyReport')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiTrendingUp className="mr-2 text-gray-400" />
                    <div>
                      <label htmlFor="email-monthly" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        월간 리포트
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">매월 블로그 통계 요약</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-monthly"
                      checked={settings.email.monthlyReport}
                      onChange={() => handleToggle('email', 'monthlyReport')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Marketing */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">마케팅</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FiDollarSign className="mr-2 text-gray-400" />
                  <div>
                    <label htmlFor="email-marketing" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      프로모션 및 업데이트
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">새로운 기능과 이벤트 소식</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="email-marketing"
                    checked={settings.email.marketing}
                    onChange={() => handleToggle('email', 'marketing')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">푸시 알림</h3>
          <div className="bg-gray-50 dark:bg-[rgb(38,38,38)] rounded-lg p-4 mb-4">
            <div className="flex">
              <FiAlertCircle className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                푸시 알림을 받으려면 브라우저에서 알림을 허용해주세요
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiMessageSquare className="mr-2 text-gray-400" />
                <div>
                  <label htmlFor="push-comments" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    새 댓글
                  </label>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="push-comments"
                  checked={settings.push.comments}
                  onChange={() => handleToggle('push', 'comments')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiHeart className="mr-2 text-gray-400" />
                <div>
                  <label htmlFor="push-likes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    좋아요
                  </label>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="push-likes"
                  checked={settings.push.likes}
                  onChange={() => handleToggle('push', 'likes')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiUserPlus className="mr-2 text-gray-400" />
                <div>
                  <label htmlFor="push-follows" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    새 팔로워
                  </label>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="push-follows"
                  checked={settings.push.follows}
                  onChange={() => handleToggle('push', 'follows')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-700"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md">
            알림 설정이 성공적으로 업데이트되었습니다!
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-black dark:bg-gray-700 text-white font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}