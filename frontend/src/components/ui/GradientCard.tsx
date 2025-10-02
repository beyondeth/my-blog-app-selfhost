"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'glow' | 'accent';
  children: React.ReactNode;
}

/**
 * 모던한 그라데이션 카드 컴포넌트
 * 은은한 그라데이션 테두리와 그림자 효과
 */
export function GradientCard({
  variant = 'default',
  className,
  children,
  ...props
}: GradientCardProps) {
  // 변형별 스타일
  const variantStyles = {
    default: `
      bg-card
      border border-border
      shadow-md
      hover:shadow-lg
      hover:border-border/60
    `,
    hover: `
      bg-card
      border border-transparent
      shadow-lg shadow-slate-900/5 dark:shadow-slate-100/5
      hover:shadow-xl hover:shadow-indigo-500/10
      hover:border-indigo-500/20
      relative
      before:absolute before:inset-0 before:-z-10
      before:rounded-xl before:p-[1px]
      before:bg-gradient-to-br before:from-indigo-500/0 before:to-blue-500/0
      hover:before:from-indigo-500/20 hover:before:to-blue-500/20
    `,
    glow: `
      bg-card
      border border-indigo-500/20 dark:border-[#C4EFFF]/20
      shadow-lg shadow-indigo-500/10 dark:shadow-[#C4EFFF]/10
      hover:shadow-xl hover:shadow-indigo-500/20 dark:hover:shadow-[#C4EFFF]/20
      hover:border-indigo-500/30 dark:hover:border-[#C4EFFF]/30
      relative
      before:absolute before:inset-0 before:-z-10
      before:rounded-xl before:blur-xl
      before:bg-gradient-to-br before:from-indigo-500/10 before:to-blue-500/10
      dark:before:from-[#C4EFFF]/10 dark:before:to-[#D9D1F8]/10
      hover:before:from-indigo-500/20 hover:before:to-blue-500/20
      dark:hover:before:from-[#C4EFFF]/20 dark:hover:before:to-[#D9D1F8]/20
    `,
    accent: `
      bg-gradient-to-br from-card to-card/95
      border border-transparent
      shadow-xl shadow-purple-500/10 dark:shadow-[#D9D1F8]/10
      hover:shadow-2xl hover:shadow-purple-500/20 dark:hover:shadow-[#D9D1F8]/20
      relative
      before:absolute before:inset-0 before:-z-10
      before:rounded-xl before:p-[1px]
      before:bg-gradient-to-br before:from-purple-500 before:to-pink-500
      dark:before:from-[#D9D1F8] dark:before:to-[#FEC8C8]
      after:absolute after:inset-0 after:-z-20
      after:rounded-xl after:blur-2xl
      after:bg-gradient-to-br after:from-purple-500/20 after:to-pink-500/20
      dark:after:from-[#D9D1F8]/20 dark:after:to-[#FEC8C8]/20
    `
  };

  return (
    <div
      className={cn(
        // 기본 스타일
        'rounded-xl p-6',
        'transition-all duration-300',
        'overflow-hidden',

        // 변형 스타일
        variantStyles[variant],

        // 커스텀 클래스
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 카드 헤더 컴포넌트
 */
export function GradientCardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mb-4 pb-4 border-b border-border/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 카드 타이틀 컴포넌트
 */
export function GradientCardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-xl font-semibold text-foreground',
        'bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * 카드 설명 컴포넌트
 */
export function GradientCardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-sm text-muted-foreground mt-1',
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * 카드 컨텐츠 컴포넌트
 */
export function GradientCardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 카드 푸터 컴포넌트
 */
export function GradientCardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-border/50',
        'flex items-center justify-between',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}