/**
 * 피드 레이아웃 유틸리티
 *
 * @description
 * Reddit 스타일 피드 레이아웃을 결정하는 공통 유틸리티.
 * - 이미지가 있으면 이미지 중심 레이아웃 (제목 + 큰 이미지)
 * - 이미지가 없으면 텍스트 중심 레이아웃 (제목 + excerpt)
 * - YouTube 썸네일은 비디오 중심 레이아웃 (YouTube 임베드)
 */

// 레이아웃 타입 정의
export type FeedLayoutType = 'image-focused' | 'text-focused' | 'video-focused';

// 레이아웃 결정에 필요한 입력 인터페이스
export interface FeedLayoutInput {
  thumbnail?: string | null;
  excerpt?: string | null;
  content?: string | null;
  youtubeVideoId?: string | null;
}

/**
 * YouTube 썸네일인지 확인
 *
 * @param url - 확인할 URL
 * @returns YouTube 썸네일 여부
 */
export function isYouTubeThumbnail(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('youtube.com') ||
    url.includes('ytimg.com') ||
    url.includes('youtu.be') ||
    url.includes('img.youtube.com') ||
    url.includes('i.ytimg.com')
  );
}

/**
 * YouTube 비디오 ID 추출
 *
 * @description
 * 다양한 YouTube 썸네일 URL 패턴에서 비디오 ID(11자리) 추출
 *
 * @param url - YouTube 썸네일 URL
 * @returns 11자리 비디오 ID 또는 null
 */
export function extractYouTubeVideoId(url: string): string | null {
  // YouTube 썸네일 URL 패턴들
  const patterns = [
    // img.youtube.com/vi/{videoId}/...
    /(?:https?:\/\/)?img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/,
    // i.ytimg.com/vi/{videoId}/...
    /(?:https?:\/\/)?i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/,
    // /vi/{videoId}/... (상대 경로)
    /\/vi\/([a-zA-Z0-9_-]{11})/,
    // i3.ytimg.com/vi/{videoId}/... (CDN 변형)
    /(?:https?:\/\/)?i[0-9]\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/,
    // youtube watch/shorts/short URL
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // fallback: YouTube 도메인 URL에서 11자리 연속 문자열 추출
  if (isYouTubeThumbnail(url)) {
    // /vi/ 이후의 11자리 추출 시도
    const viMatch = url.match(/\/vi\/([a-zA-Z0-9_-]{11})/);
    if (viMatch?.[1]) {
      return viMatch[1];
    }
  }

  return null;
}

/**
 * 콘텐츠에 YouTube 임베드가 포함되어 있는지 확인
 */
export function hasYouTubeEmbed(content: string | null | undefined): boolean {
  if (!content) return false;

  return (
    /<div[^>]*data-youtube-video[^>]*>/i.test(content) ||
    /<iframe[^>]*src="https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[^"]+"/i.test(content)
  );
}

/**
 * HTML 콘텐츠에서 YouTube 비디오 ID 추출
 */
export function extractYouTubeVideoIdFromContent(
  content: string | null | undefined,
): string | null {
  if (!content) return null;

  const embedMatch = content.match(
    /https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
  );
  if (embedMatch?.[1]) {
    return embedMatch[1];
  }

  const originalUrlMatch = content.match(
    /data-original-url=["']([^"']+)["']/i,
  );
  if (originalUrlMatch?.[1]) {
    const urlMatch = originalUrlMatch[1].match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    );
    if (urlMatch?.[1]) return urlMatch[1];
  }

  const urlFallback = content.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return urlFallback?.[1] ?? null;
}

/**
 * 피드 레이아웃 타입 결정
 *
 * @description
 * 포스트의 썸네일 유무에 따라 레이아웃 타입 결정:
 * - 썸네일 없음 → 텍스트 중심 (제목 + excerpt)
 * - YouTube 썸네일 → 비디오 중심 (YouTube 임베드)
 * - 일반 썸네일 → 이미지 중심 (제목 + 큰 이미지)
 *
 * @param input - 레이아웃 결정에 필요한 포스트 정보
 * @returns 레이아웃 타입
 */
