'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiTrash2, FiCalendar, FiActivity, FiShield } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { DESTRUCTIVE_ACTION_CLASS } from '@/constants/accessibility';
import { getMcpScopeLabel } from '@/lib/mcpScopes';

/**
 * 연결된 OAuth 토큰 타입 정의
 */
interface ConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  clientDescription?: string;
  scopes: string[];
  blogId: string;
  blogName: string;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * 연결된 앱 관리 페이지
 * 사용자가 자신의 블로그에 접근 권한을 부여한 OAuth 앱들을 관리할 수 있는 페이지
 *
 * 주요 기능:
 * - 연결된 앱 목록 조회
 * - 앱 접근 권한 취소 (토큰 삭제)
 * - 권한 범위 확인
 * - 마지막 사용 시간 확인
 */
export default function ConnectedAppsPage() {
  const router = useRouter();
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 연결된 앱 목록 조회
   */
  const fetchConnectedApps = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/tokens`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConnectedApps(data);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to fetch connected apps:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchConnectedApps();
  }, [fetchConnectedApps]);

  /**
   * 앱 연결 해제 (토큰 취소)
   */
  const revokeAccess = async (tokenId: string, appName: string) => {
    if (!confirm(`Revoke access for "${appName}"? This app will no longer be able to access your blog.`)) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/oauth/tokens/${tokenId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        setConnectedApps(connectedApps.filter(app => app.id !== tokenId));
        alert(`Access revoked for "${appName}".`);
      }
    } catch (error) {
      console.error('Failed to revoke app access:', error);
      alert('Something went wrong while revoking access.');
    }
  };

  /**
   * 권한 스코프를 사용자 친화적인 텍스트로 변환
   */
  const getScopeDescription = (scope: string): string => {
    return getMcpScopeLabel(scope);
  };

  /**
   * 날짜를 상대적인 시간으로 변환
   */
  const getRelativeTime = (date: string): string => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-24 bg-gray-100 rounded"></div>
            <div className="h-24 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Connected apps</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage apps that have been granted access to your blog.
        </p>
      </div>

      {connectedApps.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FiShield className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500 mb-2">No connected apps</p>
          <p className="text-sm text-gray-400">
            Apps that access your blog through OAuth will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {connectedApps.map((app) => (
            <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{app.clientName}</h3>
                  {app.clientDescription && (
                    <p className="text-sm text-gray-600 mt-1">{app.clientDescription}</p>
                  )}

                  <div className="mt-3 space-y-2">
                    {/* 권한 스코프 */}
                    <div className="flex items-center gap-2">
                      <FiShield className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Permissions:</span>
                      <div className="flex gap-2">
                        {app.scopes.map((scope, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                            title={scope}
                          >
                            {getScopeDescription(scope)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 연결된 블로그 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Blog:</span>
                      <span className="text-sm font-medium">{app.blogName}</span>
                    </div>

                    {/* 연결 날짜 */}
                    <div className="flex items-center gap-2">
                      <FiCalendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Connected: {new Date(app.createdAt).toLocaleDateString('en-US')}
                      </span>
                    </div>

                    {/* 마지막 사용 */}
                    {app.lastUsedAt && (
                      <div className="flex items-center gap-2">
                        <FiActivity className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          Last active: {getRelativeTime(app.lastUsedAt)}
                        </span>
                      </div>
                    )}

                    {/* 만료 시간 */}
                    {app.expiresAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Expires: {new Date(app.expiresAt).toLocaleDateString('en-US')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => revokeAccess(app.id, app.clientName)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${DESTRUCTIVE_ACTION_CLASS}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                  Revoke access
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 보안 안내 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Security tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Revoke access immediately for apps you do not trust.</li>
          <li>• Each app can only use the permissions shown above.</li>
          <li>• Review and remove apps you no longer use.</li>
          <li>• If you notice suspicious activity, revoke access and change your password.</li>
        </ul>
      </div>
    </div>
  );
}
