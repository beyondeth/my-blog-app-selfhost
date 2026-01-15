'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Eye, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 블러 이미지의 블러 사유
 */
type BlurReason = 'nsfw' | 'spoiler';

/**
 * BlurredImage 컴포넌트 Props
 */
interface BlurredImageProps {
  /** 이미지 소스 URL */
  src: string;
  /** 이미지 대체 텍스트 */
  alt: string;
  /** 블러 적용 여부 */
  isBlurred: boolean;
  /** 블러 사유 (기본값: 'nsfw') */
  blurReason?: BlurReason;
  /** 블러 해제 시 콜백 */
  onReveal?: () => void;
  /** 추가 클래스명 */
  className?: string;
  /** 컨테이너 클래스명 */
  containerClassName?: string;
  /** Next.js Image width */
  width?: number;
  /** Next.js Image height */
  height?: number;
  /** Next.js Image fill 모드 */
  fill?: boolean;
  /** Next.js Image sizes */
  sizes?: string;
  /** 이미지 스타일 */
  style?: React.CSSProperties;
  /** 이미지 우선 로딩 */
  priority?: boolean;
  /** Next.js Image unoptimized 옵션 */
  unoptimized?: boolean;
}

/**
 * 블러 처리가 가능한 이미지 컴포넌트
 *
 * @description NSFW 또는 스포일러 콘텐츠에 블러 처리를 적용하고,
 * 사용자가 클릭하여 블러를 해제할 수 있습니다.
 *
 * @example
 * ```tsx
 * <BlurredImage
 *   src="/images/nsfw-content.jpg"
 *   alt="NSFW 이미지"
 *   isBlurred={!isAdultVerified}
 *   blurReason="nsfw"
 *   onReveal={() => console.log('블러 해제됨')}
 * />
 * ```
 */
export default function BlurredImage({
  src,
  alt,
  isBlurred,
  blurReason = 'nsfw',
  onReveal,
  className,
  containerClassName,
  width,
  height,
  fill,
  sizes,
  style,
  priority,
  unoptimized,
}: BlurredImageProps) {
  // 로컬 상태로 블러 해제 관리 (세션 내에서만 유지)
  const [revealed, setRevealed] = useState(false);

  // 실제 블러 적용 여부 (외부 상태와 로컬 상태 모두 고려)
  const shouldBlur = isBlurred && !revealed;

  // 블러 해제 핸들러
  const handleReveal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRevealed(true);
    onReveal?.();
  }, [onReveal]);

  // 블러 사유별 라벨
  const getBlurLabel = () => {
    switch (blurReason) {
      case 'nsfw':
        return '성인 콘텐츠';
      case 'spoiler':
        return '스포일러';
      default:
        return '가려진 콘텐츠';
    }
  };

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {/* 이미지 */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        sizes={sizes}
        style={style}
        priority={priority}
        unoptimized={unoptimized}
        className={cn(
          className,
          // 블러 효과 적용
          shouldBlur && 'blur-xl scale-105 transition-all duration-300'
        )}
      />

      {/* 블러 오버레이 */}
      {shouldBlur && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
          onClick={handleReveal}
        >
          {/* 아이콘 */}
          <div className="w-12 h-12 rounded-full bg-gray-800/80 flex items-center justify-center mb-3">
            {blurReason === 'nsfw' ? (
              <AlertTriangle className="w-6 h-6 text-red-400" />
            ) : (
              <Eye className="w-6 h-6 text-gray-300" />
            )}
          </div>

          {/* 라벨 */}
          <span className="text-white text-sm font-medium mb-2">
            {getBlurLabel()}
          </span>

          {/* 해제 버튼 */}
          <button
            onClick={handleReveal}
            className="px-4 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-white text-xs font-medium rounded-full transition-colors"
          >
            클릭하여 보기
          </button>
        </div>
      )}
    </div>
  );
}
