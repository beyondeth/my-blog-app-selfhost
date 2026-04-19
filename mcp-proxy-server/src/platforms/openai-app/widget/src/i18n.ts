import type { StyleOption } from './types';

const UI_TEXT: Record<string, Record<string, string>> = {
  ko: {
    connected: '연결됨',
    published: '발행 완료',
    blocked: '조치 필요',
    error: '오류',
    guide_ready: '가이드 준비 완료',
    style_confirmed: '스타일 확정',
    drafting: '초안 작성 중',
    awaiting: '스타일 선택 필요',
    awaiting_style_selection: '스타일 선택 필요',
    ready: '준비됨',
    step_publish: '3/3 발행 완료',
    step_style: '2/3 스타일 확정',
    step_select: '1/3 스타일 선택',
    step_connect: '1/3 연결',
    step_error: '확인 필요',
    step_drafting: '2/3 초안 작성',
    oauth: 'OAuth',
    apikey: 'API Key',
    refreshing: '상태를 새로고침하는 중입니다...',
    refreshed: '상태를 새로고침했습니다.',
    refresh: '새로고침',
    guide_submit: '가이드 제출',
    guide_submitting: '제출 중...',
    view_post: '게시글 보기',
    select_first: '먼저 스타일을 선택하세요.',
    no_token: '스타일 선택 토큰이 없습니다. 새로고침 후 다시 시도하세요.',
    env_unsupported: '이 환경에서는 가이드 제출을 지원하지 않습니다.',
    confirm_required: '발행 전에 최종 확인이 필요합니다.',
    submit_fail: '스타일 제출에 실패했습니다: ',
    guide_check: '가이드 상태를 확인했습니다. 필요하면 다시 제출하세요.',
    session_renewed: '스타일 선택 세션이 갱신되었습니다. 다시 선택해 주세요.',
    submitting_style: '스타일 가이드를 제출하는 중입니다...',
    preview_expand: '미리보기 펼치기',
    preview_collapse: '미리보기 접기',
    preview_title: '본문 미리보기',
    fullscreen: '전체 화면',
    empty: '준비 중입니다. 잠시만 기다려 주세요 ☕',
    account: '계정',
    blog: '블로그',
    auth_mode: '연결 방식',
    next_step: '다음 단계',
    select_style_hint: '스타일을 선택해 주세요',
    title: '제목',
    category: '카테고리',
    writing_style: '글쓰기 스타일',
    tags: '태그',
    published_at: '발행 시각',
    word_count: '예상 단어 수',
    selected_style: '선택된 스타일',
    custom_guide: '커스텀 가이드',
    task: '작업',
    status: '상태',
    reason: '사유',
    yes: '예',
    no: '아니오',
    progress_label: '자동 포스팅 진행 단계',
    progress_select_title: '스타일 선택',
    progress_select_desc: '이번 글의 톤을 확정합니다',
    progress_draft_title: '초안 작성',
    progress_draft_desc: '내용을 정리하고 초안을 작성하고 있습니다',
    progress_publish_title: '발행',
    progress_publish_desc: '초안이 완료되면 바로 발행합니다',
    progress_publish_done_desc: '포스트 발행이 완료되었습니다',
    brand_subtitle: 'ChatGPT 자동 포스팅',
    style_selected: '✅ {style} 스타일이 선택되었습니다.',
    no_style_or_busy: '선택된 스타일이 없거나 제출이 이미 진행 중입니다.',
    bridge_unavailable: 'OpenAI 연결이 준비되지 않았거나 세션이 만료되었습니다. 새로고침 후 다시 시도하세요.',
    style_blocked: '진행 불가: {reason}',
    status_waiting: '상태 메시지: {status} (서버 응답 대기 중)',
  },
  en: {
    connected: 'Connected',
    published: 'Published',
    blocked: 'Action needed',
    error: 'Error',
    guide_ready: 'Guide ready',
    style_confirmed: 'Style confirmed',
    drafting: 'Drafting',
    awaiting: 'Style selection needed',
    awaiting_style_selection: 'Style selection needed',
    ready: 'Ready',
    step_publish: '3/3 Published',
    step_style: '2/3 Style confirmed',
    step_select: '1/3 Choose style',
    step_connect: '1/3 Connected',
    step_error: 'Check required',
    step_drafting: '2/3 Drafting',
    oauth: 'OAuth',
    apikey: 'API Key',
    refreshing: 'Refreshing status...',
    refreshed: 'State refreshed.',
    refresh: 'Refresh',
    guide_submit: 'Submit guide',
    guide_submitting: 'Submitting...',
    view_post: 'View post',
    select_first: 'Please select a style first.',
    no_token: 'No style selection token was found. Refresh and try again.',
    env_unsupported: 'Guide submission is not supported in this environment.',
    confirm_required: 'Final confirmation is required before publishing.',
    submit_fail: 'Style submission failed: ',
    guide_check: 'Guide status checked. Submit again if needed.',
    session_renewed: 'The style selection session was renewed. Please choose a style again.',
    submitting_style: 'Submitting the style guide...',
    preview_expand: 'Expand preview',
    preview_collapse: 'Collapse preview',
    preview_title: 'Content preview',
    fullscreen: 'Fullscreen',
    empty: 'Getting ready. Just a moment… ☕',
    account: 'Account',
    blog: 'Blog',
    auth_mode: 'Connection',
    next_step: 'Next step',
    select_style_hint: 'Select a writing style',
    title: 'Title',
    category: 'Category',
    writing_style: 'Writing style',
    tags: 'Tags',
    published_at: 'Published',
    word_count: 'Estimated words',
    selected_style: 'Selected style',
    custom_guide: 'Custom guide',
    task: 'Task',
    status: 'Status',
    reason: 'Reason',
    yes: 'Yes',
    no: 'No',
    progress_label: 'Autopost progress',
    progress_select_title: 'Choose a style',
    progress_select_desc: 'Confirm the tone for this post',
    progress_draft_title: 'Drafting',
    progress_draft_desc: 'Organizing the content and writing the post',
    progress_publish_title: 'Publishing',
    progress_publish_desc: 'The post will be published when drafting is complete',
    progress_publish_done_desc: 'The post has been published',
    brand_subtitle: 'ChatGPT autoposting',
    style_selected: '✅ {style} has been selected.',
    no_style_or_busy: 'No style is selected or submission is already in progress.',
    bridge_unavailable: 'The OpenAI bridge is unavailable or the session expired. Refresh and try again.',
    style_blocked: 'Blocked: {reason}',
    status_waiting: 'Status: {status} (waiting for the server response)',
  },
};

