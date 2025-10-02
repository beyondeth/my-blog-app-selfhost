'use client';

import Link from 'next/link';
import { 
  FiArrowLeft, 
  FiUsers, 
  FiTarget, 
  FiHeart,
  FiAward,
  FiTrendingUp,
  FiGlobe,
  FiZap,
  FiShield
} from 'react-icons/fi';

export default function AboutPage() {
  const stats = [
    { label: '활성 사용자', value: '10,000+', icon: <FiUsers /> },
    { label: '게시된 글', value: '50,000+', icon: <FiTrendingUp /> },
    { label: '일일 방문자', value: '100,000+', icon: <FiGlobe /> },
    { label: '서비스 가동률', value: '99.9%', icon: <FiZap /> },
  ];

  const values = [
    {
      icon: <FiHeart className="w-6 h-6" />,
      title: '사용자 중심',
      description: '사용자의 목소리에 귀 기울이며 더 나은 서비스를 만들어갑니다.'
    },
    {
      icon: <FiShield className="w-6 h-6" />,
      title: '신뢰와 투명성',
      description: '개인정보를 안전하게 보호하고 투명하게 운영합니다.'
    },
    {
      icon: <FiTarget className="w-6 h-6" />,
      title: '지속적인 혁신',
      description: '최신 기술을 활용하여 더 나은 글쓰기 경험을 제공합니다.'
    },
    {
      icon: <FiAward className="w-6 h-6" />,
      title: '품질 우선',
      description: '안정적이고 빠른 서비스로 최고의 사용자 경험을 보장합니다.'
    },
  ];

  const timeline = [
    { year: '2024', event: '서비스 기획 및 개발 시작' },
    { year: '2024.06', event: '베타 서비스 출시' },
    { year: '2024.09', event: '정식 서비스 오픈' },
    { year: '2025.01', event: '사용자 10,000명 돌파' },
    { year: '2025.02', event: 'API 서비스 출시 예정' },
    { year: '2025.03', event: '모바일 앱 출시 예정' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/help-center"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            고객센터로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">MyBlog 소개</h1>
          <p className="mt-2 text-gray-600">누구나 쉽게 이야기를 나눌 수 있는 블로그 플랫폼</p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              당신의 이야기를 세상에 전하세요
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              MyBlog는 글쓰기를 사랑하는 모든 사람들을 위한 플랫폼입니다.
              복잡한 설정 없이 바로 시작할 수 있으며, 당신의 생각과 경험을
              아름답게 표현할 수 있도록 도와드립니다.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl text-primary mb-2 flex justify-center">
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission Section */}
      <div className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">우리의 미션</h2>
              <p className="text-gray-600 mb-4">
                MyBlog는 모든 사람이 자신의 이야기를 자유롭게 표현하고 공유할 수 있는
                디지털 공간을 만들고자 합니다.
              </p>
              <p className="text-gray-600 mb-4">
                기술적 장벽을 낮추고, 글쓰기에만 집중할 수 있는 환경을 제공하여
                더 많은 사람들이 창작의 즐거움을 경험할 수 있도록 돕습니다.
              </p>
              <p className="text-gray-600">
                우리는 단순한 블로그 플랫폼을 넘어, 작가와 독자가 만나는
                지식과 경험의 교류 장소가 되고자 합니다.
              </p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">주요 기능</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">직관적인 마크다운 에디터</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">실시간 미리보기</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">자동 임시 저장</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">반응형 디자인</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">댓글 및 좋아요 시스템</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span className="text-gray-700">통계 및 분석 도구</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">우리의 가치</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 text-primary rounded-full mb-4">
                {value.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
              <p className="text-gray-600 text-sm">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">성장 과정</h2>
          <div className="max-w-3xl mx-auto">
            {timeline.map((item, index) => (
              <div key={index} className="flex items-start mb-8">
                <div className="flex-shrink-0">
                  <div className="w-4 h-4 bg-primary rounded-full mt-1.5"></div>
                  {index < timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-300 ml-1.5 mt-2"></div>
                  )}
                </div>
                <div className="ml-6">
                  <div className="text-sm text-primary font-semibold">{item.year}</div>
                  <div className="text-gray-700 mt-1">{item.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            당신의 첫 블로그를 만들고 이야기를 시작해보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary bg-background hover:bg-background/90 transition-colors"
            >
              무료로 시작하기
            </Link>
            <Link
              href="/help-center/getting-started"
              className="inline-flex items-center justify-center px-8 py-3 border border-primary-foreground text-base font-medium rounded-md text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              시작 가이드 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}