'use client';

import { useDominantColor } from '@/hooks/useDominantColor';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/utils/imageUtils';
import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';

interface TintedImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  roundedClassName?: string;
  imageFit?: 'contain' | 'cover';
  children?: ReactNode;
  imageSizes?: string;
  unoptimized?: boolean;
}

/**
 * 이미지 미리보기에 동적 테두리/그라디언트를 적용하는 프레임
 * - dominant color 기반 외곽선/글로우
 * - 블로그 브랜드 자산 업로더 등에서 재사용
 */
export default function TintedImagePreview({
  src,
  alt,
  className,
  roundedClassName = 'rounded-2xl',
  imageFit = 'contain',
  children,
  imageSizes = '100vw',
  unoptimized = true,
}: TintedImagePreviewProps) {
  const normalizedSrc = normalizeImageUrl(src);
  const dominantColor = useDominantColor(normalizedSrc);

  const useSolidDark = dominantColor.isNearBlack;
  const useSolidLight = dominantColor.isNearWhite;
  const frameStyle: CSSProperties = {
    borderColor: useSolidDark
      ? 'rgba(15,23,42,0.8)'
      : useSolidLight
        ? 'rgba(255,255,255,0.9)'
        : dominantColor.borderColor,
    boxShadow: useSolidDark
      ? '0 24px 55px -32px rgba(2,6,23,0.85)'
      : useSolidLight
        ? '0 24px 55px -32px rgba(15,23,42,0.18)'
        : `0 24px 55px -32px ${dominantColor.glowColor}`,
    backgroundColor: useSolidDark
      ? 'rgba(2,6,23,0.95)'
      : useSolidLight
        ? 'rgba(255,255,255,0.92)'
        : dominantColor.isDark
          ? 'rgba(15,23,42,0.75)'
          : 'rgba(255,255,255,0.85)',
  };
  const showGradientOverlay = !(useSolidDark || useSolidLight);

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden border transition-all duration-300',
        roundedClassName,
        className,
      )}
      style={frameStyle}
    >
      {showGradientOverlay && (
        <div className="pointer-events-none absolute inset-px opacity-[0.12] rounded-[inherit]">
          <div
            className="absolute inset-0 rounded-[inherit]"
            style={{
              background: `radial-gradient(circle at 18% 15%, ${dominantColor.borderColor}18, transparent 36%), radial-gradient(circle at 82% 5%, rgba(255,255,255,0.08), transparent 60%)`,
              clipPath: 'inset(0 round inherit)',
            }}
          />
        </div>
      )}
      <Image
        src={normalizedSrc || src}
        alt={alt}
        fill
        sizes={imageSizes}
        className={cn(
          'relative z-10 select-none',
          imageFit === 'cover' ? 'object-cover' : 'object-contain',
        )}
        draggable={false}
        unoptimized={unoptimized}
      />
      {children}
    </div>
  );
}
