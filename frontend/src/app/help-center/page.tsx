'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FiSearch, 
  FiBookOpen, 
  FiUsers, 
  FiShield, 
  FiTool,
  FiMessageCircle,
  FiHelpCircle,
  FiFileText,
  FiMail,
  FiCreditCard
} from 'react-icons/fi';

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articles: {
    title: string;
    link: string;
  }[];
}

export default function HelpCenterPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const categories: HelpCategory[] = [
    {
      id: 'getting-started',
      title: '시작하기',
      description: '블로그 만들기 및 기본 사용법',
      icon: <FiBookOpen className="w-6 h-6" />,
      articles: [
        { title: '블로그 만들기', link: '/help-center/docs?article=create-blog' },
        { title: '첫 글 작성하기', link: '/help-center/docs?article=first-post' },
        { title: '프로필 설정하기', link: '/help-center/docs?article=profile-setup' },
        { title: '블로그 커스터마이징', link: '/help-center/docs?article=customize' },
      ]
    },
    {
      id: 'policies',
      title: '정책 및 약관',
      description: '서비스 이용 약관 및 개인정보 보호',
      icon: <FiShield className="w-6 h-6" />,
      articles: [
        { title: '이용약관', link: '/help-center/docs?article=terms' },
        { title: '개인정보처리방침', link: '/help-center/docs?article=privacy' },
        { title: '저작권 정책', link: '/help-center/docs?article=copyright' },
        { title: '커뮤니티 가이드라인', link: '/help-center/docs?article=guidelines' },
      ]
    },
    {
      id: 'account',
      title: '계정 관리',
      description: '계정 설정 및 보안',
      icon: <FiUsers className="w-6 h-6" />,
      articles: [
        { title: '비밀번호 변경', link: '/help-center/docs?article=change-password' },
        { title: '이메일 변경', link: '/help-center/docs?article=change-email' },
        { title: '계정 삭제', link: '/help-center/docs?article=delete-account' },
        { title: '2단계 인증', link: '/help-center/docs?article=2fa' },
      ]
    },
    {
      id: 'writing',
      title: '글쓰기 및 편집',
      description: '콘텐츠 작성 도구 및 팁',
      icon: <FiFileText className="w-6 h-6" />,
      articles: [
        { title: '마크다운 가이드', link: '/help-center/docs?article=markdown' },
        { title: '이미지 업로드', link: '/help-center/docs?article=images' },
        { title: '글 예약 발행', link: '/help-center/docs?article=scheduling' },
        { title: '댓글 관리', link: '/help-center/docs?article=comments' },
      ]
    },
    {
      id: 'billing',
      title: '결제 및 요금',
      description: '요금제 및 결제 관련 정보',
      icon: <FiCreditCard className="w-6 h-6" />,
      articles: [
        { title: '요금제 비교', link: '/help-center/docs?article=plans' },
        { title: '결제 방법', link: '/help-center/docs?article=payment' },
        { title: '환불 정책', link: '/help-center/docs?article=refund' },
        { title: '영수증 다운로드', link: '/help-center/docs?article=receipts' },
      ]
    },
    {
      id: 'api',
      title: 'API 및 개발자',
      description: 'API 사용법 및 개발자 도구',
      icon: <FiTool className="w-6 h-6" />,
      articles: [
        { title: 'API 시작하기', link: '/help-center/docs?article=getting-started' },
        { title: 'API 키 관리', link: '/help-center/docs?article=api-keys' },
        { title: 'API 레퍼런스', link: '/help-center/docs?article=reference' },
        { title: '웹훅 설정', link: '/help-center/docs?article=webhooks' },
      ]
    }
  ];


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/help-center/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              무엇을 도와드릴까요?
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              MyBlog 사용에 대한 모든 답변을 찾아보세요
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="검색어를 입력하세요..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-6 py-4 pr-12 text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                >
                  <FiSearch className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">카테고리별 도움말</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center mb-4">
                <div className="text-gray-900">
                  {category.icon}
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">
                  {category.title}
                </h3>
              </div>
              <p className="text-gray-600 mb-4 text-sm">
                {category.description}
              </p>
              <ul className="space-y-2">
                {category.articles.map((article, index) => (
                  <li key={index}>
                    <Link
                      href={article.link}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              원하는 답변을 찾지 못하셨나요?
            </h2>
            <p className="text-gray-600 mb-8">
              언제든지 저희에게 문의해주세요. 최대한 빨리 답변 드리겠습니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/help-center/contact"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"
              >
                <FiMail className="w-5 h-5 mr-2" />
                문의하기
              </Link>
              <Link
                href="/help-center/faq"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <FiHelpCircle className="w-5 h-5 mr-2" />
                자주 묻는 질문
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}