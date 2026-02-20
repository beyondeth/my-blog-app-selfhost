'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
  shortDescription: string;
}

interface StylePreview {
  prompt: string;
  title: string;
  summary: string;
  category: string;
  readTime: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  code?: {
    language: string;
    snippet: string;
  };
  tags: string[];
}

type StyleId = 'default' | 'novel' | 'tutorial' | 'comedy' | 'podcast' | 'vibe' | 'research' | '_common';

interface PreviewCase {
  id: string;
  styleId: StyleId;
  label: string;
  preview: StylePreview;
}

const WRITING_STYLES: StyleGuide[] = [
  {
    id: 'default',
    name: 'Default',
    description: '전문적인 기술 블로그 스타일. 명확하고 구조화된 설명과 코드 예제를 포함합니다.',
    shortDescription: '기본 기술 블로그 톤',
  },
  {
    id: 'novel',
    name: 'Novel',
    description: '서사적인 스토리텔링 스타일. 생생한 묘사와 감정적 여정을 담아 독자를 몰입시킵니다.',
    shortDescription: '스토리텔링 중심',
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    description: '단계별 튜토리얼 스타일. 초보자도 따라할 수 있도록 상세한 가이드와 검증 단계를 제공합니다.',
    shortDescription: '단계별 실전 가이드',
  },
  {
    id: 'comedy',
    name: 'Comedy',
    description: '유머러스한 경험 공유 스타일. 자조적이고 공감 가는 개발자 경험을 재치있게 전달합니다.',
    shortDescription: '가볍고 유머러스한 톤',
  },
  {
    id: 'podcast',
    name: 'Podcast',
    description: '대화형 팟캐스트 스타일. 음성으로 듣기 좋게 구성되며 시각적 요소에 의존하지 않습니다.',
    shortDescription: '대화형 설명',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    description: '개발자 학습 가이드 스타일. 선임 개발자가 후임에게 조언하는 멘토링 톤으로 학습 방법론과 성장 마인드셋을 다룹니다.',
    shortDescription: '멘토링/인사이트형',
  },
  {
    id: 'research',
    name: 'Research',
    description: '논문 분석 인사이트 스타일. 연구 결과를 검증 근거와 함께 요약하고 실무 적용 포인트를 제시합니다.',
    shortDescription: '근거 중심 분석',
  },
  {
    id: '_common',
    name: 'Common Rules',
    description: '모든 스타일에 공통으로 적용되는 기본 규칙과 가이드라인입니다.',
    shortDescription: '모든 스타일 공통 규칙',
  },
];

