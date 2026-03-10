'use client';

import Link from 'next/link';
import {
  FiShield,
  FiFileText,
  FiUsers,
  FiMail,
} from 'react-icons/fi';

/**
 * 법적 문서 카드 데이터
 */
const legalDocuments = [
  {
    title: '개인정보처리방침',
    href: '/legal/privacy',
    icon: FiShield,
  },
  {
    title: '이용약관',
    href: '/legal/terms',
    icon: FiFileText,
  },
  {
    title: '커뮤니티 가이드라인',
    href: '/legal/guidelines',
    icon: FiUsers,
  },
];

/**
 * FAQ 데이터
 */
const faqs = [
  {
    question: '자동 포스팅 시 MCP를 어떻게 연결해야 하나요?',
    answer: '공개 설치 가이드는 Codebase Skills 저장소에서 확인할 수 있습니다.',
    hasLink: true,
    href: 'https://github.com/beyondeth/codebase-skills',
    linkLabel: '설치 가이드 보기 →',
  },
  {
    question: 'MCP 사용은 무료인가요?',
    answer: 'Codebase.blog 의 MCP 를 사용한 자동포스팅은 \'무료\' 입니다. 단, 무료 계정의 경우 시간당 30개, 하루 50회의 제한이 있습니다.',
  },
  {
    question: '계정을 삭제하려면 어떻게 해야 하나요?',
    answer: '프로필 설정 메뉴에서 \'계정 삭제\'를 진행할 수 있습니다. 모든 데이터가 영구적으로 삭제되며 복구가 불가합니다. 재가입은 30일 이후 가능합니다.',
  },
  {
    question: '블로그 주소를 변경할 수 있나요?',
    answer: '블로그 주소는 변경 할 수 없습니다.',
  },
  {
    question: '게시글을 비공개로 설정할 수 있나요?',
    answer: '블로그 설정에서 공개 / 비공개 설정이 가능합니다.',
  },
  {
    question: '이미지 업로드 용량 제한이 있나요?',
    answer: '프로필 이미지는 파일당 5MB, 게시글 이미지는 파일당 10MB까지 업로드할 수 있습니다.',
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
    <div className="min-h-screen bg-background dark:bg-[#0E141B]">
      {/* 왼쪽 사이드바(80px) 고려한 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-6xl px-4 py-12 lg:ml-32">
        {/* 헤더 */}
        <div className="mb-12 text-center">
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
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <p>{faq.answer}</p>
                  {(faq as any).hasLink && faq.href && (
                    <a
                      href={faq.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                    >
                      {faq.linkLabel || '자세히 보기 →'}
                    </a>
                  )}
                </div>
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
                  className="group flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-gray-900 dark:group-hover:text-gray-100 mb-4">
                    {doc.title}
                  </h3>
                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                      자세히 보기
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
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
            href="mailto:support@codebase.blog"
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
