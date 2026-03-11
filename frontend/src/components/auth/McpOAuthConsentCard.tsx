'use client';

import Image from 'next/image';
import { ArrowLeft, Check, X } from 'lucide-react';
import { McpOAuthRequestPanel } from '@/components/auth/McpOAuthRequestPanel';
import type { McpScopeInfo } from '@/lib/mcpScopes';

interface McpOAuthConsentCardProps {
  clientName: string;
  requestedMcpScopes: McpScopeInfo[];
  error?: string;
  isSubmitting?: boolean;
  onBack?: () => void;
  onCancel?: () => void;
  onApprove?: () => void;
  approveLabel?: string;
  backLabel?: string;
}

export function McpOAuthConsentCard({
  clientName,
  requestedMcpScopes,
  error,
  isSubmitting = false,
  onBack,
  onCancel,
  onApprove,
  approveLabel = '연결하기',
  backLabel = 'Back',
}: McpOAuthConsentCardProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="auth-gradient-light dark:hidden" />
      <div className="auth-gradient-dark hidden dark:block" />
      <div className="blur-orb blur-orb-1 opacity-20 dark:opacity-10" />
      <div className="blur-orb blur-orb-2 opacity-20 dark:opacity-10" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-default disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-100"
            disabled={!onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>

          <div className="auth-card rounded-2xl px-4 py-8 sm:px-8 fade-in-up">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-6 text-center">
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
              </div>

              <McpOAuthRequestPanel
                clientName={clientName}
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
                  onClick={onCancel}
                  disabled={isSubmitting || !onCancel}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={isSubmitting || !onApprove}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Check className="h-4 w-4" />
                  {approveLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
