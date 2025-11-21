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

  // 백엔드 API 서버로 프록시 설정
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3000/api/v1/:path*',
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
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Next.js 16: serverComponentsExternalPackages를 루트 레벨로 이동
  serverExternalPackages: ['sharp'],

  transpilePackages: ['mermaid'],

  // Turbopack 설정 (Next.js 16 기본값)
  turbopack: {
    // Docker 환경에서 절대 경로로 명시적으로 워크스페이스 루트 지정
    root: process.cwd(),
    // Turbopack은 require.resolve() 절대 경로를 처리 못함 → 패키지명만 사용
    resolveAlias: {
      cytoscape: 'cytoscape',
    },
  },

  // Webpack 설정 (fallback - webpack 사용 시)
  webpack: (config) => {
    // Mermaid와 cytoscape 관련 문제 해결
    config.resolve.alias = {
      ...config.resolve.alias,
      cytoscape: 'cytoscape',
    };
    return config;
  },
};

module.exports = nextConfig;
