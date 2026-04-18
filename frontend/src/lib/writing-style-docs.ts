export type WritingStyleDoc = {
  id: string;
  name: string;
  flag: string;
  summary: string;
  bestFor: string;
  kind: 'preset' | 'special' | 'reference';
};

export const WRITING_STYLE_PRESET_DOCS: WritingStyleDoc[] = [
  {
    id: 'default',
    name: 'Default',
    flag: '--default',
    summary: '기술 설명과 구현 맥락을 가장 균형 있게 다루는 기본 문서 스타일입니다.',
    bestFor: '일반적인 기술 블로그, 구현 회고, 아키텍처 설명',
    kind: 'preset',
  },
  {
    id: 'novel',
    name: 'Novel',
    flag: '--novel',
    summary: '긴장감, 전환점, 감정선을 살려 서사적으로 읽히는 글을 만들 때 적합합니다.',
    bestFor: '장애 회고, 창업 스토리, 경험 중심 글',
    kind: 'preset',
  },
  {
    id: 'podcast',
    name: 'Podcast',
    flag: '--podcast',
    summary: '질문과 답변 흐름으로 핵심을 빠르게 전달하는 대화형 문서 스타일입니다.',
    bestFor: '설명형 Q&A, 음성 콘텐츠 원고, 인터뷰 정리',
    kind: 'preset',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    flag: '--vibe',
    summary: '멘토링 톤과 인사이트 중심 구조로 성장 포인트를 강조합니다.',
    bestFor: '학습 가이드, 커리어 인사이트, 실무 감각 정리',
    kind: 'preset',
  },
  {
    id: 'research',
    name: 'Research',
    flag: '--research',
    summary: '근거, 비교, 제약을 먼저 드러내는 분석형 문서 작성에 맞춰져 있습니다.',
    bestFor: '논문 리뷰, 벤치마크, 옵션 비교',
    kind: 'preset',
  },
  {
    id: 'pm',
    name: 'PM',
    flag: '--pm',
    summary: '문제 정의와 의사결정 기준, 트레이드오프를 선명하게 드러내는 제품 문체입니다.',
    bestFor: '기능 출시 회고, 제품 전략, 우선순위 판단',
    kind: 'preset',
  },
  {
    id: 'designer',
    name: 'Designer',
    flag: '--designer',
    summary: '맥락, 탐색 과정, 사용자 영향을 구조적으로 설명하는 케이스 스터디 톤입니다.',
    bestFor: '리디자인 기록, UX 케이스 스터디, 인터랙션 설명',
    kind: 'preset',
  },
  {
    id: 'marketer',
    name: 'Marketer',
    flag: '--marketer',
    summary: '가설, 실험, 전환과 숫자 변화 중심으로 설득력 있게 정리하는 스타일입니다.',
    bestFor: '캠페인 회고, 퍼널 분석, 성장 실험 보고서',
    kind: 'preset',
  },
];

export const WRITING_STYLE_SPECIAL_MODE_DOCS: WritingStyleDoc[] = [
  {
    id: 'sell',
    name: 'Sell',
    flag: '--sell',
    summary: '일반 글쓰기 스타일을 지정한 후 추가로 --sell 을 추가하면 자동으로 판매탭에 글이 등록됩니다.',
    bestFor: '프롬프트 팩, 템플릿, 유료 가이드, 워크플로 판매',
    kind: 'special',
  },
];

export const WRITING_STYLE_REFERENCE_DOCS: WritingStyleDoc[] = [
  {
    id: '_common',
    name: 'Common Rules',
    flag: 'shared rules',
    summary: '모든 preset과 sell mode에 공통으로 적용되는 태그, Markdown, 파라미터 규칙을 정리합니다.',
    bestFor: '스타일 선택 전 공통 발행 규칙 확인',
    kind: 'reference',
  },
];

export const WRITING_STYLE_DOCS: WritingStyleDoc[] = [
  ...WRITING_STYLE_PRESET_DOCS,
  ...WRITING_STYLE_SPECIAL_MODE_DOCS,
  ...WRITING_STYLE_REFERENCE_DOCS,
];

export const WRITING_STYLE_DOCS_BY_ID = Object.fromEntries(
  WRITING_STYLE_DOCS.map((style) => [style.id, style]),
) as Record<string, WritingStyleDoc>;
