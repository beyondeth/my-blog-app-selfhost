import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import BlurredImage from '@/components/ui/BlurredImage';
import { shouldDisableOptimization } from '@/utils/imageUtils';
import { useDominantColor } from '@/hooks/useDominantColor';

type BlurReason = 'nsfw' | 'spoiler';

interface PostImageCarouselProps {
  images: string[];
  onImageClick?: (index: number) => void;
  className?: string;
  isHomeFeed?: boolean;
  shouldBlur?: boolean;
  blurReason?: BlurReason;
}

export default function PostImageCarousel({
  images,
  onImageClick,
  className,
  isHomeFeed = false,
  shouldBlur = false,
  blurReason = 'nsfw',
}: PostImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStateRef = useRef({ startX: 0, handled: false });

  useEffect(() => {
    if (!images || images.length === 0) return;

    const preload = (url: string) => {
      const img = new window.Image();
      img.src = url;
    };
    const candidates = [
      images[(currentIndex + 1) % images.length],
      images[(currentIndex - 1 + images.length) % images.length],
    ].filter(Boolean);
    candidates.forEach(preload);
  }, [currentIndex, images]);

  const currentImage = images?.[currentIndex] ?? null;
  const dominantColor = useDominantColor(currentImage);

  if (!images || images.length === 0) {
    return null;
  }

  const hasMultiple = images.length > 1;
  const backgroundStyle: CSSProperties | undefined = currentImage
    ? { backgroundImage: `url(${currentImage})` }
    : undefined;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(currentIndex);
    }
  };

  const wrapperClasses = cn(
    'relative w-full overflow-hidden rounded-xl border transition-shadow duration-300',
    isHomeFeed
      ? 'max-w-[780px] bg-[#EEF3F8] dark:bg-[#1A232E] border-[#D9E0EA] dark:border-[#2A3645]'
      : 'bg-gray-100 dark:bg-gray-800',
  );
  const wrapperStyle: CSSProperties = {
    borderColor: dominantColor.borderColor,
    boxShadow: `0 25px 55px -30px ${dominantColor.glowColor}`,
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (!hasMultiple) return;
    const touch = event.touches[0];
    touchStateRef.current = {
      startX: touch.clientX,
      handled: false,
    };
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!hasMultiple) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const threshold = 40;

    if (touchStateRef.current.handled) {
      return;
    }

    if (deltaX > threshold) {
      handlePrev();
      touchStateRef.current.handled = true;
    } else if (deltaX < -threshold) {
      handleNext();
      touchStateRef.current.handled = true;
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.handled = false;
  };

  return (
    <div
      className={cn('relative w-full', isHomeFeed ? 'flex justify-center' : '', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={wrapperClasses} style={wrapperStyle}>
        {backgroundStyle && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-110 opacity-70 dark:opacity-60 transition-opacity duration-300"
              style={backgroundStyle}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-black/30 dark:from-slate-900/30 dark:via-slate-900/10 dark:to-black/60" />
          </div>
        )}
        <button
          type="button"
          onClick={handleImageClick}
          className="relative z-10 block w-full focus:outline-none"
        >
          <div className="relative w-full aspect-[700/540]">
            {shouldBlur ? (
              <BlurredImage
                src={currentImage}
                alt={`게시물 이미지 ${currentIndex + 1}`}
                isBlurred={shouldBlur}
                blurReason={blurReason}
                fill
                sizes="(max-width: 1024px) 90vw, 780px"
                className="object-contain bg-black/5"
                containerClassName="relative w-full h-full"
                priority={currentIndex === 0}
                unoptimized={shouldDisableOptimization(currentImage)}
              />
            ) : (
              <Image
                src={currentImage}
                alt={`게시물 이미지 ${currentIndex + 1}`}
                fill
                sizes="(max-width: 1024px) 90vw, 780px"
                className="object-contain bg-black/5"
                priority={currentIndex === 0}
                unoptimized={shouldDisableOptimization(currentImage)}
              />
            )}
          </div>
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2 hover:bg-black/70 focus:outline-none z-10"
              aria-label="이전 이미지"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2 hover:bg-black/70 focus:outline-none z-10"
              aria-label="다음 이미지"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-1">
                {images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    aria-label={`${index + 1}번 이미지 보기`}
                    className={cn(
                      'h-2 w-2 rounded-full transition-colors',
                      index === currentIndex ? 'bg-white' : 'bg-white/40',
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
