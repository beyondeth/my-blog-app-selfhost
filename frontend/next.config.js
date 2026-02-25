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
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3000/api/v1'}/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.codebase.blog',
        port: '',
        pathname: '/**',
      },
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
        protocol: 'https',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com',
        port: '',
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
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Next.js 16: serverComponentsExternalPackages를 루트 레벨로 이동
  serverExternalPackages: ['sharp'],
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
