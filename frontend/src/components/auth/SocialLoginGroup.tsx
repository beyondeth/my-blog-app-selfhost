'use client';

import { SocialLoginButton, type OAuthProvider } from './SocialLoginButton';

interface SocialLoginGroupProps {
  providers?: OAuthProvider[];
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function SocialLoginGroup({
  providers = ['google', 'kakao', 'github'],
  disabled = false,
  className = '',
  title
}: SocialLoginGroupProps) {
  // 동적으로 그리드 컬럼 설정
  const gridCols = providers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`${className}`}>
      {/* Social login buttons - 가로 배치 */}
      <div className={`grid ${gridCols} gap-3`}>
        {providers.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            disabled={disabled}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}