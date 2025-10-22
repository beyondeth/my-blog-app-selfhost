/** @type {import('next').NextConfig} */
const nextConfig = {
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
        hostname: 'd1y66zmnw3oigo.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'myblogdata84.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'myblogdata84.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/myblogdata84/**',
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
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  transpilePackages: ['mermaid'],
  webpack: (config) => {
    // Mermaid와 cytoscape 관련 문제 해결
    config.resolve.alias = {
      ...config.resolve.alias,
      'cytoscape': require.resolve('cytoscape'),
    };
    return config;
  },
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://d1y66zmnw3oigo.cloudfront.net' : undefined,
};

module.exports = nextConfig;
