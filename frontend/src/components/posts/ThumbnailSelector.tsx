"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image as ImageIcon, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageFile {
  id: string;
  fileUrl: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
}

interface ThumbnailSelectorProps {
  postId?: string;
  selectedThumbnailId?: string;  // 기존 호환성 유지
  selectedThumbnailUrl?: string;  // 기존 호환성 유지
  selectedThumbnailIndex?: number;  // 새로운 인덱스 기반 속성
  images?: ImageFile[];
  onThumbnailChange?: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

export const ThumbnailSelector: React.FC<ThumbnailSelectorProps> = ({
  postId,
  selectedThumbnailId,
  selectedThumbnailUrl,
  selectedThumbnailIndex = -1,
  images = [],
  onThumbnailChange,
  disabled = false,
  className,
}) => {
  const [thumbnailCandidates, setThumbnailCandidates] = useState<ImageFile[]>(images);
  const [loading, setLoading] = useState(false);

  // postId가 있으면 서버에서 이미지 목록 가져오기
  const fetchThumbnailCandidates = useCallback(async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/posts/${postId}/thumbnail/candidates`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch thumbnail candidates');
      }

      const candidates: ImageFile[] = await response.json();
      setThumbnailCandidates(candidates);
    } catch (error) {
      console.error('Error fetching thumbnail candidates:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // postId가 있으면 서버에서 이미지 목록 가져오기
  useEffect(() => {
    if (postId) {
      fetchThumbnailCandidates();
    }
  }, [postId, fetchThumbnailCandidates]);

  const handleImageSelect = (image: ImageFile) => {
    if (disabled) return;

    const index = thumbnailCandidates.findIndex(img => img.id === image.id);

    // 이미 선택된 이미지를 다시 클릭하면 선택 해제
    if (selectedThumbnailId === image.id) {
      onThumbnailChange?.(-1);  // -1 = 썸네일 미선택
    } else {
      onThumbnailChange?.(index);  // 선택된 이미지의 인덱스 전달
    }
  };

  const handleRemoveThumbnail = () => {
    if (disabled) return;
    onThumbnailChange?.(-1);  // -1 = 썸네일 미선택
  };

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            썸네일 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-gray-600">불러오는 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          썸네일 선택
        </CardTitle>
      </CardHeader>
      <CardContent>
        {thumbnailCandidates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>에디터에 이미지를 업로드하면 썸네일로 선택할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 선택된 썸네일 미리보기 */}
            {selectedThumbnailUrl && (
              <div className="relative">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedThumbnailUrl}
                    alt="선택된 썸네일"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  현재 썸네일
                </div>
                {!disabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 left-2 bg-white/90 hover:bg-white"
                    onClick={handleRemoveThumbnail}
                  >
                    <X className="h-4 w-4" />
                    취소
                  </Button>
                )}
              </div>
            )}

            {/* 썸네일 후보 이미지 목록 */}
            <div>
              <p className="text-sm font-medium mb-2">
                {selectedThumbnailUrl ? '다른 이미지로 변경' : '썸네일로 선택할 이미지'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {thumbnailCandidates.map((image) => {
                  const isSelected = selectedThumbnailId === image.id;
                  return (
                    <div
                      key={image.id}
                      className={cn(
                        "relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary hover:ring-offset-2",
                        isSelected && "ring-2 ring-primary ring-offset-2",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                      onClick={() => handleImageSelect(image)}
                    >
                      <img
                        src={image.fileUrl}
                        alt={image.originalName}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-white rounded-full p-2">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 선택 힌트 */}
            {!disabled && (
              <p className="text-xs text-gray-500">
                이미지를 클릭하여 썸네일로 선택할 수 있습니다. 선택된 썸네일은 홈 피드에 표시됩니다.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};