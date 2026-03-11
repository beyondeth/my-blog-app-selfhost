'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { McpOAuthConsentCard } from '@/components/auth/McpOAuthConsentCard';
import { parseMcpScopes } from '@/lib/mcpScopes';
import {
  buildMcpOAuthDeniedCallbackUrl,
  buildMcpOAuthLoginPath,
  clearMcpOAuthSession,
  parseMcpOAuthSessionData,
  readMcpOAuthSession,
  type McpOAuthSessionData,
  writeMcpOAuthSession,
} from '@/lib/mcpOAuth';
import { useAuth } from '@/providers/AuthProviderV2';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function McpConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [oauthData, setOauthData] = useState<McpOAuthSessionData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const rawQueryData = JSON.stringify({
      state: searchParams.get('state'),
      callback_url: searchParams.get('callback_url'),
      client_name: searchParams.get('client_name'),
      scope: searchParams.get('scope'),
    });

    const queryData = parseMcpOAuthSessionData(rawQueryData);
    if (queryData) {
      writeMcpOAuthSession(queryData);
      setOauthData(queryData);
      return;
    }

    const storedData = readMcpOAuthSession();
    if (storedData) {
      setOauthData(storedData);
      return;
    }

    setOauthData(null);
  }, [searchParams]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!oauthData) {
      router.replace('/');
      return;
    }

    if (!user) {
      router.replace(buildMcpOAuthLoginPath(oauthData));
      return;
    }

    if (!user.termsAcceptedAt || !user.privacyAcceptedAt) {
      router.replace('/consent');
    }
  }, [isLoading, oauthData, router, user]);

  const requestedMcpScopes = oauthData ? parseMcpScopes(oauthData.scope) : [];

  const handleCancel = () => {
    if (!oauthData) {
      router.replace('/');
      return;
    }

    try {
      const deniedUrl = buildMcpOAuthDeniedCallbackUrl(oauthData);
      clearMcpOAuthSession();
      window.location.assign(deniedUrl);
    } catch (cancelError) {
      console.error('Failed to build denied callback URL:', cancelError);
      clearMcpOAuthSession();
      router.replace('/');
    }
  };

  const handleApprove = async () => {
    if (!oauthData) {
      router.replace('/');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/oauth/mcp/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          state: oauthData.state,
          callback_url: oauthData.callback_url,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.code === 'CONSENT_REQUIRED') {
          router.push('/consent');
          return;
        }

        throw new Error(data?.message || '연결 승인 처리에 실패했습니다.');
      }

      clearMcpOAuthSession();
      window.location.assign(data.redirect_url);
    } catch (approveError: any) {
      setError(approveError?.message || '연결 승인 처리 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  if (isLoading || !oauthData || !user || !user.termsAcceptedAt || !user.privacyAcceptedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">연결 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <McpOAuthConsentCard
      clientName={oauthData.client_name}
      requestedMcpScopes={requestedMcpScopes}
      error={error}
      isSubmitting={isSubmitting}
      onBack={() => router.back()}
      onCancel={handleCancel}
      onApprove={handleApprove}
      approveLabel={isSubmitting ? '연결 중...' : '허용하고 연결'}
    />
  );
}

export default function McpConsentPage() {
  const fallback = (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">연결 정보를 불러오는 중...</p>
      </div>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <McpConsentContent />
    </Suspense>
  );
}
