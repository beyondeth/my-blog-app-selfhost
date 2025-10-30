'use client';

import { useRouter } from 'next/navigation';

/**
 * Writing Styles 가이드 목록 페이지
 *
 * MCP 자동포스팅 시 사용할 수 있는 다양한 글쓰기 스타일 템플릿 소개
 */

interface StyleGuide {
  id: string;
  name: string;
  description: string;
}

const WRITING_STYLES: StyleGuide[] = [
  {
    id: 'default',
    name: 'Default',
    description: '전문적인 기술 블로그 스타일. 명확하고 구조화된 설명과 코드 예제를 포함합니다.',
  },
  {
    id: 'novel',
    name: 'Novel',
    description: '서사적인 스토리텔링 스타일. 생생한 묘사와 감정적 여정을 담아 독자를 몰입시킵니다.',
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    description: '단계별 튜토리얼 스타일. 초보자도 따라할 수 있도록 상세한 가이드와 검증 단계를 제공합니다.',
  },
  {
    id: 'comedy',
    name: 'Comedy',
    description: '유머러스한 경험 공유 스타일. 자조적이고 공감 가는 개발자 경험을 재치있게 전달합니다.',
  },
  {
    id: 'podcast',
    name: 'Podcast',
    description: '대화형 팟캐스트 스타일. 음성으로 듣기 좋게 구성되며 시각적 요소에 의존하지 않습니다.',
  },
  {
    id: '_common',
    name: 'Common Rules',
    description: '모든 스타일에 공통으로 적용되는 기본 규칙과 가이드라인입니다.',
  },
];

export default function WritingStylesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3">
            Writing Styles 가이드
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl">
            LLM과의 대화에서 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded text-sm font-mono">--flag</code>를 추가하여 원하는 스타일로 자동 포스팅할 수 있습니다.
          </p>
        </div>
      </section>

      {/* 컨테이너 */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 기본 사용법 섹션 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            기본 사용법
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            LLM과의 대화 중에 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-sm font-mono rounded">--flag</code>를 추가하여 원하는 스타일을 지정할 수 있습니다.
            플래그를 생략하면 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-sm font-mono rounded">--default</code>가 기본 적용되지만, 명시하는 것을 권장합니다.
          </p>

          {/* 플래그 목록 */}
          <div className="space-y-4 mb-6">
            <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-4">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--default</code>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">(기본값)</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                전문적인 기술 블로그 스타일. 명확하고 구조화된 설명.
              </p>
            </div>

            <div className="border-l-2 border-gray-300 dark:border-gray-700 pl-4">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--novel</code>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                서사적인 스토리텔링. 생생한 묘사와 감정적 여정.
              </p>
            </div>

            <div className="border-l-2 border-gray-300 dark:border-gray-700 pl-4">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--tutorial</code>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                단계별 튜토리얼. 초보자도 따라할 수 있는 가이드.
              </p>
            </div>

            <div className="border-l-2 border-gray-300 dark:border-gray-700 pl-4">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--comedy</code>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                유머러스한 경험 공유. 재치있는 개발자 이야기.
              </p>
            </div>

            <div className="border-l-2 border-gray-300 dark:border-gray-700 pl-4">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--podcast</code>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                대화형 팟캐스트. 음성으로 듣기 좋은 스타일.
              </p>
            </div>
          </div>

          {/* 사용 예시 */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">예시</p>
            <div className="space-y-2">
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                "위 내용 자동 포스팅해줘 --default"
              </div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                "이 주제로 소설 스타일로 작성해줘 --novel"
              </div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                "초보자를 위한 가이드로 작성해줘 --tutorial"
              </div>
            </div>
          </div>
        </section>

        {/* 스타일 가이드 목록 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            스타일 가이드
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            각 스타일의 상세 가이드를 확인하고 마크다운을 복사할 수 있습니다.
          </p>
          <div className="space-y-3">
            {WRITING_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => router.push(`/docs/writing-styles/${style.id}`)}
                className="w-full text-left p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {style.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {style.description}
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-600">→</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 커스터마이징 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            커스터마이징
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            제공되는 5가지 스타일은 시작점입니다. 각 스타일 가이드를 복사하여 로컬에 .md 파일로 저장한 뒤,
            YAML frontmatter와 규칙을 수정하여 나만의 스타일을 만들 수 있습니다.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            사용 예시: "이 커스텀 스타일 가이드 + 위 내용을 참고해서 자동포스팅해줘"
          </p>
        </section>

        {/* 주의사항 */}
        <section className="mb-12 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            주의사항
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>
              • 가끔 LLM이 플래그를 인식하지 못할 수 있습니다. 이럴 때는 "자동 포스팅" 또는 "자동포스팅" 키워드를 명확히 포함시켜 주세요.
            </li>
            <li>
              • 플래그 앞뒤로 공백이 있는지 확인하세요. (올바른 예: <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">--default</code>)
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
