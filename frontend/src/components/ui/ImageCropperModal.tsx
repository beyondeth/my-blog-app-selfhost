import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FiMinus, FiPlus, FiRotateCcw } from 'react-icons/fi';
import { Area, MediaSize } from 'react-easy-crop';

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
  const [minZoom, setMinZoom] = useState(0.5); // 동적 minZoom (기본값: 0.5)
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

  /**
   * 이미지 로드 시 동적 minZoom 계산
   * - 이미지가 crop 영역을 채울 수 있는 최소 배율 계산
   * - 사용자가 더 축소할 수 있도록 여유를 줌 (0.3배까지)
   */
  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    const { width: imgWidth, height: imgHeight } = mediaSize;
    const imageAspect = imgWidth / imgHeight;
    
    // crop 영역을 완전히 채우는 최소 배율 계산
    // aspectRatio = target width / target height (예: 4 = 1200/300)
    let coverMinZoom: number;
    
    if (imageAspect > aspectRatio) {
      // 이미지가 가로로 더 넓음 → 세로가 기준
      // 세로를 채우면 가로는 넘침
      coverMinZoom = 1; // 기본 1배 (contain 모드에서 세로 기준)
    } else {
      // 이미지가 세로로 더 길음 → 가로가 기준
      // 가로를 채우면 세로는 넘침
      coverMinZoom = 1; // 기본 1배 (contain 모드에서 가로 기준)
    }
    
    // 사용자가 이미지를 더 축소할 수 있도록 허용 (0.3배까지)
    // 이렇게 하면 이미지 전체를 볼 수 있고, 원하는 부분만 crop 영역에 배치 가능
    const allowedMinZoom = Math.max(0.3, coverMinZoom * 0.5);
    
    setMinZoom(allowedMinZoom);
    
    // 초기 zoom을 1로 리셋 (새 이미지 로드 시)
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }, [aspectRatio]);

  // 줌 리셋 버튼 핸들러
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }, []);

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

  // 모달이 닫힐 때 상태 리셋
  const handleClose = useCallback(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setMinZoom(0.5);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
              minZoom={minZoom}
              maxZoom={3}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={onZoomChange}
              onMediaLoaded={onMediaLoaded}
              showGrid={true}
              objectFit="contain"
            />
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* 줌 슬라이더 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom(Math.max(minZoom, zoom - 0.1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="축소"
            >
              <FiMinus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            <input
              type="range"
              value={zoom}
              min={minZoom}
              max={3}
              step={0.05}
              aria-label="줌 조절"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            />
            
            <button
              type="button"
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="확대"
            >
              <FiPlus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* 리셋 버튼 */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              aria-label="초기화"
              title="줌 초기화"
            >
              <FiRotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          {/* 줌 레벨 표시 */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            {Math.round(zoom * 100)}%
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
