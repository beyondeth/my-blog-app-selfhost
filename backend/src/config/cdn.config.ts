import { registerAs } from '@nestjs/config';

export default registerAs('cdn', () => ({
  // CloudFront 또는 다른 CDN 설정
  enabled: process.env.CDN_ENABLED === 'true',
  domain: process.env.CDN_DOMAIN || '',
  distributionId: process.env.CDN_DISTRIBUTION_ID || '',
  
  // 캐싱 설정
  cache: {
    // 이미지 캐시 설정 (1년)
    images: {
      maxAge: 31536000,
      sMaxAge: 31536000,
      staleWhileRevalidate: 86400,
    },
    // 썸네일 캐시 설정 (1개월)
    thumbnails: {
      maxAge: 2592000,
      sMaxAge: 2592000,
      staleWhileRevalidate: 86400,
    },
    // 문서 캐시 설정 (1주일)
    documents: {
      maxAge: 604800,
      sMaxAge: 604800,
      staleWhileRevalidate: 3600,
    },
  },
  
  // 이미지 변환 설정 (CloudFront Functions 또는 Lambda@Edge)
  imageTransform: {
    enabled: process.env.CDN_IMAGE_TRANSFORM === 'true',
    formats: ['webp', 'avif'],
    quality: {
      default: 85,
      thumbnail: 70,
      preview: 60,
    },
    sizes: {
      thumbnail: { width: 150, height: 150 },
      small: { width: 320, height: 240 },
      medium: { width: 640, height: 480 },
      large: { width: 1280, height: 960 },
      full: { width: 1920, height: 1440 },
    },
  },
  
  // 보안 설정
  security: {
    signedUrls: process.env.CDN_SIGNED_URLS === 'true',
    signedCookies: process.env.CDN_SIGNED_COOKIES === 'true',
    keyPairId: process.env.CDN_KEY_PAIR_ID || '',
    privateKey: process.env.CDN_PRIVATE_KEY || '',
  },
  
  // 지역별 엣지 설정
  edges: {
    // 주요 지역 엣지 서버
    primary: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
    // 보조 지역
    secondary: ['us-west-2', 'eu-central-1', 'ap-southeast-1'],
  },
  
  // 비용 최적화
  costOptimization: {
    // 자주 액세스하지 않는 파일 S3 Glacier로 이동
    archiveAfterDays: 180,
    // 삭제 예정 파일 S3 Lifecycle 규칙
    deleteAfterDays: 365,
    // 요청 비용 최적화
    compressionEnabled: true,
    minCompressionSize: 1024, // 1KB 이상만 압축
  },
}));