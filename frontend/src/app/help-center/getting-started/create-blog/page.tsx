'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FiArrowLeft, 
  FiChevronRight,
  FiClock,
  FiBookOpen,
  FiCode,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiCopy,
  FiCheck
} from 'react-icons/fi';

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

export default function CreateBlogArticlePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const sections: Section[] = [
    {
      id: 'overview',
      title: '개요',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">
            MyBlog에서 블로그를 만드는 것은 매우 간단합니다. 몇 번의 클릭만으로 
            당신만의 블로그를 시작할 수 있으며, 바로 글을 작성하고 공유할 수 있습니다.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <FiInfo className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>알아두세요</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  현재 계정당 하나의 블로그만 생성할 수 있습니다. 
                  블로그 URL은 생성 후 변경할 수 없으니 신중하게 선택해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'requirements',
      title: '사전 요구사항',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">블로그를 만들기 전에 다음 사항을 확인하세요:</p>
          <ul className="space-y-2">
            <li className="flex items-start">
              <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="ml-3 text-gray-700">MyBlog 계정이 있어야 합니다</span>
            </li>
            <li className="flex items-start">
              <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="ml-3 text-gray-700">이메일 인증이 완료되어 있어야 합니다</span>
            </li>
            <li className="flex items-start">
              <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="ml-3 text-gray-700">블로그 이름과 URL을 미리 정해두세요</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'step-by-step',
      title: '단계별 가이드',
      content: (
        <div className="space-y-6">
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-semibold">
                1
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">로그인하기</h4>
                <p className="text-gray-700 mb-3">
                  MyBlog 계정으로 로그인합니다. 계정이 없다면 먼저 회원가입을 진행하세요.
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <code className="text-sm text-gray-800">
                    홈페이지 → 로그인 버튼 클릭 → 이메일/비밀번호 입력
                  </code>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-semibold">
                2
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">블로그 생성 페이지로 이동</h4>
                <p className="text-gray-700 mb-3">
                  상단 메뉴에서 "블로그 만들기" 버튼을 클릭하거나 프로필 메뉴에서 접근합니다.
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <code className="text-sm text-gray-800">
                    URL: /blog/new
                  </code>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">블로그 정보 입력</h4>
                <p className="text-gray-700 mb-3">
                  블로그 생성 폼에 다음 정보를 입력합니다:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li>• <strong>블로그 이름</strong>: 블로그 상단에 표시될 이름</li>
                  <li>• <strong>블로그 URL (slug)</strong>: myblog.com/blog/[your-slug] 형태의 주소</li>
                  <li>• <strong>블로그 설명</strong>: 블로그를 소개하는 간단한 문구 (선택사항)</li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-semibold">
                4
              </div>
              <div className="ml-4 flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">블로그 생성 완료</h4>
                <p className="text-gray-700 mb-3">
                  "블로그 만들기" 버튼을 클릭하면 블로그가 생성되고 자동으로 블로그 홈으로 이동합니다.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <p className="ml-3 text-sm text-green-800">
                      축하합니다! 이제 첫 글을 작성할 준비가 되었습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'url-guidelines',
      title: 'URL 선택 가이드',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            블로그 URL(slug)은 블로그의 고유 주소가 되며, 한 번 설정하면 변경할 수 없습니다.
            다음 가이드라인을 참고하여 신중하게 선택하세요:
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">✅ 권장사항</h4>
            <ul className="space-y-2 text-gray-700">
              <li>• 짧고 기억하기 쉬운 URL</li>
              <li>• 영문 소문자와 하이픈(-) 사용</li>
              <li>• 블로그 주제를 나타내는 단어</li>
              <li>• 개인 브랜드나 닉네임 활용</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">❌ 피해야 할 것</h4>
            <ul className="space-y-2 text-gray-700">
              <li>• 특수문자나 공백 (사용 불가)</li>
              <li>• 너무 긴 URL (15자 이내 권장)</li>
              <li>• 숫자만으로 구성된 URL</li>
              <li>• 타인의 상표나 브랜드명</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">좋은 예시:</p>
            <code className="text-sm text-gray-700">
              tech-blog, daily-life, john-doe, creative-corner
            </code>
          </div>
        </div>
      )
    },
    {
      id: 'after-creation',
      title: '블로그 생성 후',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            블로그를 성공적으로 생성한 후 다음 단계를 진행할 수 있습니다:
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/help-center/getting-started/first-post" 
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-900 mb-2">첫 글 작성하기</h4>
              <p className="text-sm text-gray-600">
                마크다운을 사용하여 첫 번째 글을 작성하는 방법을 알아보세요.
              </p>
            </Link>
            
            <Link href="/help-center/getting-started/profile-setup"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-900 mb-2">프로필 설정하기</h4>
              <p className="text-sm text-gray-600">
                프로필 사진과 자기소개를 추가하여 블로그를 개인화하세요.
              </p>
            </Link>
            
            <Link href="/help-center/getting-started/customize"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-900 mb-2">블로그 커스터마이징</h4>
              <p className="text-sm text-gray-600">
                블로그 디자인과 설정을 변경하는 방법을 배워보세요.
              </p>
            </Link>
            
            <Link href="/help-center/writing/markdown"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-900 mb-2">마크다운 가이드</h4>
              <p className="text-sm text-gray-600">
                마크다운 문법을 익혀 더 풍부한 콘텐츠를 작성하세요.
              </p>
            </Link>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: '문제 해결',
      content: (
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">
                "이미 블로그가 존재합니다" 오류
              </h4>
              <p className="text-gray-700 text-sm mb-2">
                계정당 하나의 블로그만 생성할 수 있습니다. 이미 블로그를 만드셨다면 
                프로필 메뉴에서 "내 블로그"를 클릭하여 접근할 수 있습니다.
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">
                "URL이 이미 사용 중입니다" 오류
              </h4>
              <p className="text-gray-700 text-sm mb-2">
                선택한 URL이 다른 사용자에 의해 이미 사용되고 있습니다. 
                다른 URL을 선택해주세요.
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">
                "이메일 인증이 필요합니다" 오류
              </h4>
              <p className="text-gray-700 text-sm mb-2">
                블로그를 만들기 전에 이메일 인증을 완료해야 합니다. 
                이메일함을 확인하고 인증 링크를 클릭해주세요.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <FiAlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-amber-800">
                  <strong>도움이 필요하신가요?</strong>
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  문제가 계속되면{' '}
                  <Link href="/help-center/contact" className="underline font-medium">
                    고객센터에 문의
                  </Link>
                  해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    // Scroll to section when hash changes
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setActiveSection(hash);
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="뒤로가기"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>
              <nav className="flex items-center text-sm">
                <Link href="/help-center" className="text-gray-600 hover:text-gray-900">
                  고객센터
                </Link>
                <FiChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <Link href="/help-center#getting-started" className="text-gray-600 hover:text-gray-900">
                  시작하기
                </Link>
                <FiChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <span className="text-gray-900 font-medium">블로그 만들기</span>
              </nav>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <FiClock className="w-4 h-4 mr-1" />
              <span>5분 소요</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">목차</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveSection(section.id);
                      document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`block py-2 px-3 text-sm rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-amber-50 text-amber-700 font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-3xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">블로그 만들기</h1>
              <p className="text-lg text-gray-600">
                MyBlog에서 나만의 블로그를 만들고 이야기를 시작하세요
              </p>
            </header>

            <div className="space-y-12">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    {section.title}
                  </h2>
                  {section.content}
                </section>
              ))}
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <Link
                  href="/help-center"
                  className="inline-flex items-center text-gray-600 hover:text-gray-900"
                >
                  <FiArrowLeft className="w-4 h-4 mr-2" />
                  고객센터 홈
                </Link>
                <Link
                  href="/help-center/getting-started/first-post"
                  className="inline-flex items-center text-amber-600 hover:text-amber-700 font-medium"
                >
                  다음: 첫 글 작성하기
                  <FiChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          </main>

          {/* Right Sidebar - Related Articles */}
          <aside className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">관련 문서</h3>
              <nav className="space-y-2">
                <Link
                  href="/help-center/getting-started/first-post"
                  className="block text-sm text-gray-600 hover:text-gray-900"
                >
                  첫 글 작성하기
                </Link>
                <Link
                  href="/help-center/getting-started/profile-setup"
                  className="block text-sm text-gray-600 hover:text-gray-900"
                >
                  프로필 설정하기
                </Link>
                <Link
                  href="/help-center/getting-started/customize"
                  className="block text-sm text-gray-600 hover:text-gray-900"
                >
                  블로그 커스터마이징
                </Link>
                <Link
                  href="/help-center/faq"
                  className="block text-sm text-gray-600 hover:text-gray-900"
                >
                  자주 묻는 질문
                </Link>
              </nav>

              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <FiBookOpen className="w-5 h-5 text-gray-600 mb-2" />
                <p className="text-sm font-medium text-gray-900 mb-1">도움이 필요하신가요?</p>
                <p className="text-xs text-gray-600 mb-3">
                  24시간 이내에 답변 드립니다
                </p>
                <Link
                  href="/help-center/contact"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  문의하기 →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}