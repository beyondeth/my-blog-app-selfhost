'use client';

import { SocialLoginButton, type OAuthProvider } from './SocialLoginButton';

interface SocialLoginGroupProps {
  providers?: OAuthProvider[];
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function SocialLoginGroup({
  providers = ['google','github'],
  disabled = false,
  className = '',
  title
}: SocialLoginGroupProps) {
  return (
    <div className={`flex w-full flex-col items-center ${className}`}>
      {/* Social login buttons - 모바일: 세로, 데스크톱: 가로 */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {providers.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            disabled={disabled}
            className="w-full flex-1 justify-center"
          />
        ))}
      </div>
    </div>
  );
}