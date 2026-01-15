import { registerAs } from "@nestjs/config";

export default registerAs("cdn", () => ({
  // CDN 설정 (Cloudflare)
  enabled: process.env.CDN_ENABLED === "true",
  domain: process.env.CDN_DOMAIN || "",

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
}));
