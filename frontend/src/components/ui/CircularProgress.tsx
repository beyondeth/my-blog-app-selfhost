/**
 * 원형 프로그레스바 컴포넌트
 *
 * @description
 * SVG 기반 도넛 형태의 프로그레스바
 * - 중앙에 % 텍스트 표시
 * - 다크모드 지원
 * - 부드러운 애니메이션 트랜지션
 *
 * @example
 * <CircularProgress progress={75} size={64} showText />
 */

import React from 'react';

interface CircularProgressProps {
  /**
   * 진행률 (0-100)
   */
  progress: number;

  /**
   * 원의 크기 (px)
   * @default 64
   */
  size?: number;

  /**
   * 선 두께 (px)
   * @default 6
   */
  strokeWidth?: number;

  /**
   * 중앙에 % 텍스트 표시 여부
   * @default true
   */
  showText?: boolean;

  /**
   * 추가 CSS 클래스
   */
  className?: string;

  /**
   * 트랙(배경 원) 색상 클래스
   * @default "text-gray-200 dark:text-gray-700"
   */
  trackColorClass?: string;

  /**
   * 진행률 바 색상 클래스
   * @default "text-blue-500"
   */
  progressColorClass?: string;
}

export default function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 6,
  showText = true,
  className = '',
  trackColorClass = 'text-gray-200 dark:text-gray-700',
  progressColorClass = 'text-blue-500',
}: CircularProgressProps) {
  // 진행률 범위 제한 (0-100)
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  // SVG 계산
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* 배경 트랙 (회색 원) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackColorClass}
        />

        {/* 진행률 원 (파란색) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${progressColorClass} transition-all duration-300 ease-out`}
        />
      </svg>

      {/* 중앙 % 텍스트 */}
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(normalizedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}
