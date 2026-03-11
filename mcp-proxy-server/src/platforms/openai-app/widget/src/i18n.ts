const _i18n: Record<string, Record<string, string>> = {
  ko: {
    connected: '연결됨', published: '발행 완료', blocked: '진행 대기',
    error: '오류', guide_ready: '가이드 준비', style_confirmed: '스타일 확정',
    awaiting: '스타일 선택 필요', awaiting_style_selection: '스타일 선택 필요', ready: '준비됨',
    step_publish: '3/3 발행 완료', step_style: '2/3 스타일 확정',
    step_select: '2/3 스타일 선택', step_connect: '1/3 연결', step_error: '확인 필요',
    oauth: 'OAuth 연결', apikey: 'API Key 연결',
    refreshing: '상태를 새로고침하는 중입니다...', refreshed: '최신 상태를 반영했습니다.',
    refresh: '새로고침',
    guide_submit: '가이드 제출', guide_submitting: '가이드 제출 중...',
    view_post: '게시글 보기',
    select_first: '먼저 스타일을 하나 선택하세요.',
    no_token: '스타일 선택 토큰이 없습니다. 새로고침 후 다시 시도하세요.',
    env_unsupported: '이 환경에서는 가이드 제출 호출을 지원하지 않습니다.',
    confirm_required: '발행 전에 사용자 최종 동의가 필요합니다.',
    submit_fail: '스타일 제출에 실패했습니다: ',
    guide_check: '가이드 상태를 확인했습니다. 필요 시 다시 제출해 주세요.',
    session_renewed: '스타일 선택 세션이 갱신되었습니다. 카드를 다시 선택한 뒤 제출해 주세요.',
    submitting_style: '스타일 가이드를 제출 중입니다...',
    preview_expand: '본문 펼치기', preview_collapse: '본문 접기',
    fullscreen: '전체 화면',
    empty: '준비 중입니다. 잠시만 기다려 주세요 ☕',
    account: '계정', blog: '블로그', auth_mode: '연결 방식',
    next_step: '다음 단계', select_style_hint: '스타일을 선택해 주세요',
    title: '제목', category: '카테고리', writing_style: '글쓰기 스타일',
    tags: '태그', published_at: '발행 시간', word_count: '예상 단어수',
    selected_style: '선택 스타일', custom_guide: '커스텀 가이드',
    task: '작업', status: '상태', reason: '사유',
    yes: '사용', no: '미사용',
  },
  en: {
    connected: 'Connected', published: 'Published', blocked: 'Action Needed',
    error: 'Error', guide_ready: 'Guide Ready', style_confirmed: 'Style Confirmed',
    awaiting: 'Style Selection Needed', awaiting_style_selection: 'Style Selection Needed', ready: 'Ready',
    step_publish: '3/3 Published', step_style: '2/3 Style Confirmed',
    step_select: '2/3 Select Style', step_connect: '1/3 Connect', step_error: 'Check Required',
    oauth: 'OAuth', apikey: 'API Key',
    refreshing: 'Refreshing...', refreshed: 'State refreshed.',
    refresh: 'Refresh',
    guide_submit: 'Submit Guide', guide_submitting: 'Submitting...',
    view_post: 'View Post',
    select_first: 'Please select a style first.',
    no_token: 'No style selection token. Try refreshing.',
    env_unsupported: 'Guide submission is not supported in this environment.',
    confirm_required: 'User confirmation is required before publishing.',
    submit_fail: 'Style submission failed: ',
    guide_check: 'Guide status checked. Please resubmit if needed.',
    session_renewed: 'Style selection session renewed. Please reselect.',
    submitting_style: 'Submitting style guide...',
    preview_expand: 'Expand preview', preview_collapse: 'Collapse preview',
    fullscreen: 'Fullscreen',
    empty: 'Getting ready. Just a moment… ☕',
    account: 'Account', blog: 'Blog', auth_mode: 'Connection',
    next_step: 'Next Step', select_style_hint: 'Please select a style',
    title: 'Title', category: 'Category', writing_style: 'Writing Style',
    tags: 'Tags', published_at: 'Published', word_count: 'Est. Words',
    selected_style: 'Selected Style', custom_guide: 'Custom Guide',
    task: 'Task', status: 'Status', reason: 'Reason',
    yes: 'Yes', no: 'No',
  },
};

export const locale: string =
  typeof navigator !== 'undefined' && navigator.language?.startsWith('ko') ? 'ko' : 'en';

export function t(key: string): string {
  return (_i18n[locale] || _i18n.ko)[key] || _i18n.ko[key] || key;
}

export function humanizeAuthMode(mode: string): string {
  return mode === 'oauth2' ? t('oauth') : t('apikey');
}

export function humanizeWorkflow(stage: string): string {
  const map: Record<string, string> = {
    awaiting_style_selection: t('awaiting_style_selection'),
    style_confirmed: t('style_confirmed'),
    published: t('published'),
  };
  return map[stage] || stage;
}

export function humanizeAction(tool: string): string {
  const map: Record<string, string> = {
    check_auth: t('connected'),
    render_style_picker: t('awaiting_style_selection'),
    confirm_style: t('guide_ready'),
    create_post: t('published'),
  };
  return map[tool] || tool;
}

export function getStatusLabel(status: string): string {
  return (
    (_i18n[locale] || _i18n.ko)[status.toLowerCase()] ||
    _i18n.ko[status.toLowerCase()] ||
    status
  );
}

export function getStepBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === 'published') return t('step_publish');
  if (s === 'guide_ready' || s === 'style_confirmed') return t('step_style');
  if (s === 'blocked' || s === 'awaiting_style_selection') return t('step_select');
  if (s === 'error') return t('step_error');
  return t('step_connect');
}
