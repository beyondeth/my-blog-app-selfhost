'use client';

import Link from 'next/link';
import {
  FiShield,
  FiFileText,
  FiUsers,
  FiAward,
  FiDollarSign,
  FiAtSign,
  FiMail,
  FiHelpCircle,
} from 'react-icons/fi';

/**
 * 법적 문서 카드 데이터
 */
const legalDocuments = [
  {
    title: '개인정보처리방침',
    description: '개인정보 수집 및 이용에 관한 방침을 확인하세요.',
    href: '/legal/privacy',
    icon: FiShield,
  },
  {
    title: '이용약관',
    description: 'DevLog 서비스 이용약관을 확인하세요.',
    href: '/legal/terms',
    icon: FiFileText,
  },
  {
    title: '커뮤니티 가이드라인',
    description: '커뮤니티 규칙과 가이드라인을 확인하세요.',
    href: '/legal/guidelines',
    icon: FiUsers,
  },
  {
    title: '파트너 프로그램',
    description: 'DevLog 파트너 프로그램에 대해 알아보세요.',
    href: '/legal/partner',
    icon: FiAward,
  },
  {
    title: '프로 약관',
    description: 'DevLog Pro 구독 약관을 확인하세요.',
    href: '/legal/pro',
    icon: FiDollarSign,
  },
  {
    title: '사용자명 정책',
    description: '사용자명 및 블로그 주소 정책을 확인하세요.',
    href: '/legal/username',
    icon: FiAtSign,
  },
];

/**
 * FAQ 데이터
 */
const faqs = [
  {
    question: '계정을 삭제하려면 어떻게 해야 하나요?',
    answer: '설정 > 보안 메뉴에서 계정 삭제를 진행할 수 있습니다. 계정 삭제 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
  },
  {
    question: '블로그 주소를 변경할 수 있나요?',
    answer: '네, 설정 > 블로그 설정 메뉴에서 블로그 주소(slug)를 변경할 수 있습니다. 단, 블로그 주소는 고유해야 하며, 사용자명 정책을 준수해야 합니다.',
  },
  {
    question: '게시글을 비공개로 설정할 수 있나요?',
    answer: '네, 게시글 작성 시 공개 범위를 설정할 수 있습니다. 전체 공개, 로그인 사용자만, 비공개 중 선택할 수 있습니다.',
  },
  {
    question: '이미지 업로드 용량 제한이 있나요?',
    answer: '무료 계정은 파일당 5MB, Pro 계정은 파일당 20MB까지 업로드할 수 있습니다. 총 저장 용량은 무료 계정 1GB, Pro 계정 100GB입니다.',
  },
  {
    question: 'DevLog Pro를 구독하면 어떤 혜택이 있나요?',
    answer: '더 큰 이미지 업로드 용량, 고급 통계 기능, 커스텀 도메인 연결, 광고 제거 등의 혜택을 받을 수 있습니다. 자세한 내용은 요금제 페이지를 확인해주세요.',
  },
  {
    question: '신고된 콘텐츠는 어떻게 처리되나요?',
    answer: '신고된 콘텐츠는 관리자가 검토하여 커뮤니티 가이드라인 위반 여부를 판단합니다. 위반이 확인되면 콘텐츠 삭제, 경고, 계정 정지 등의 조치가 취해집니다.',
  },
];

/**
 * 고객센터 페이지
 */
export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 왼쪽 사이드바(80px) 고려한 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-6xl px-4 py-12 lg:ml-32">
        {/* 헤더 */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center">
            <FiHelpCircle className="h-12 w-12 text-gray-700 dark:text-gray-300" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-foreground">고객센터</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            무엇을 도와드릴까요? 자주 묻는 질문과 법적 문서를 확인하세요.
          </p>
        </div>

        {/* FAQ 섹션 */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-foreground">자주 묻는 질문 (FAQ)</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all hover:border-gray-300 dark:hover:border-gray-600"
              >
                <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground">
                  <span className="text-base">{faq.question}</span>
                  <svg
                    className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* 법적 문서 섹션 */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-foreground">법적 문서 및 정책</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legalDocuments.map((doc) => {
              const Icon = doc.icon;
              return (
                <Link
                  key={doc.href}
                  href={doc.href}
                  className="group block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {doc.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 문의하기 섹션 */}
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <FiMail className="h-10 w-10 text-gray-700 dark:text-gray-300" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-foreground">더 궁금한 사항이 있으신가요?</h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            FAQ에서 답을 찾지 못하셨다면 언제든지 문의해주세요.
          </p>
          <a
            href="mailto:support@devlog.com"
            className="inline-flex items-center gap-2 rounded-lg bg-black dark:bg-white text-white dark:text-black px-6 py-3 font-medium transition-colors hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <FiMail className="h-5 w-5" />
            이메일로 문의하기
          </a>
        </section>

        {/* Back to Top 버튼 */}
        <div className="mt-12 text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
            맨 위로
          </button>
        </div>
      </div>
    </div>
  );
}
