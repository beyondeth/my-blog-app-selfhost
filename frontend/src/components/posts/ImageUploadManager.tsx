"use client";

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiX, FiImage, FiUpload, FiCheck, FiMove, FiMenu } from 'react-icons/fi';
import { toast } from 'sonner';
import { validateImageFile } from '@/utils/imageUtils';
import { useUploadFile } from '@/hooks/useFiles';

export interface UploadedImageInfo {
  id: string;
  url: string;
  name: string;
  size: number;
  isUploading?: boolean;
  preview?: string;
  position?: number;
}

interface ImageUploadManagerProps {
  images?: UploadedImageInfo[]; // Optional controlled mode
  maxImages?: number;
  onImagesChange: (images: UploadedImageInfo[]) => void;
  onImagesUploaded?: (images: UploadedImageInfo[]) => void; // Called when new images are uploaded
  onThumbnailSelect?: (imageId: string) => void;
  selectedThumbnailId?: string;
  className?: string;
}

// Sortable Image Item Component
interface SortableImageItemProps {
  image: UploadedImageInfo;
  isSelected: boolean;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}

function SortableImageItem({ image, isSelected, onRemove, onSelect }: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white border-2 rounded-lg overflow-hidden ${
        isSelected ? 'border-blue-500' : 'border-gray-200'
      } hover:border-gray-300 transition-colors`}
    >
      {/* Drag Handle Icon - Visual indicator only */}
      <div
        className="absolute top-1 left-1 z-10 p-1 bg-black bg-opacity-50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        title="드래그하여 순서 변경"
      >
        <FiMenu className="w-3 h-3" />
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(image.id)}
        className="absolute top-1 right-1 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        title="이미지 제거"
      >
        <FiX className="w-3 h-3" />
      </button>

      {/* Image Preview - Entire area is draggable */}
      <div 
        {...attributes}
        {...listeners}
        className="aspect-square relative cursor-grab active:cursor-grabbing"
      >
        {image.isUploading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <img
            src={image.preview || image.url || `/api/v1/files/${image.id}/download`}
            alt={image.name}
            className="w-full h-full object-cover cursor-pointer select-none"
            onClick={() => onSelect(image.id)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              console.error('Image load error:', target.src);
              // Fallback to file download endpoint
              if (!target.src.includes('/download')) {
                target.src = `/api/v1/files/${image.id}/download`;
              }
            }}
          />
        )}
        
        {/* Thumbnail Badge */}
        {isSelected && (
          <div className="absolute bottom-1 left-1 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
            썸네일
          </div>
        )}
      </div>

      {/* Image Info */}
      <div className="p-2 bg-gray-50 border-t">
        <p className="text-xs text-gray-600 truncate" title={image.name}>
          {image.name}
        </p>
        <p className="text-xs text-gray-500">
          {(image.size / 1024 / 1024).toFixed(1)} MB
        </p>
      </div>
    </div>
  );
}

// Upload Progress Bar Component
function UploadProgress({ current, total }: { current: number; total: number }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          업로드 진행률
        </span>
        <span className="text-sm text-gray-500">
          {current}/{total}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function ImageUploadManager({
  images: controlledImages,
  maxImages = 5,
  onImagesChange,
  onImagesUploaded,
  onThumbnailSelect,
  selectedThumbnailId,
  className = '',
}: ImageUploadManagerProps) {
  const [internalImages, setInternalImages] = useState<UploadedImageInfo[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFile();
  
  // Use controlled images if provided, otherwise use internal state
  const images = controlledImages ?? internalImages;
  
  // Wrapper for setImages to handle both controlled and uncontrolled mode
  const setImages = useCallback((newImages: UploadedImageInfo[] | ((prev: UploadedImageInfo[]) => UploadedImageInfo[])) => {
    if (controlledImages) {
      // Controlled mode: call onImagesChange with new array
      const updatedImages = typeof newImages === 'function' 
        ? newImages(images)
        : newImages;
      onImagesChange(updatedImages);
    } else {
      // Uncontrolled mode: use internal state
      setInternalImages(newImages);
    }
  }, [controlledImages, images, onImagesChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder images
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Update positions and notify parent
        const updatedItems = reorderedItems.map((item, index) => ({
          ...item,
          position: index
        }));
        
        onImagesChange(updatedItems);
        
        return updatedItems;
      });
    }
  }, [onImagesChange]);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;
    
    if (fileArray.length > remainingSlots) {
      toast.error(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }

    // Validate files
    for (const file of fileArray) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        return;
      }
    }

    // Start batch upload
    uploadFiles(fileArray);
  }, [images, maxImages]);

  // Upload multiple files
  const uploadFiles = useCallback(async (files: File[]) => {
    setUploadingCount(files.length);
    
    const newImages: UploadedImageInfo[] = files.map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      url: '',
      name: file.name,
      size: file.size,
      isUploading: true,
      preview: URL.createObjectURL(file),
      position: images.length + index,
    }));

    // Add placeholder images
    setImages(prev => [...prev, ...newImages]);
    onImagesChange([...images, ...newImages]);

    let completedCount = 0;

    // Upload files concurrently
    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await uploadMutation.mutateAsync({
          file,
          fileType: 'image' as const,
        });

        // Update the specific image
        const tempId = newImages[index].id;
        // Use accessUrl if available, otherwise fall back to fileUrl
        const uploadedImage: UploadedImageInfo = {
          id: result.id.toString(),
          url: result.accessUrl || result.fileUrl || `/api/v1/files/${result.id}/download`,
          name: file.name,
          size: file.size,
          isUploading: false,
          position: images.length + index,
        };

        setImages(prev => prev.map(img => 
          img.id === tempId ? uploadedImage : img
        ));

        // Clean up preview URL
        if (newImages[index].preview) {
          URL.revokeObjectURL(newImages[index].preview!);
        }

        completedCount++;
        
        return uploadedImage;
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`${file.name} 업로드 실패`);
        
        // Remove failed upload
        const tempId = newImages[index].id;
        setImages(prev => prev.filter(img => img.id !== tempId));
        
        // Clean up preview URL
        if (newImages[index].preview) {
          URL.revokeObjectURL(newImages[index].preview!);
        }
        
        throw error;
      }
    });

    try {
      const uploadedImages = await Promise.allSettled(uploadPromises);
      const successful = uploadedImages
        .filter((result): result is PromiseFulfilledResult<UploadedImageInfo> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);

      if (successful.length > 0) {
        const finalImages = images.concat(successful);
        onImagesChange(finalImages);
        
        // Notify about newly uploaded images
        if (onImagesUploaded) {
          onImagesUploaded(successful);
        }
        
        // Auto-select first image as thumbnail if none selected
        if (!selectedThumbnailId && finalImages.length > 0 && onThumbnailSelect) {
          onThumbnailSelect(finalImages[0].id);
        }
        
        toast.success(`${successful.length}개의 이미지가 업로드되었습니다.`);
      }
    } catch (error) {
      console.error('Batch upload error:', error);
    } finally {
      setUploadingCount(0);
    }
  }, [images, uploadMutation, onImagesChange]);

  // Handle remove image
  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== imageId);
      const reindexed = filtered.map((img, index) => ({
        ...img,
        position: index
      }));
      onImagesChange(reindexed);
      return reindexed;
    });

    // If removed image was thumbnail, clear selection
    if (selectedThumbnailId === imageId) {
      onThumbnailSelect?.('');
    }
  }, [onImagesChange, onThumbnailSelect, selectedThumbnailId]);

  // Handle thumbnail selection
  const handleSelectThumbnail = useCallback((imageId: string) => {
    onThumbnailSelect?.(imageId);
  }, [onThumbnailSelect]);

  // Handle drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Progress */}
      {uploadingCount > 0 && (
        <UploadProgress 
          current={images.filter(img => !img.isUploading).length}
          total={images.length}
        />
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <FiUpload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-1">
          이미지를 드래그하거나 클릭하여 업로드
        </p>
        <p className="text-xs text-gray-500">
          최대 {maxImages}개, 각 파일당 10MB 이하
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Image Gallery */}
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            업로드된 이미지 ({images.length}/{maxImages})
          </h4>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map(img => img.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {images.map((image) => (
                  <SortableImageItem
                    key={image.id}
                    image={image}
                    isSelected={selectedThumbnailId === image.id}
                    onRemove={handleRemoveImage}
                    onSelect={handleSelectThumbnail}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* 이미지 관리 가이드 */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              💡 <span className="font-medium">Tip:</span> 드래그하여 순서 변경 • 클릭하여 썸네일 설정 • X 버튼으로 삭제
            </p>
          </div>
        </div>
      )}
    </div>
  );
}