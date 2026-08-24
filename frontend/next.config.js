const configuredCdnUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL;
let configuredCdnPattern = null;

if (configuredCdnUrl) {
  try {
    const parsed = new URL(configuredCdnUrl);
    configuredCdnPattern = {
      protocol: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: '/**',
    };
  } catch {
    // Invalid optional CDN URLs are handled by the backend proxy instead.
  }
}

const configuredImagePatterns = [
  process.env.NEXT_PUBLIC_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL,
]
  .map((value) => {
    if (!value) return null;

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;

      return {
        protocol: parsed.protocol.replace(':', ''),
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: '/**',
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const configuredObjectStorageRegion = process.env.NEXT_PUBLIC_OBJECT_STORAGE_REGION?.trim();
const configuredObjectStorageOrigin = configuredObjectStorageRegion && /^[a-z0-9-]+$/.test(configuredObjectStorageRegion)
  ? `https://*.compat.objectstorage.${configuredObjectStorageRegion}.oraclecloud.com`
  : null;

const configuredOrigins = [
  process.env.NEXT_PUBLIC_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL,
  process.env.NEXT_PUBLIC_CDN_BASE_URL,
  process.env.NEXT_PUBLIC_MCP_BASE_URL,
  configuredObjectStorageOrigin,
]
  .map((value) => {
    if (!value) return null;
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const connectSources = new Set(["'self'", ...configuredOrigins]);
connectSources.add('https://cdn.jsdelivr.net');
for (const origin of configuredOrigins) {
  const parsed = new URL(origin);
  if (parsed.protocol === 'http:') connectSources.add(`ws://${parsed.host}`);
  if (parsed.protocol === 'https:') connectSources.add(`wss://${parsed.host}`);
}
if (process.env.NODE_ENV !== 'production') {
  connectSources.add('http://localhost:*');
  connectSources.add('ws://localhost:*');
  connectSources.add('http://127.0.0.1:*');
  connectSources.add('ws://127.0.0.1:*');
}
if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
  connectSources.add('https://*.mixpanel.com');
}
if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
  connectSources.add('https://www.google-analytics.com');
  connectSources.add('https://*.google-analytics.com');
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  `connect-src ${[...connectSources].join(' ')}`,
  "worker-src 'self' blob:",
  process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone 빌드 모드 (Docker 최적화: 메모리 49% 절감)
  output: 'standalone',

  // 프로덕션 빌드 최적화: console 제거
  // error와 warn은 유지 (중요 에러 추적용)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  // 301 리다이렉트 설정 (SEO 호환성)
  async redirects() {
    return [
      // 커뮤니티 포스트: /posts/ → /comments/ (Reddit 스타일)
      {
        source: '/c/:slug/posts/:postId',
        destination: '/c/:slug/comments/:postId',
        permanent: true, // 301 리다이렉트
      },
      // 커뮤니티 포스트 수정 페이지도 리다이렉트
      {
        source: '/c/:slug/posts/:postId/edit',
        destination: '/c/:slug/comments/:postId/edit',
        permanent: true,
      },
    ];
  },

  // 백엔드 API 서버로 프록시 설정
  async rewrites() {
    const backendInternalUrl = process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3000';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendInternalUrl.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },

  images: {
    // UUID 기반 업로드 키는 불변이므로 변환 결과를 장기 재사용한다.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      configuredCdnPattern,
      ...configuredImagePatterns,
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
    ].filter(Boolean),
    formats: ['image/webp', 'image/avif'],
  },

  // Next.js 16: serverComponentsExternalPackages를 루트 레벨로 이동
  serverExternalPackages: ['sharp'],
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
