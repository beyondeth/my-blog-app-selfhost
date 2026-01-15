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
  const primaryLabel = requiresLogin ? '로그인하기' : '성인 인증하기';
  const title = requiresLogin ? '로그인이 필요합니다' : '성인 전용 커뮤니티';
  const description = requiresLogin
    ? '로그인을 완료하면 성인 인증을 진행하고 NSFW 커뮤니티에 참여할 수 있습니다.'
    : '이 커뮤니티는 18세 이상 성인만 접근할 수 있습니다. 계속하려면 성인 인증이 필요합니다.';

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
                성인 인증 안내
              </p>
              <ul className="space-y-1 list-disc list-inside">
                {requiresLogin ? (
                  <>
                    <li>로그인을 완료하면 성인 인증 절차를 진행할 수 있습니다</li>
                    <li>한 번 인증하면 모든 NSFW 커뮤니티에 접근할 수 있습니다</li>
                    <li>계정이 없다면 회원가입 후 다시 시도해주세요</li>
                  </>
                ) : (
                  <>
                    <li>생년월일 확인을 통해 인증합니다</li>
                    <li>인증 정보는 안전하게 보호됩니다</li>
                    <li>허위 정보 입력 시 서비스 이용이 제한될 수 있습니다</li>
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
              뒤로 가기
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
