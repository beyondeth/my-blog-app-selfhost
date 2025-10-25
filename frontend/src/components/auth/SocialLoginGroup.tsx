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
    <div className={`flex justify-center ${className}`}>
      {/* Social login buttons - 가로 배치 */}
      <div className="flex gap-2">
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