"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ZoomControls from '@/components/ui/ZoomControls';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { useLocaleContext } from '@/providers/LocaleProvider';

interface PostImageLightboxProps {
  images: string[];
  open: boolean;
  startIndex?: number;
  onClose: () => void;
  postUrl?: string;
}

export default function PostImageLightbox({
  images,
  open,
  startIndex = 0,
  onClose,
  postUrl,
}: PostImageLightboxProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const { locale } = useLocaleContext();
  const isKorean = locale === 'ko';
  const safeImages = useMemo(
    () =>
      Array.isArray(images)
        ? images
            .map((url) => normalizeImageUrl(url))
            .filter((url): url is string => Boolean(url && url.trim()))
        : [],
    [images],
  );
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const currentImage = safeImages[currentIndex];

  useEffect(() => {
    if (!open) return;
    const clamped =
      safeImages.length > 0
        ? Math.min(Math.max(startIndex, 0), safeImages.length - 1)
        : 0;
    setCurrentIndex(clamped);
  }, [open, startIndex, safeImages.length]);

  useEffect(() => {
    if (open && currentImage) {
      setImageStatus('loading');
      transformRef.current?.resetTransform(0);
    }
  }, [currentImage, open]);

  useEffect(() => {
    if (!open || safeImages.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % safeImages.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
      } else if (event.key === 'Escape') {
        onClose();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        transformRef.current?.zoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        transformRef.current?.zoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        transformRef.current?.resetTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, safeImages.length, onClose]);

  if (!safeImages.length) {
    return null;
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % safeImages.length);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent 
        className="w-screen h-[100dvh] max-w-none rounded-none border-none bg-black p-0 text-white shadow-none sm:max-w-[95vw] sm:max-h-[95vh] sm:rounded-lg sm:shadow-2xl sm:bg-black/95"
        hideClose
      >
        <DialogTitle className="sr-only">
          {isKorean ? '이미지 미리보기' : 'Image preview'}
        </DialogTitle>
        <div className="flex flex-col h-full">
          <div className="flex min-h-16 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
            <div className="text-sm">
              {currentIndex + 1} / {safeImages.length}
            </div>
            <ZoomControls
              tone="dark"
              onZoomOut={() => transformRef.current?.zoomOut()}
              onZoomIn={() => transformRef.current?.zoomIn()}
              onReset={() => transformRef.current?.resetTransform()}
              labels={{
                zoomOut: isKorean ? '축소' : 'Zoom out',
                zoomIn: isKorean ? '확대' : 'Zoom in',
                reset: isKorean ? '원래 크기' : 'Reset zoom',
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={isKorean ? '닫기' : 'Close'}
            >
              <X className="h-7 w-7" aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <div className="relative h-full w-full">
              <div className="relative h-full w-full">
                {imageStatus === 'loading' && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center gap-3 text-sm text-white/80"
                    role="status"
                    aria-live="polite"
                  >
                    <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
                    <span>{isKorean ? '이미지를 불러오는 중입니다.' : 'Loading image...'}</span>
                  </div>
                )}
                {imageStatus === 'error' && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-white/80"
                    role="alert"
                  >
                    {isKorean ? '이미지를 불러오지 못했습니다.' : 'Unable to load this image.'}
                  </div>
                )}
                <TransformWrapper
                  ref={transformRef}
                  initialScale={1}
                  minScale={0.5}
                  maxScale={5}
                  centerOnInit
                  wheel={{ step: 0.08 }}
                  doubleClick={{ mode: 'reset' }}
                  panning={{ disabled: false, velocityDisabled: true }}
                >
                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: '100%', height: '100%' }}
                  >
                    <div className="relative h-full w-full cursor-grab active:cursor-grabbing">
                      <Image
                        key={currentImage}
                        src={currentImage}
                        alt={`${isKorean ? '게시글 이미지' : 'Post image'} ${currentIndex + 1}`}
                        fill
                        sizes="100vw"
                        className={cn(
                          'select-none object-contain transition-opacity duration-150',
                          imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0',
                        )}
                        priority
                        unoptimized
                        draggable={false}
                        onLoad={() => setImageStatus('loaded')}
                        onError={() => setImageStatus('error')}
                      />
                    </div>
                  </TransformComponent>
                </TransformWrapper>
              </div>

              {safeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label={isKorean ? '이전 이미지' : 'Previous image'}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label={isKorean ? '다음 이미지' : 'Next image'}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {safeImages.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-4">
              {safeImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`${isKorean ? '이미지 보기' : 'View image'} ${index + 1}`}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white before:block before:h-2 before:w-2 before:rounded-full before:border before:border-white/60',
                    currentIndex === index ? 'before:bg-white' : 'before:bg-transparent',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
