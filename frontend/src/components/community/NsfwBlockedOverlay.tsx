'use client';

import { AlertTriangle, ArrowLeft, Shield, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * NsfwBlockedOverlay 컴포넌트 Props
 */
interface NsfwBlockedOverlayProps {
  /** 성인 인증하기 버튼 클릭 핸들러 */
  onVerify?: () => void;
  /** 로그인 이동 핸들러 */
  onLogin?: () => void;
  /** 뒤로 가기 버튼 클릭 핸들러 */
  onBack?: () => void;
  /** 커뮤니티 이름 (선택적) */
  communityName?: string;
  /** 로그인 요구 여부 */
  requiresLogin?: boolean;
}

/**
 * NSFW 커뮤니티 접근 차단 오버레이 컴포넌트
 *
 * @description 성인 인증이 필요한 NSFW 커뮤니티에 접근할 때 표시되는
 * 전체 화면 오버레이입니다. 성인 인증 또는 뒤로 가기를 선택할 수 있습니다.
 *
 * @example
 * ```tsx
 * <NsfwBlockedOverlay
 *   onVerify={() => setShowAdultModal(true)}
 *   onBack={() => router.back()}
 *   communityName="성인 커뮤니티"
 * />
 * ```
 */
export default function NsfwBlockedOverlay({
  onVerify,
  onLogin,
  onBack,
  communityName,
  requiresLogin = false,
}: NsfwBlockedOverlayProps) {
  const primaryCta = requiresLogin ? onLogin ?? onVerify : onVerify;
  const PrimaryIcon = requiresLogin ? LogIn : Shield;
  const primaryLabel = requiresLogin ? 'Sign in' : 'Verify age';
  const title = requiresLogin ? 'Sign-in required' : 'Adults-only community';
  const description = requiresLogin
    ? 'Sign in first to complete age verification and access this NSFW community.'
    : 'This community is restricted to adults aged 18 or older. Age verification is required to continue.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        {/* 경고 아이콘 */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h1>

        {/* 커뮤니티 이름 */}
        {communityName && (
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            {communityName}
          </p>
        )}

        {/* 설명 */}
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {description}
        </p>

        {/* 안내 박스 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                Age verification
              </p>
              <ul className="space-y-1 list-disc list-inside">
                {requiresLogin ? (
                  <>
                    <li>Sign in to start the age verification flow.</li>
                    <li>Once verified, you can access all NSFW communities.</li>
                    <li>If you do not have an account yet, create one and try again.</li>
                  </>
                ) : (
                  <>
                    <li>Verification is completed using your date of birth.</li>
                    <li>Your verification data is stored securely.</li>
                    <li>Providing false information may limit access to the service.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </Button>
          )}
          {primaryCta && (
            <Button
              onClick={primaryCta}
              className={`flex items-center gap-2 text-white ${
                requiresLogin ? 'bg-gray-900 hover:bg-gray-800' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              <PrimaryIcon className="w-4 h-4" />
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