export function determineFeedLayout(input: FeedLayoutInput): FeedLayoutType {
  const { thumbnail, content, youtubeVideoId } = input;

  // 썸네일이 없으면 텍스트 중심 레이아웃
  if (!thumbnail) {
    // 콘텐츠에 YouTube 임베드가 있으면 비디오 중심 레이아웃
    if (youtubeVideoId || hasYouTubeEmbed(content)) {
      return 'video-focused';
    }
    return 'text-focused';
  }

  // YouTube 썸네일이면 비디오 중심 레이아웃
  if (isYouTubeThumbnail(thumbnail)) {
    return 'video-focused';
  }

  // 썸네일이 일반 이미지더라도 본문에 YouTube가 있으면 비디오 레이아웃 우선
  if (youtubeVideoId || hasYouTubeEmbed(content)) {
    return 'video-focused';
  }

  // 일반 썸네일은 이미지 중심 레이아웃
  return 'image-focused';
}

/**
 * 이미지 중심 레이아웃 사용 여부 (간편 함수)
 *
 * @param input - 레이아웃 결정에 필요한 포스트 정보
 * @returns 이미지 중심 레이아웃 사용 여부
 */
export function shouldUseImageFocusedLayout(input: FeedLayoutInput): boolean {
  return determineFeedLayout(input) === 'image-focused';
}

/**
 * 비디오 중심 레이아웃 사용 여부 (간편 함수)
 *
 * @param input - 레이아웃 결정에 필요한 포스트 정보
 * @returns 비디오 중심 레이아웃 사용 여부
 */
export function shouldUseVideoFocusedLayout(input: FeedLayoutInput): boolean {
  return determineFeedLayout(input) === 'video-focused';
}

/**
 * 콘텐츠에 업로드된 비디오가 포함되어 있는지 확인
 *
 * @description
 * VideoEmbed extension으로 삽입된 비디오를 감지합니다.
 * - <figure data-video-embed> 구조
 * - <video data-video-id> 태그
 *
 * @param content - HTML 콘텐츠
 * @returns 비디오 포함 여부
 */
export function hasVideoEmbed(content: string | null | undefined): boolean {
  if (!content) return false;

  // VideoEmbed extension에서 생성하는 패턴
  return (
    /<figure[^>]*data-video-embed/i.test(content) ||
    /<video[^>]*data-video-id/i.test(content)
  );
}

/**
 * 콘텐츠에서 첫 번째 비디오 URL 추출
 *
 * @description
 * video 태그 또는 figure[data-video-embed] 태그에서 src 추출
 * mergeAttributes로 인해 src가 figure 태그에 있을 수도 있음
 *
 * @param content - HTML 콘텐츠
 * @returns 비디오 URL 또는 null
 */
export function extractFirstVideoSrc(content: string | null | undefined): string | null {
  if (!content) return null;

  // 1순위: video 태그에서 src 추출
  const videoMatch = content.match(/<video[^>]*\bsrc="([^"]*)"/i);
  if (videoMatch) return videoMatch[1];

  // 2순위: figure[data-video-embed] 태그에서 src 추출
  const figureMatch = content.match(/<figure[^>]*data-video-embed[^>]*\bsrc="([^"]*)"/i);
  if (figureMatch) return figureMatch[1];

  return null;
}

/**
 * 콘텐츠에서 첫 번째 비디오 ID 추출
 *
 * @param content - HTML 콘텐츠
 * @returns 비디오 ID 또는 null
 */
export function extractFirstVideoId(content: string | null | undefined): string | null {
  if (!content) return null;

  // data-video-id 속성에서 비디오 ID 추출
  const match = content.match(/data-video-id="([^"]*)"/i);
  return match ? match[1] : null;
}
