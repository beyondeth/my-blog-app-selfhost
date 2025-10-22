/**
 * YouTube Utilities
 * YouTube 관련 유틸리티 함수 - TipTap 공식 패턴 사용
 */

import { YOUTUBE_CONFIG, ERROR_MESSAGES } from '../constants/editor.constants';

// TipTap 공식 YouTube URL 정규식
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?)([\w-]+)(&\S+)?$/;

/**
 * YouTube URL 유효성 검사 (TipTap 공식 패턴)
 */
export const isYouTubeUrl = (url: string): boolean => {
  const result = YOUTUBE_REGEX.test(url);
  // console.log('[isYouTubeUrl] Checking URL:', url, 'Result:', result);
  return result;
};

/**
 * YouTube URL이 임베드 가능한 비디오 URL인지 확인
 */
export const isEmbeddableYouTubeUrl = (url: string): boolean => {
  // 먼저 유효한 YouTube URL인지 확인
  if (!isYouTubeUrl(url)) {
    return false;
  }
  
  // 플레이리스트나 채널이 아닌 비디오 URL인지 확인
  const urlType = getYouTubeUrlType(url);
  const result = urlType === 'video';
  // console.log('[isEmbeddableYouTubeUrl] URL:', url, 'Type:', urlType, 'Embeddable:', result);
  return result;
};

/**
 * YouTube URL 타입 판별
 */
export const getYouTubeUrlType = (url: string): 'video' | 'channel' | 'playlist' | 'unknown' => {
  // 채널 URL 패턴
  if (url.includes('/@') || url.includes('/channel/') || url.includes('/c/') || url.includes('/user/')) {
    // console.log('[getYouTubeUrlType] Channel URL detected:', url);
    return 'channel';
  }

  // 플레이리스트 URL 패턴
  if (url.includes('/playlist?') || url.includes('&list=')) {
    // console.log('[getYouTubeUrlType] Playlist URL detected:', url);
    return 'playlist';
  }

  // 비디오 URL 패턴 (11자리 ID 확인)
  const videoPatterns = [
    /[?&]v=[\w-]{11}/,
    /youtu\.be\/[\w-]{11}/,
    /\/embed\/[\w-]{11}/,
    /\/shorts\/[\w-]{11}/,
  ];

  if (videoPatterns.some(pattern => pattern.test(url))) {
    // console.log('[getYouTubeUrlType] Video URL detected:', url);
    return 'video';
  }

  // console.log('[getYouTubeUrlType] Unknown URL type:', url);
  return 'unknown';
};

/**
 * YouTube 비디오 ID 추출 (TipTap 공식 패턴)
 */
export const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(YOUTUBE_REGEX);
  if (match && match[6]) {
    // console.log('[extractYouTubeVideoId] Found video ID:', match[6]);
    return match[6];
  }

  // console.log('[extractYouTubeVideoId] No video ID found in:', url);
  return null;
};

/**
 * YouTube 썸네일 URL 생성
 */
export const getYouTubeThumbnailUrl = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

/**
 * YouTube 썸네일 ID 생성
 */
export const generateYouTubeThumbnailId = (videoId: string): string => {
  return `${YOUTUBE_CONFIG.THUMBNAIL_PREFIX}${videoId}`;
};

/**
 * YouTube 썸네일 ID인지 확인
 */
export const isYouTubeThumbnailId = (id: string): boolean => {
  return id.startsWith(YOUTUBE_CONFIG.THUMBNAIL_PREFIX);
};

/**
 * YouTube 썸네일 ID에서 비디오 ID 추출
 */
export const extractVideoIdFromThumbnailId = (thumbnailId: string): string | null => {
  if (!isYouTubeThumbnailId(thumbnailId)) {
    return null;
  }
  return thumbnailId.replace(YOUTUBE_CONFIG.THUMBNAIL_PREFIX, '');
};

/**
 * YouTube embed URL 생성 (옵션 포함)
 */
export const createYouTubeEmbedUrl = (videoId: string, options: any = {}): string => {
  const params = [];
  
  if (options.startAt) params.push(`start=${options.startAt}`);
  if (options.endTime) params.push(`end=${options.endTime}`);
  if (options.autoplay) params.push('autoplay=1');
  if (options.controls === false) params.push('controls=0');
  if (options.loop) params.push('loop=1');
  if (options.modestBranding) params.push('modestbranding=1');
  if (options.playlist || options.loop) params.push(`playlist=${options.playlist || videoId}`);
  
  const nocookie = options.nocookie ? '-nocookie' : '';
  const paramString = params.length ? `?${params.join('&')}` : '';
  
  return `https://www.youtube${nocookie}.com/embed/${videoId}${paramString}`;
};

/**
 * YouTube URL 정규화 (원본 URL 반환)
 * TipTap YouTube extension은 원본 URL을 사용하고 내부적으로 embed URL로 변환
 */
export const normalizeYouTubeUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(ERROR_MESSAGES.YOUTUBE_PARSE_ERROR);
  }
  // 원본 형식의 URL 반환 (TipTap이 내부적으로 embed URL로 변환)
  return `https://www.youtube.com/watch?v=${videoId}`;
};

/**
 * YouTube 노드 속성 생성
 */
export const createYouTubeNodeAttrs = (url: string) => {
  // TipTap YouTube extension은 원본 URL을 사용
  const normalizedUrl = normalizeYouTubeUrl(url);
  
  return {
    src: normalizedUrl,  // 원본 URL 형식 사용
    width: YOUTUBE_CONFIG.DEFAULT_WIDTH,
    height: YOUTUBE_CONFIG.DEFAULT_HEIGHT,
  };
};