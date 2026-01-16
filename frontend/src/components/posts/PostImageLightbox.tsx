import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/utils/imageUtils';

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
  const safeImages = Array.isArray(images)
    ? images
        .map((url) => normalizeImageUrl(url))
        .filter((url): url is string => Boolean(url && url.trim()))
    : [];
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (!open) return;
    const clamped =
      safeImages.length > 0
        ? Math.min(Math.max(startIndex, 0), safeImages.length - 1)
        : 0;
    setCurrentIndex(clamped);
  }, [open, startIndex, safeImages.length]);

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
        <DialogTitle className="sr-only">이미지 미리보기</DialogTitle>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-sm">
              {currentIndex + 1} / {safeImages.length}
            </div>
            <button
              onClick={onClose}
              className="opacity-70 transition-opacity focus:outline-none disabled:pointer-events-none text-white"
            >
              <X className="h-8 w-8" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <div className="relative w-full h-full sm:max-w-5xl sm:h-auto">
              <div className="relative w-full h-full sm:aspect-[16/10]">
                <Image
                  src={safeImages[currentIndex]}
                  alt={`게시물 이미지 ${currentIndex + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain select-none"
                  priority
                />
              </div>

              {safeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 text-white p-2 hover:bg-black/80 focus:outline-none"
                    aria-label="이전 이미지"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 text-white p-2 hover:bg-black/80 focus:outline-none"
                    aria-label="다음 이미지"
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
                  aria-label={`${index + 1}번 이미지 보기`}
                  className={cn(
                    'h-2 w-2 rounded-full border border-white/40',
                    currentIndex === index ? 'bg-white' : 'bg-transparent',
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