const STYLE_PREVIEWS: Record<StyleId, StylePreview> = {
  default: {
    prompt: '위 내용 자동포스팅해줘 --default',
    title: 'Redis 캐시 전략으로 상세 조회 지연 줄이기',
    summary:
      '상세 페이지에서 반복 조회가 발생할 때 Redis read-cache를 적용해 응답 시간을 안정화하는 방법을 정리합니다.',
    category: 'Engineering',
    readTime: '7 min',
    sections: [
      {
        heading: '문제 정의',
        content:
          '트래픽이 몰리면 동일 게시글이 짧은 시간에 반복 조회됩니다. 이때 매 요청마다 DB를 치면 지연과 부하가 동시에 올라갑니다.',
      },
      {
        heading: '적용 방식',
        content:
          '상세 조회 API 앞단에서 Redis를 먼저 확인하고, MISS일 때만 DB를 조회합니다. 조회된 결과는 30초 TTL로 캐싱해 짧은 구간의 중복 부하를 흡수합니다.',
      },
    ],
    code: {
      language: 'ts',
      snippet:
        "const cacheKey = `post:detail:${blogId}:${slug}`;\nconst cached = await cache.get(cacheKey);\nif (cached) return cached;\nconst post = await repo.findBySlug(blogId, slug);\nawait cache.set(cacheKey, post, 30);",
    },
    tags: ['redis', 'caching', 'nestjs'],
  },
  novel: {
    prompt: '이 주제를 스토리텔링으로 작성해줘 --novel',
    title: '배포 10분 전, 캐시 미스 폭풍을 만났던 밤',
    summary: '장애 직전의 긴장감과 복구 과정을 서사적으로 풀어낸 경험형 포스팅 예시입니다.',
    category: 'Story',
    readTime: '8 min',
    sections: [
      {
        heading: '도입',
        content:
          '배포 직전, 그래프가 갑자기 솟았습니다. 평소와 같은 요청인데 응답이 늦어지고 에러율이 흔들리기 시작했습니다.',
      },
      {
        heading: '전환점',
        content:
          '원인은 단순했습니다. 인기 글 하나에 조회가 집중되며 캐시가 비어 있던 순간, DB가 모든 요청을 정면으로 받았습니다.',
      },
    ],
    tags: ['incident', 'storytelling', 'ops'],
  },
  tutorial: {
    prompt: '초보자용으로 작성해줘 --tutorial',
    title: '초보자를 위한 자동포스팅 스타일 설정 5단계',
    summary: '설치부터 첫 자동포스팅까지 바로 따라할 수 있는 단계형 가이드 예시입니다.',
    category: 'Guide',
    readTime: '6 min',
    sections: [
      {
        heading: 'Step 1',
        content:
          '설치 명령을 실행해 스킬을 연결합니다. 설치 후 `skills list`로 연결 상태를 먼저 확인합니다.',
      },
      {
        heading: 'Step 2',
        content:
          '요청 문장 끝에 스타일 플래그를 붙여 테스트합니다. 결과물을 확인하고 필요한 톤으로 스타일을 교체합니다.',
      },
    ],
    tags: ['tutorial', 'onboarding', 'skills'],
  },
  comedy: {
    prompt: '실패담 중심으로 유쾌하게 써줘 --comedy',
    title: '포트 충돌과 함께 시작된 나의 평화로운 배포',
    summary: '현실적인 실수와 복구 과정을 가볍고 재치 있는 톤으로 보여주는 예시입니다.',
    category: 'Dev Life',
    readTime: '5 min',
    sections: [
      {
        heading: '상황',
        content:
          '3001도 이미 사용 중, 3002도 이미 사용 중. 서버 두 개가 동시에 나를 반겼고, 나는 그제야 터미널 탭을 세기 시작했습니다.',
      },
      {
        heading: '정리',
        content:
          '정답은 단순했습니다. 먼저 실행 중인 프로세스를 정리하고, 환경변수를 다시 맞춘 뒤 순서대로 올렸습니다.',
      },
    ],
    tags: ['comedy', 'devlog', 'troubleshooting'],
  },
  podcast: {
    prompt: '대화형 요약으로 풀어줘 --podcast',
    title: '캐시 전략, 진짜로 체감되나요? 실무 대화로 정리',
    summary: '질문-답변 흐름으로 핵심만 빠르게 전달하는 대화형 글 예시입니다.',
    category: 'Talk',
    readTime: '5 min',
    sections: [
      {
        heading: 'Q. 왜 캐시가 필요한가요?',
        content:
          'A. 같은 글을 짧은 시간에 여러 명이 보면, DB는 같은 데이터를 반복 조회합니다. 캐시는 이 중복 조회를 줄여줍니다.',
      },
      {
        heading: 'Q. TTL은 왜 30초죠?',
        content:
          'A. 게시글은 초단위로 바뀌지 않으면서 조회는 순간적으로 몰리기 때문입니다. 짧은 TTL로 신선도와 성능을 같이 잡습니다.',
      },
    ],
    tags: ['podcast', 'qna', 'performance'],
  },
  vibe: {
    prompt: '인사이트 중심으로 정리해줘 --vibe',
    title: '요즘 개발자에게 중요한 건 문법보다 학습 루프',
    summary: '실무 성장 관점에서 학습 전략과 실행 루틴을 제시하는 멘토링형 예시입니다.',
    category: 'Growth',
    readTime: '6 min',
    sections: [
      {
        heading: '핵심 메시지',
        content:
          '지금은 “외우는 속도”보다 “검증하고 적용하는 루프”가 경쟁력입니다. 문법보다 문제 해결 흐름을 먼저 잡아야 합니다.',
      },
      {
        heading: '실행 포인트',
        content:
          '매일 짧게라도 직접 구현하고, 실패 로그를 기록하세요. 회고가 쌓이면 성장은 거의 자동화됩니다.',
      },
    ],
    tags: ['vibe', 'learning', 'career'],
  },
  research: {
    prompt: '근거 기반 분석으로 정리해줘 --research',
    title: '단일 DB 환경에서 읽기 부하를 줄이는 현실적 선택지 비교',
    summary: '옵션별 효과와 리스크를 근거 중심으로 비교하는 분석형 포스팅 예시입니다.',
    category: 'Analysis',
    readTime: '9 min',
    sections: [
      {
        heading: '비교 기준',
        content:
          '비용, 구현 난이도, 즉시 효과를 기준으로 옵션을 비교했습니다. 현재 인프라에선 Redis read-cache 강화가 가장 실용적입니다.',
      },
      {
        heading: '결론',
        content:
          '초기 단계에서는 캐시 전략만으로도 DB 부하를 크게 줄일 수 있습니다. 이후 트래픽 증가 시 read replica를 검토하는 순서가 안전합니다.',
      },
    ],
    tags: ['research', 'benchmark', 'redis'],
  },
  _common: {
    prompt: '위 내용 자동포스팅해줘',
    title: '공통 규칙: 모든 스타일에 적용되는 기본 품질 기준',
    summary: '스타일과 무관하게 유지해야 할 문장 품질, 구조, 태그 규칙을 정리한 예시입니다.',
    category: 'Rules',
    readTime: '4 min',
    sections: [
      {
        heading: '공통 원칙',
        content:
          '문장 구조는 명확하게, 핵심은 앞쪽에 배치하고, 주장에는 근거를 붙입니다. 읽는 사람이 바로 실행할 수 있어야 합니다.',
      },
      {
        heading: '포맷 규칙',
        content:
          '제목-서론-핵심-정리 구조를 유지하고, 링크/코드/이미지는 문맥 설명과 함께 제공합니다.',
      },
    ],
    tags: ['common', 'quality', 'rules'],
  },
};

