"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * 모던한 그라데이션 버튼 컴포넌트
 * 그라데이션과 그림자 효과를 활용한 시각적으로 매력적인 버튼
 */
export function GradientButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: GradientButtonProps) {
  // 사이즈별 스타일
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  // 변형별 스타일
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-indigo-500 to-blue-600
      dark:from-[#C4EFFF] dark:to-[#D9D1F8]
      hover:from-indigo-600 hover:to-blue-700
      dark:hover:from-[#D9D1F8] dark:hover:to-[#C4EFFF]
      text-white dark:text-[#181818] font-medium
      shadow-lg shadow-indigo-500/25 dark:shadow-black/40
      hover:shadow-xl hover:shadow-indigo-500/30 dark:hover:shadow-black/50
      border border-transparent
    `,
    secondary: `
      bg-gradient-to-r from-slate-50 to-slate-100
      dark:from-[#413F4C] dark:to-[#555360]
      hover:from-slate-100 hover:to-slate-200
      dark:hover:from-[#555360] dark:hover:to-[#413F4C]
      text-slate-900 dark:text-[#FDFDFD] font-medium
      shadow-md shadow-slate-900/5 dark:shadow-black/30
      hover:shadow-lg hover:shadow-slate-900/10 dark:hover:shadow-black/40
      border border-slate-200 dark:border-[#555360]
    `,
    accent: `
      bg-gradient-to-r from-purple-500 to-pink-500
      dark:from-[#FEC8C8] dark:to-[#D9D1F8]
      hover:from-purple-600 hover:to-pink-600
      dark:hover:from-[#D9D1F8] dark:hover:to-[#FEC8C8]
      text-white dark:text-[#181818] font-medium
      shadow-lg shadow-purple-500/25 dark:shadow-black/40
      hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-black/50
      border border-transparent
    `,
    ghost: `
      bg-transparent
      hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100
      dark:hover:from-[#413F4C]/30 dark:hover:to-[#555360]/30
      text-slate-700 dark:text-[#DCE3E9] font-medium
      hover:text-slate-900 dark:hover:text-[#FDFDFD]
      border border-slate-200 dark:border-[#555360]
      hover:border-slate-300 dark:hover:border-[#C4EFFF]/30
      shadow-sm hover:shadow-md dark:shadow-black/20 dark:hover:shadow-black/30
    `
  };

  return (
    <button
      className={cn(
        // 기본 스타일
        'relative inline-flex items-center justify-center',
        'rounded-lg transition-all duration-200',
        'transform hover:scale-[1.02] active:scale-[0.98]',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'focus:ring-indigo-500 dark:focus:ring-indigo-400',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'disabled:hover:scale-100',

        // 사이즈 스타일
        sizeStyles[size],

        // 변형 스타일
        variantStyles[variant],

        // 커스텀 클래스
        className
      )}
      {...props}
    >
      {/* 그라데이션 오버레이 (hover 효과) */}
      <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-white/0 to-white/0 hover:from-white/10 hover:to-white/10 transition-all duration-200" />

      {/* 버튼 내용 */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

// 아이콘 버튼 변형
export function GradientIconButton({
  variant = 'primary',
  className,
  children,
  ...props
}: Omit<GradientButtonProps, 'size'>) {
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-indigo-500 to-blue-600
      hover:from-indigo-600 hover:to-blue-700
      text-white
      shadow-lg shadow-indigo-500/25
      hover:shadow-xl hover:shadow-indigo-500/30
    `,
    secondary: `
      bg-gradient-to-r from-slate-50 to-slate-100
      dark:from-slate-800 dark:to-slate-700
      hover:from-slate-100 hover:to-slate-200
      dark:hover:from-slate-700 dark:hover:to-slate-600
      text-slate-700 dark:text-slate-300
      shadow-md shadow-slate-900/5
      hover:shadow-lg hover:shadow-slate-900/10
    `,
    accent: `
      bg-gradient-to-r from-purple-500 to-pink-500
      hover:from-purple-600 hover:to-pink-600
      text-white
      shadow-lg shadow-purple-500/25
      hover:shadow-xl hover:shadow-purple-500/30
    `,
    ghost: `
      bg-transparent
      hover:bg-slate-100 dark:hover:bg-slate-800
      text-slate-700 dark:text-slate-300
      shadow-sm hover:shadow-md
    `
  };

  return (
    <button
      className={cn(
        // 기본 스타일
        'relative p-2 rounded-lg',
        'transition-all duration-200',
        'transform hover:scale-[1.05] active:scale-[0.95]',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'focus:ring-indigo-500 dark:focus:ring-indigo-400',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'disabled:hover:scale-100',

        // 변형 스타일
        variantStyles[variant],

        // 커스텀 클래스
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}