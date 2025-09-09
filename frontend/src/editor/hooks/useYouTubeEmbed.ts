/**
 * useYouTubeEmbed Hook
 * YouTube 관련 모든 기능을 통합 관리
 */

import { useCallback, useRef, useEffect } from 'react';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../utils/youtube.utils';
import { UploadedImageInfo } from '../components/ImageManager/ImageUploadManager';

interface UseYouTubeEmbedProps {
  enableImageManager?: boolean;
  images: UploadedImageInfo[];
  setImages: React.Dispatch<React.SetStateAction<UploadedImageInfo[]>>;
  setSelectedThumbnailId: React.Dispatch<React.SetStateAction<string>>;
  onThumbnailSelect?: (thumbnailId: string) => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  onFilesChange?: (fileIds: string[]) => void;
}

export function useYouTubeEmbed({
  enableImageManager,
  images,
  setImages,
  setSelectedThumbnailId,
  onThumbnailSelect,
  setUploadedFiles,
  onFilesChange,
}: UseYouTubeEmbedProps) {
  // 이미 처리된 비디오 ID를 추적하는 Set
  const processedVideoIds = useRef<Set<string>>(new Set());
  // debounce를 위한 타이머
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  // 현재 images 배열을 추적하는 ref
  const imagesRef = useRef<UploadedImageInfo[]>(images);
  
  // images가 변경될 때마다 ref 업데이트
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  
  // YouTube 썸네일 추가 함수 (중복 방지 및 debounce 적용)
  const addYouTubeThumbnail = useCallback((url: string) => {
    console.log('[YouTube] 🎬 addYouTubeThumbnail 호출됨 - URL:', url);
    console.log('[YouTube] 현재 images 배열 (prop):', images);
    console.log('[YouTube] 현재 images 배열 (ref):', imagesRef.current);
    console.log('[YouTube] enableImageManager:', enableImageManager);
    console.log('[YouTube] setImages 타입:', typeof setImages, setImages);
    
    // debounce 처리 - 동시에 여러 번 호출되는 것을 방지
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      console.log('[YouTube] ⏰ Debounce 타이머 실행');
      const videoId = extractYouTubeVideoId(url);
      console.log('[YouTube] 추출된 비디오 ID:', videoId);
      
      if (!videoId) {
        console.log('[YouTube] ❌ 비디오 ID 추출 실패');
        return;
      }
      
      if (!enableImageManager) {
        console.log('[YouTube] ❌ enableImageManager가 false');
        return;
      }
      
      // 이미 처리된 비디오 ID인지 확인
      if (processedVideoIds.current.has(videoId)) {
        console.log('[YouTube] 이미 처리된 비디오 ID:', videoId);
        return;
      }
      
      const thumbnailUrl = getYouTubeThumbnailUrl(videoId);
      const youtubeThumbnailId = `yt_thumb_${videoId}`;
      
      // 이미 추가된 썸네일인지 확인 (이중 체크) - ref에서 현재 값 가져오기
      console.log('[YouTube] 현재 images 배열 (ref):', imagesRef.current);
      const existingThumbnail = imagesRef.current.find(img => img.id === youtubeThumbnailId);
      console.log('[YouTube] 기존 썸네일 검색 결과:', existingThumbnail);
      
      if (!existingThumbnail) {
        console.log('[YouTube] 새 썸네일 추가:', youtubeThumbnailId);
        
        // 처리된 비디오 ID로 기록
        processedVideoIds.current.add(videoId);
        
        const newThumbnail: UploadedImageInfo = {
          id: youtubeThumbnailId,
          url: thumbnailUrl,
          name: `YouTube 썸네일 - ${videoId}`,
          size: 0, // YouTube 썸네일이므로 크기는 0으로 설정
          isUploading: false,
        };
        
        console.log('[YouTube] 🎯 setImages 호출 - 새 썸네일 추가');
        setImages(prev => {
          console.log('[YouTube] 이전 images:', prev);
          const updated = [...prev, newThumbnail];
          console.log('[YouTube] 업데이트된 images:', updated);
          return updated;
        });
        
        // 첫 번째 썸네일이면 자동으로 선택
        if (imagesRef.current.length === 0) {
          console.log('[YouTube] 첫 번째 썸네일 - 자동 선택:', youtubeThumbnailId);
          setSelectedThumbnailId(youtubeThumbnailId);
          onThumbnailSelect?.(youtubeThumbnailId);
        }
        
        // 파일 ID 목록에 YouTube 썸네일 URL 추가
        setUploadedFiles(prev => {
          const newFiles = [...prev];
          // YouTube 썸네일 URL을 특별한 형식으로 추가
          if (!newFiles.includes(thumbnailUrl)) {
            newFiles.push(thumbnailUrl);
          }
          // onFilesChange 호출
          setTimeout(() => {
            onFilesChange?.(newFiles);
          }, 0);
          return newFiles;
        });
      } else {
        console.log('[YouTube] 썸네일이 이미 존재:', youtubeThumbnailId);
        // 이미 존재하면 처리된 목록에 추가
        processedVideoIds.current.add(videoId);
      }
    }, 100); // 100ms debounce
  }, [
    enableImageManager, 
    setImages, 
    setSelectedThumbnailId, 
    onThumbnailSelect,
    setUploadedFiles,
    onFilesChange
    // images를 dependency에서 제거 - 외부에서 전달된 값이므로 매번 재생성되지 않도록
  ]);

  // YouTube 썸네일 삭제 시 처리된 ID 제거 함수
  const clearProcessedYouTubeId = useCallback((videoId: string) => {
    console.log('[YouTube] 🗑️ Clearing processed video ID:', videoId);
    processedVideoIds.current.delete(videoId);
  }, []);

  return {
    addYouTubeThumbnail,
    clearProcessedYouTubeId,
  };
}