const PREVIEW_CASES: PreviewCase[] = [
  {
    id: 'default-tech-cache',
    styleId: 'default',
    label: '기술 최적화 예시',
    preview: STYLE_PREVIEWS.default,
  },
  {
    id: 'novel-louvre-monalisa',
    styleId: 'novel',
    label: '루브르 모나리자 감상평',
    preview: {
      prompt: '루브르 박물관에서 모나리자를 보고온 감상평을 써줘 --novel',
      title: '루브르의 짧은 정적, 모나리자 앞에서 멈춘 7분',
      summary: '여행 기록이 아니라, 작품 앞에서 느낀 감정의 변화를 서사적으로 담아낸 감상문 예시입니다.',
      category: 'Travel Essay',
      readTime: '6 min',
      sections: [
        {
          heading: '입장 직후',
          content:
            '복도를 지나 작품 앞에 섰을 때, 생각보다 작은 캔버스가 먼저 눈에 들어왔습니다. 그런데 그 작음이 오히려 시선을 오래 붙잡았습니다.',
        },
        {
          heading: '돌아오는 길',
          content:
            '사진보다 기억이 오래 남은 건 표정의 모호함이었습니다. 확신보다 여운을 남기는 그림이 왜 오래 사랑받는지 이해하게 됐습니다.',
        },
      ],
      tags: ['louvre', 'monalisa', 'travel'],
    },
  },
  {
    id: 'podcast-little-prince',
    styleId: 'podcast',
    label: '조카와 어린왕자 대화',
    preview: {
      prompt: "초등학생 조카와 '어린왕자'를 읽고 나눈 대화로 정리해줘 --podcast",
      title: '어린왕자를 읽고 조카가 물었다: “어른들은 왜 숫자만 세요?”',
      summary: '질문과 대답 중심으로 정리한 대화형 포스팅 예시입니다.',
      category: 'Book Talk',
      readTime: '5 min',
      sections: [
        {
          heading: 'Q. 왜 어른들은 중요한 걸 잘 못 봐요?',
          content:
            'A. 익숙한 것만 빠르게 판단하려고 해서 그래. 숫자는 빠르게 비교되지만, 마음은 천천히 봐야 보이거든.',
        },
        {
          heading: 'Q. 그럼 중요한 건 어떻게 찾아요?',
          content:
            'A. 시간이 걸리더라도 자주 들여다보는 거야. 어린왕자가 장미를 소중히 여긴 것도 돌본 시간이 있었기 때문이니까.',
        },
      ],
      tags: ['어린왕자', 'family', 'conversation'],
    },
  },
  {
    id: 'podcast-economy-issue',
    styleId: 'podcast',
    label: '최근 경제 이슈 팟캐스트',
    preview: {
      prompt: '최근 경제 이슈를 팟캐스트 대화형으로 정리해줘 --podcast',
      title: '요즘 금리 이슈, 우리 생활에는 뭐가 달라질까?',
      summary: '복잡한 경제 이슈를 쉬운 Q&A 형식으로 풀어낸 오디오형 글 예시입니다.',
      category: 'Economy',
      readTime: '7 min',
      sections: [
        {
          heading: 'Q. 금리가 오르면 바로 체감되는 건?',
          content:
            'A. 대출 이자 부담이 먼저 커집니다. 가계 지출 구조가 바뀌면서 소비 여력이 줄어드는 흐름이 나타납니다.',
        },
        {
          heading: 'Q. 지금 개인이 체크할 포인트는?',
          content:
            'A. 고정비 점검, 변동금리 리스크, 비상자금 비중입니다. 시장 예측보다 버틸 수 있는 구조를 먼저 점검하는 게 안전합니다.',
        },
      ],
      tags: ['economy', 'interest-rate', 'podcast'],
    },
  },
  {
    id: 'research-paper-learning',
    styleId: 'research',
    label: '논문 검색/요약 학습',
    preview: {
      prompt: '논문 검색과 요약을 학습하는 내용을 분석형으로 써줘 --research',
      title: '논문 검색과 요약 학습 루틴: 검색 품질을 올리는 3단계',
      summary: '키워드 설계부터 요약 검증까지, 재현 가능한 학습 루틴을 근거 중심으로 정리한 예시입니다.',
      category: 'Research Learning',
      readTime: '8 min',
      sections: [
        {
          heading: '방법론',
          content:
            '검색어를 문제/방법/도메인으로 분해하고, 데이터베이스별 결과 편향을 비교합니다. 같은 주제를 최소 2개 소스로 교차 검증합니다.',
        },
        {
          heading: '검증 포인트',
          content:
            '요약 품질은 “핵심 주장-근거-한계” 3요소가 모두 유지되는지로 평가합니다. 요약이 짧아질수록 한계 항목이 누락되기 쉽습니다.',
        },
      ],
      tags: ['paper-search', 'summary', 'learning'],
    },
  },
  {
    id: 'vibe-coding-growth',
    styleId: 'vibe',
    label: '바이브코딩 학습 방향',
    preview: {
      prompt: '바이브코딩 하면서 배운 내용과 앞으로 학습 방향을 정리해줘 --vibe',
      title: '바이브코딩 4주 회고: 무엇을 배웠고 다음엔 뭘 할지',
      summary: '실패 로그와 실행 루틴을 바탕으로 성장 방향을 제시하는 멘토링형 예시입니다.',
      category: 'Growth',
      readTime: '6 min',
      sections: [
        {
          heading: '이번에 배운 것',
          content:
            '빠른 구현보다 “검증 가능한 작은 단위”가 중요하다는 점을 체감했습니다. 로그를 남기면 같은 실수를 줄일 수 있었습니다.',
        },
        {
          heading: '다음 학습 방향',
          content:
            '앞으로는 성능 병목 분석, 캐시 전략, 테스트 자동화 순서로 학습할 계획입니다. 주마다 하나의 개선 지표를 정해 추적합니다.',
        },
      ],
      tags: ['vibe-coding', 'retrospective', 'learning-path'],
    },
  },
  {
    id: 'tutorial-quickstart',
    styleId: 'tutorial',
    label: '초보자 빠른 시작',
    preview: STYLE_PREVIEWS.tutorial,
  },
  {
    id: 'comedy-dev-life',
    styleId: 'comedy',
    label: '개발 일상 유머',
    preview: STYLE_PREVIEWS.comedy,
  },
  {
    id: 'common-rules',
    styleId: '_common',
    label: '공통 규칙',
    preview: STYLE_PREVIEWS._common,
  },
];

