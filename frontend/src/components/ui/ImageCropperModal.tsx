import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FiMinus, FiPlus } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { Area } from 'react-easy-crop';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  aspectRatio: number;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
  loading?: boolean;
}

/**
 * Canvas를 사용하여 이미지 크롭을 수행하는 유틸리티 함수
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // 디바이스 픽셀 비율 고려 없이 원본 이미지 해상도 기준으로 크롭
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95); // 0.95 퀄리티의 JPEG로 저장
  });
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

export default function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio,
  onCropComplete,
  loading = false,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedBlob) {
        await onCropComplete(croppedBlob);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white dark:bg-[#1a1b1e] border-gray-200 dark:border-gray-800">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            이미지 자르기
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={onZoomChange}
              showGrid={true}
              objectFit="contain"
            />
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <FiMinus className="w-4 h-4 text-gray-500" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            />
            <FiPlus className="w-4 h-4 text-gray-500" />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
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