const STYLE_TEXT: Record<string, Record<string, { label: string; description: string }>> = {
  ko: {
    default: { label: '기본', description: '폭넓은 독자에게 맞는 균형 잡힌 기술 글 톤입니다.' },
    novel: { label: '서사형', description: '긴장감과 감정선을 살리는 스토리텔링 톤입니다.' },
    podcast: { label: '팟캐스트형', description: '말하듯 자연스러운 대화형 흐름으로 구성합니다.' },
    vibe: { label: '개발 성장형', description: '학습법, 성장, 멘토링 인사이트를 전달하는 톤입니다.' },
    research: { label: '리서치형', description: '근거, 실험, 비교 분석을 중심에 둔 톤입니다.' },
    pm: { label: 'PM형', description: '문제 정의, 선택 근거, 트레이드오프를 설명하는 톤입니다.' },
    designer: { label: '디자이너형', description: '맥락, 제약, UX 의사결정을 케이스 스터디처럼 풀어냅니다.' },
    marketer: { label: '마케터형', description: '가설, 실험, 지표, 다음 액션을 강조하는 톤입니다.' },
    sell: { label: '마켓플레이스', description: '디지털 상품 판매 전환에 초점을 맞춘 톤입니다.' },
  },
  en: {
    default: { label: 'Default', description: 'A balanced technical tone for broad audiences.' },
    novel: { label: 'Narrative', description: 'A story-driven voice that emphasizes tension, emotion, and resolution.' },
    podcast: { label: 'Podcast', description: 'A conversational format that reads like spoken dialogue.' },
    vibe: { label: 'Developer Growth', description: 'A mentoring tone for learning systems, career growth, and mindset posts.' },
    research: { label: 'Research', description: 'An evidence-first tone for analysis, benchmarks, and paper reviews.' },
    pm: { label: 'Product Manager', description: 'A decision-oriented tone focused on product context, trade-offs, and rationale.' },
    designer: { label: 'Designer', description: 'A case-study tone that explains context, constraints, and UX rationale.' },
    marketer: { label: 'Marketer', description: 'A growth-oriented tone built around hypotheses, experiments, and metrics.' },
    sell: { label: 'Marketplace', description: 'A conversion-focused tone for digital product listings.' },
  },
};

export const locale: string =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko')
    ? 'ko'
    : 'en';

export function t(key: string): string {
  return UI_TEXT[locale]?.[key] || UI_TEXT.en[key] || key;
}

export function formatT(
  key: string,
  values: Record<string, string | number | undefined>
): string {
  return Object.entries(values).reduce((message, [name, value]) => {
    return message.split(`{${name}}`).join(String(value ?? ''));
  }, t(key));
}

export function localizeStyleOption(option: StyleOption): StyleOption {
  const localized = STYLE_TEXT[locale]?.[option.id] || STYLE_TEXT.en[option.id];
  if (!localized) {
    return option;
  }
  return {
    ...option,
    label: localized.label,
    description: localized.description,
  };
}

export function humanizeAuthMode(mode: string): string {
  return mode === 'oauth2' ? t('oauth') : t('apikey');
}

export function getStatusLabel(status: string): string {
  return UI_TEXT[locale]?.[status.toLowerCase()] || UI_TEXT.en[status.toLowerCase()] || status;
}

export function getStepBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === 'published') return t('step_publish');
  if (s === 'drafting') return t('step_drafting');
  if (s === 'guide_ready' || s === 'style_confirmed') return t('step_style');
  if (s === 'blocked' || s === 'awaiting_style_selection') return t('step_select');
  if (s === 'error') return t('step_error');
  return t('step_connect');
}
