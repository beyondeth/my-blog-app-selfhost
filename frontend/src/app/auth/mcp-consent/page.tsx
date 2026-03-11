'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Check, X } from 'lucide-react';
import { McpOAuthRequestPanel } from '@/components/auth/McpOAuthRequestPanel';
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="auth-gradient-light dark:hidden" />
      <div className="auth-gradient-dark hidden dark:block" />
      <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10" />
      <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl">
          <button
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="auth-card rounded-2xl px-4 py-8 sm:px-8 fade-in-up">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center mb-4">
                  <Image
                    src="/assets/logo.svg"
                    alt="Logo"
                    width={56}
                    height={56}
                    priority
                    className="object-contain"
                  />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  앱 연결
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  요청 권한을 검토하고 연결을 완료하세요.
                </p>
              </div>

              <McpOAuthRequestPanel
                clientName={oauthData.client_name}
                requestedMcpScopes={requestedMcpScopes}
              />

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Check className="h-4 w-4" />
                  {isSubmitting ? '연결 중...' : '허용하고 연결'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
