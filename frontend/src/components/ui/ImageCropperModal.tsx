import { useState, useCallback, useEffect, useRef } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
  type PixelCrop,
} from 'react-image-crop';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  aspectRatio: number;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
  loading?: boolean;
}

function createCenteredAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspectRatio: number
): PercentCrop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: aspectRatio >= 2.5 ? 96 : 90,
      },
      aspectRatio,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.max(1, Math.round(pixelCrop.width * scaleX));
  canvas.height = Math.max(1, Math.round(pixelCrop.height * scaleY));

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

export default function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio,
  onCropComplete,
  loading = false,
}: ImageCropperModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  useEffect(() => {
    if (!isOpen) return;
    setCrop(undefined);
    setCompletedCrop(undefined);
    imageRef.current = null;
  }, [imageSrc, isOpen]);

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    imageRef.current = image;
    setCrop(createCenteredAspectCrop(image.width, image.height, aspectRatio));
  }, [aspectRatio]);

  const handleClose = useCallback(() => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    imageRef.current = null;
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!imageRef.current || !completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) {
      return;
    }

    try {
      const croppedBlob = await getCroppedImg(imageRef.current, completedCrop);
      if (croppedBlob) {
        await onCropComplete(croppedBlob);
      }
    } catch (error) {
      console.error(error);
    }
  }, [completedCrop, onCropComplete]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white dark:bg-[#1a1b1e] border-gray-200 dark:border-gray-800">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            이미지 자르기
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4">
          <div className="relative flex h-[400px] items-center justify-center overflow-auto rounded-2xl bg-[#0f1115]">
            {imageSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                aspect={aspectRatio}
                keepSelection
                minWidth={aspectRatio >= 2.5 ? 240 : 140}
                minHeight={aspectRatio >= 2.5 ? 80 : 140}
                ruleOfThirds
                className="max-h-full"
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop source"
                  onLoad={handleImageLoad}
                  className="block max-h-[400px] w-auto max-w-full select-none"
                  draggable={false}
                />
              </ReactCrop>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
            프레임 가장자리나 꼭짓점을 마우스로 드래그해서 크기를 조절하고, 프레임 안쪽을 드래그해서 위치를 옮기세요.
          </p>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:w-auto">
              취소
            </Button>
            <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? '처리 중...' : '적용'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
