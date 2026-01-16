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

const CarouselItem = ({ 
  src, 
  index, 
  alt, 
  isHomeFeed, 
  shouldBlur, 
  blurReason, 
  onClick,
  isSingle
}: { 
  src: string; 
  index: number; 
  alt: string; 
  isHomeFeed: boolean;
  shouldBlur?: boolean;
  blurReason?: BlurReason;
  onClick?: () => void;
  isSingle?: boolean;
}) => {
  const dominantColor = useDominantColor(src);
  
  const backgroundStyle: CSSProperties | undefined = src
    ? { backgroundImage: `url(${src})` }
    : undefined;

  const wrapperStyle: CSSProperties = {
    borderColor: dominantColor.borderColor,
    boxShadow: `0 10px 40px -10px ${dominantColor.glowColor}`,
  };

  const wrapperClasses = cn(
    'relative w-full h-full overflow-hidden rounded-xl border transition-shadow duration-300',
    isHomeFeed
      ? 'bg-[#EEF3F8] dark:bg-[#1A232E] border-[#D9E0EA] dark:border-[#2A3645]'
      : 'bg-gray-100 dark:bg-gray-800',
  );

  return (
    <div 
      className={cn(
        "flex-shrink-0 snap-center relative aspect-[700/540] first:pl-0 last:mr-4",
        isSingle ? "w-full" : "w-[95%]"
      )}
      onClick={onClick}
    >
      <div className={wrapperClasses} style={wrapperStyle}>
        {isHomeFeed && backgroundStyle && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-50 dark:opacity-40"
              style={backgroundStyle}
            />
          </div>
        )}
        
        <div className="relative w-full h-full z-10">
          {shouldBlur ? (
            <BlurredImage
              src={src}
              alt={alt}
              isBlurred={shouldBlur}
              blurReason={blurReason}
              fill
              sizes="(max-width: 640px) 95vw, 640px"
              className="object-contain"
              containerClassName="relative w-full h-full"
              priority={index === 0}
              unoptimized={shouldDisableOptimization(src)}
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 95vw, 640px"
              className="object-contain rounded-lg"
              style={{ objectPosition: 'center' }}
              priority={index === 0}
              unoptimized={shouldDisableOptimization(src)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

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
      ? 'max-w-[780px] mx-auto bg-[#EEF3F8] dark:bg-[#1A232E] border-[#D9E0EA] dark:border-[#2A3645]'
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
    <>
      {/* Mobile View: Horizontal Scroll with Peek and Desktop-like Effects */}
      <div className={cn("block sm:hidden w-full", className)}>
        <div className={cn(
          "flex overflow-x-auto snap-x snap-mandatory gap-2 px-0 no-scrollbar touch-pan-x", 
          isHomeFeed ? "px-0" : ""
        )}>
          {images.map((img, index) => (
             <CarouselItem 
               key={index}
               src={img}
               index={index}
               alt={`게시물 이미지 ${index + 1}`}
               isHomeFeed={isHomeFeed}
               shouldBlur={shouldBlur}
               blurReason={blurReason}
               onClick={() => onImageClick?.(index)}
               isSingle={!hasMultiple}
             />
          ))}
        </div>
      </div>

      {/* Desktop View: Existing Slideshow */}
      <div
        className={cn(
          'hidden sm:block relative w-full',
          isHomeFeed ? '' : '', 
          className
        )}
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
    </>
  );
}