export default function WritingStylesPage() {
  const styleItems = WRITING_STYLES;
  const [selectedStyleId, setSelectedStyleId] = useState<StyleId>('default');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('default-tech-cache');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const selectedStyle = useMemo(
    () => styleItems.find((style) => style.id === selectedStyleId) ?? styleItems[0],
    [selectedStyleId, styleItems],
  );
  const selectedCase = useMemo(
    () => PREVIEW_CASES.find((item) => item.id === selectedCaseId) ?? PREVIEW_CASES[0],
    [selectedCaseId],
  );
  const selectedPreview = useMemo(
    () => selectedCase.preview,
    [selectedCase],
  );

  const handleSelectStyle = (styleId: StyleId) => {
    setSelectedStyleId(styleId);
    const firstCase = PREVIEW_CASES.find((item) => item.styleId === styleId);
    if (firstCase) {
      setSelectedCaseId(firstCase.id);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadStyleMarkdown = async () => {
      if (!selectedStyleId) return;
      setIsDetailLoading(true);
      setDetailError(null);
      setRawMarkdown('');

      try {
        const response = await fetch(`/docs/writing-styles/${selectedStyleId}.md`);
        if (!response.ok) {
          throw new Error('스타일 가이드를 불러오지 못했습니다.');
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          throw new Error('스타일 가이드 파일을 찾을 수 없습니다.');
        }
        const markdown = await response.text();
        if (markdown.trimStart().startsWith('<!DOCTYPE html')) {
          throw new Error('스타일 가이드 파일을 찾을 수 없습니다.');
        }
        if (!isMounted) return;
        setRawMarkdown(markdown);
      } catch (error) {
        if (!isMounted) return;
        setDetailError(error instanceof Error ? error.message : '스타일 가이드를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    };

    loadStyleMarkdown();
    return () => {
      isMounted = false;
    };
  }, [selectedStyleId]);

  const handleCopy = async () => {
    if (!rawMarkdown) return;
    try {
      await navigator.clipboard.writeText(rawMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`${SETTINGS_PAGE_WRAPPER} pb-16`}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <section className={`${SETTINGS_CARD_CLASS} space-y-3 p-5 sm:p-6`}>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Writing Styles</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            자동포스팅 요청 문장 끝에 원하는 스타일 플래그를 붙여주세요.
          </p>
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[13px] text-gray-700 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p>&ldquo;위 내용 자동포스팅해줘 --default&rdquo;</p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                (플래그 없으면 기본값 <code className="font-mono">--default</code> 적용)
              </span>
            </div>
            <p>&ldquo;이 주제를 스토리텔링으로 작성해줘 --novel&rdquo;</p>
            <p>&ldquo;초보자용으로 작성해줘 --tutorial&rdquo;</p>
            <p>&ldquo;실패담 중심으로 유쾌하게 써줘 --comedy&rdquo;</p>
            <p>&ldquo;대화형 요약으로 풀어줘 --podcast&rdquo;</p>
            <p>&ldquo;인사이트 중심으로 정리해줘 --vibe&rdquo;</p>
            <p>&ldquo;근거 기반 분석으로 정리해줘 --research&rdquo;</p>
          </div>
        </section>

        <section className={`${SETTINGS_CARD_CLASS} space-y-4 p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">실전 미리보기</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                아래는 선택한 스타일로 자동포스팅했을 때 블로그에서 보이는 예시입니다.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-[#2F3440] dark:bg-[#1F2229]">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  previewViewport === 'desktop'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-[#2A2F3A] dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  previewViewport === 'mobile'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-[#2A2F3A] dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-700 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p>&ldquo;{selectedPreview.prompt}&rdquo;</p>
              {selectedCase.styleId === 'default' && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  (플래그 없으면 기본값 <code className="font-mono">--default</code> 적용)
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">다양한 주제 예시</p>
            <div className="flex flex-wrap gap-2">
              {PREVIEW_CASES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedCaseId(item.id);
                    setSelectedStyleId(item.styleId);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCaseId === item.id
                      ? 'border-transparent bg-[#0B1738] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300 dark:hover:border-[#3A414F]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#F4F7FB] p-3 dark:border-[#2F3440] dark:bg-[#151A23]">
            <div className={`mx-auto transition-all ${previewViewport === 'mobile' ? 'max-w-[390px]' : 'max-w-4xl'}`}>
              <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#2F3440] dark:bg-[#0F141D]">
                <div className="border-b border-gray-100 px-4 py-3 dark:border-[#2A2F3A] sm:px-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 dark:bg-[#202634] dark:text-gray-200">
                      {selectedPreview.category}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">read {selectedPreview.readTime}</span>
                    <span className="text-gray-500 dark:text-gray-400">views 1.2k</span>
                    <span className="text-gray-500 dark:text-gray-400">likes 86</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                    {selectedPreview.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedPreview.summary}</p>
                </div>

                <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
                  {selectedPreview.sections.map((section) => (
                    <section key={section.heading} className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{section.heading}</h4>
                      <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{section.content}</p>
                    </section>
                  ))}

                  {selectedPreview.code && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#2F3440]">
                      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-medium text-gray-600 dark:border-[#2F3440] dark:bg-[#1A1F2A] dark:text-gray-400">
                        {selectedPreview.code.language}
                      </div>
                      <pre className="overflow-x-auto bg-[#0B1020] px-3 py-3 text-xs text-blue-50">
                        <code>{selectedPreview.code.snippet}</code>
                      </pre>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedPreview.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 dark:border-[#2F3440] dark:text-gray-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={`${SETTINGS_CARD_CLASS} space-y-4 p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">스타일 선택</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{styleItems.length}개</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {styleItems.map((style) => (
              <button
                key={style.id}
                onClick={() => handleSelectStyle(style.id as StyleId)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selectedStyleId === style.id
                    ? 'border-transparent bg-[#0B1738] text-white shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#2F3440] dark:bg-[#1F2229] dark:hover:border-[#3A414F]'
                }`}
              >
                <div className="space-y-1">
                  <h3
                    className={`truncate text-xl font-semibold ${
                      selectedStyleId === style.id ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {style.name}
                  </h3>
                  <p
                    className={`text-sm ${
                      selectedStyleId === style.id ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {style.shortDescription}
                  </p>
                </div>
              </button>
            ))}
          </div>

        </section>

        <section className={`${SETTINGS_CARD_CLASS} space-y-4 p-5 sm:p-6`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {selectedStyle?.name ?? 'Style'} 상세 가이드
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                선택한 스타일의 원본 마크다운 가이드를 아래에서 바로 확인할 수 있습니다.
              </p>
            </div>
            <button
              onClick={handleCopy}
              disabled={!rawMarkdown || isDetailLoading || !!detailError}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? '복사됨' : '원본 복사'}
            </button>
          </div>

          {isDetailLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300">
              스타일 가이드를 불러오는 중...
            </div>
          )}

          {detailError && !isDetailLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              {detailError}
            </div>
          )}

          {!isDetailLoading && !detailError && rawMarkdown && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2F3440]">
              <pre className="max-h-[680px] overflow-x-auto bg-gray-950 p-5 text-xs leading-relaxed text-gray-100 sm:text-sm">
                <code>{rawMarkdown}</code>
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
