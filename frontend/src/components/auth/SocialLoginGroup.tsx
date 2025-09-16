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
  title = '또는'
}: SocialLoginGroupProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Divider with title */}
      {title && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 text-gray-500">{title}</span>
          </div>
        </div>
      )}

      {/* Social login buttons */}
      <div className="space-y-2.5">
        {providers.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}