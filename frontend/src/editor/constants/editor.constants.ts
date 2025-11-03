/**
 * Rich Text Editor Constants
 * 에디터 관련 상수 정의
 */

// YouTube 관련 상수
export const YOUTUBE_CONFIG = {
  DEFAULT_WIDTH: 685,
  DEFAULT_HEIGHT: 540,
  THUMBNAIL_PREFIX: 'yt_thumb_',
  EMBED_URL_PATTERN: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  WATCH_URL_PATTERN: /(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
} as const;

// 이미지 업로드 관련 상수
export const IMAGE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES: 10, // 최대 10개 이미지
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB (10개 * 5MB)
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  API_ENDPOINT: '/api/v1/upload/image',
} as const;

// 에디터 메뉴 설정
export const EDITOR_MENU_CONFIG = {
  BUTTON_SIZE: 'w-10 h-10',
  ICON_SIZE: 'w-5 h-5',
  ACTIVE_CLASS: 'bg-gray-200',
  HOVER_CLASS: 'hover:bg-gray-100',
  DEFAULT_CLASS: 'p-2 rounded transition-colors duration-200',
} as const;

// 에디터 문서 설정
export const EDITOR_DOCUMENT_CONFIG = {
  PLACEHOLDER: '내용을 작성해주세요...',
  MIN_HEIGHT: 'min-h-[300px]',
  DEFAULT_CLASSES: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
} as const;

// 디바운스 설정
export const DEBOUNCE_DELAYS = {
  CONTENT_CHANGE: 300,
  IMAGE_MONITOR: 500,
  VALIDATION: 100,
} as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: (fileName: string, maxSize: number) => 
    `파일 크기가 너무 큽니다: ${fileName} (최대 ${maxSize / (1024 * 1024)}MB)`,
  INVALID_FILE_TYPE: (fileName: string) => 
    `지원하지 않는 파일 형식입니다: ${fileName}`,
  UPLOAD_FAILED: '이미지 업로드에 실패했습니다.',
  QUOTA_EXCEEDED: (totalSize: number, maxSize: number) => 
    `총 파일 크기가 제한을 초과합니다 (${totalSize / (1024 * 1024)}MB / ${maxSize / (1024 * 1024)}MB)`,
  YOUTUBE_PARSE_ERROR: 'YouTube URL을 파싱할 수 없습니다.',
} as const;

// 성공 메시지
export const SUCCESS_MESSAGES = {
  IMAGE_UPLOADED: '이미지가 성공적으로 업로드되었습니다.',
  YOUTUBE_ADDED: 'YouTube 동영상이 추가되었습니다.',
  CONTENT_SAVED: '내용이 저장되었습니다.',
} as const;