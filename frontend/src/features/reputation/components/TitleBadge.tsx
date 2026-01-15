/**
 * 평판 시스템 - 타이틀 배지 컴포넌트
 *
 * 사용자의 타이틀(칭호)을 시각적으로 표시하는 배지입니다.
 *
 * @example
 * <TitleBadge titleCode="TOP_CONTRIBUTOR" />
 * <TitleBadge titleCode="RISING_STAR" size="lg" />
 */
'use client';

import React from 'react';

/**
 * 타이틀 메타데이터 (백엔드 title-code.enum.ts와 동기화)
 */
const TITLE_METADATA: Record<
  string,
  {
    displayName: string;
    description: string;
    icon: string;
    bgColor: string;
    textColor: string;
  }
> = {
  TOP_CONTRIBUTOR: {
    displayName: '탑 컨트리뷰터',
    description: '주간 상위 10% 기여자',
    icon: '🏆',
    bgColor: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    textColor: 'text-white',
  },
  RISING_STAR: {
    displayName: '라이징 스타',
    description: '급성장 중인 신규 유저',
    icon: '🌟',
    bgColor: 'bg-gradient-to-r from-blue-400 to-indigo-500',
    textColor: 'text-white',
  },
  VERIFIED_WRITER: {
    displayName: '검증된 작성자',
    description: '활발한 콘텐츠 제작자',
    icon: '✍️',
    bgColor: 'bg-gradient-to-r from-purple-400 to-pink-500',
    textColor: 'text-white',
  },
};

/**
 * 기본 타이틀 메타데이터 (알 수 없는 코드용)
 */
const DEFAULT_METADATA = {
  displayName: '타이틀',
  description: '',
  icon: '🏅',
  bgColor: 'bg-gray-400',
  textColor: 'text-white',
};

interface TitleBadgeProps {
  /** 타이틀 코드 */
  titleCode: string;
  /** 크기 (sm: 작게, md: 기본, lg: 크게) */
  size?: 'sm' | 'md' | 'lg';
  /** 설명 툴팁 표시 여부 */
  showTooltip?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 타이틀 배지 컴포넌트
 */
export default function TitleBadge({
  titleCode,
  size = 'md',
  showTooltip = true,
  className = '',
}: TitleBadgeProps) {
  const metadata = TITLE_METADATA[titleCode] || DEFAULT_METADATA;

  // 크기별 스타일
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${metadata.bgColor} ${metadata.textColor}
        ${sizeClasses[size]}
        ${className}
      `}
      title={showTooltip ? metadata.description : undefined}
    >
      <span>{metadata.icon}</span>
      <span>{metadata.displayName}</span>
    </span>
  );
}

/**
 * 타이틀 코드로 메타데이터 조회 (유틸리티)
 */
export function getTitleMetadata(titleCode: string) {
  return TITLE_METADATA[titleCode] || DEFAULT_METADATA;
}
