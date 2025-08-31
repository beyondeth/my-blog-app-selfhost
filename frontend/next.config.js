/** @type {import('next').NextConfig} */
const nextConfig = {
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
    domains: [
      'd1y66zmnw3oigo.cloudfront.net', // CloudFront CDN
      'myblogdata84.s3.amazonaws.com', // S3 글로벌 도메인
      'myblogdata84.s3.us-east-1.amazonaws.com', // S3 리전 도메인 (추가)
      'lh3.googleusercontent.com', // Google 프로필 이미지
      'localhost'
    ],
    remotePatterns: [
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
    ],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://d1y66zmnw3oigo.cloudfront.net' : undefined,
};

module.exports = nextConfig;
