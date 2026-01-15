'use client';

import { useRouter } from 'next/navigation';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PAGE_WRAPPER,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';

/**
 * Writing Styles 가이드 목록 페이지
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
    id: 'vibe',
    name: 'Vibe',
    description: '개발자 학습 가이드 스타일. 선임 개발자가 후임에게 조언하는 멘토링 톤으로 학습 방법론과 성장 마인드셋을 다룹니다.',
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
    <div className={`${SETTINGS_PAGE_WRAPPER} pb-16`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Hero */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8`}>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3">Writing Styles 가이드</h1>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-3xl">
            LLM 대화에서 <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1F2229] text-gray-900 dark:text-gray-100 text-sm font-mono">--flag</code>를
            붙이면 원하는 스타일로 자동 포스팅할 수 있습니다.
          </p>
        </section>

        {/* 기본 사용법 */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-6`}>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">기본 사용법</h2>
            <p className="text-gray-600 dark:text-gray-400">
              대화 중 <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1F2229] text-sm font-mono">--flag</code>를 명시하면 해당 스타일이 적용됩니다.
              생략하면 <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1F2229] text-sm font-mono">--default</code>가 자동 사용되지만, 스타일을
              명시하는 것이 권장됩니다.
            </p>
          </div>

          <div className="space-y-4">
            {WRITING_STYLES.filter((style) => style.id !== '_common').slice(0, 6).map((style, index) => (
              <div
                key={style.id}
                className={`rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F2229] p-4 ${
                  index === 0 ? 'border-l-4 border-l-[#6D79FF]' : ''
                }`}
              >
                <code className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium">--{style.id}</code>
                {style.id === 'default' && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">(기본값)</span>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{style.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F2229] p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">예시</p>
            <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
              <p>&ldquo;위 내용 자동 포스팅해줘 --default&rdquo;</p>
              <p>&ldquo;이 주제로 소설 스타일로 작성해줘 --novel&rdquo;</p>
              <p>&ldquo;초보자를 위한 가이드로 작성해줘 --tutorial&rdquo;</p>
            </div>
          </div>
        </section>

        {/* 스타일 목록 */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">스타일 가이드</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">각 스타일 상세 페이지에서 권장 마크다운과 추가 팁을 확인하세요.</p>
            </div>
            <button
              onClick={() => router.push('/docs/writing-styles/_common')}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS}`}
            >
              공통 규칙 보기
            </button>
          </div>

          <div className="space-y-3">
            {WRITING_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => router.push(`/docs/writing-styles/${style.id}`)}
                className="w-full text-left rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-white dark:bg-[#1F2229] p-5 transition hover:border-gray-200 dark:hover:border-[#3A414F]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">{style.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{style.description}</p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-600">→</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 커스터마이징 */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-4`}>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">커스터마이징</h2>
          <p className="text-gray-600 dark:text-gray-400">
            기본 스타일은 출발점입니다. 원하는 가이드를 복사해 로컬 .md 파일로 저장하고 YAML frontmatter와 규칙을 수정하면 나만의 톤과 매너를 만들 수 있습니다.
          </p>
          <p className="text-gray-600 dark:text-gray-400">예) &ldquo;이 커스텀 스타일 가이드 + 위 내용을 참고해서 자동포스팅해줘&rdquo;</p>
        </section>

        {/* 주의사항 */}
        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">주의사항</h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• LLM이 가끔 플래그를 놓칠 수 있으니 &ldquo;자동 포스팅&rdquo; 키워드를 함께 전달하세요.</li>
            <li>• URL, 이미지, 코드 블록 등 첨부 자료는 각 스타일 규칙에 맞춰 정리해 주세요.</li>
            <li>• 하나의 플래그를 여러 워크플로에서 공유한다면 스타일 변경 사항을 별도로 기록해 두는 것이 안전합니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
