// Admin 페이지 한글화 번역 상수

export const adminTranslations = {
  // Navigation
  navigation: {
    dashboard: '대시보드',
    users: '사용자',
    posts: '포스트',
    reports: '신고 관리',
    settings: '설정',
    logout: '로그아웃',
    adminPanel: 'Admin Panel',
  },

  // Common Actions
  actions: {
    search: '검색',
    filter: '필터',
    refresh: '새로고침',
    export: '내보내기',
    import: '가져오기',
    add: '추가',
    edit: '수정',
    delete: '삭제',
    save: '저장',
    cancel: '취소',
    confirm: '확인',
    view: '보기',
    publish: '게시',
    unpublish: '게시 취소',
    approve: '승인',
    reject: '거부',
    block: '차단',
    unblock: '차단 해제',
    loadMore: '더보기',
    selectAll: '전체 선택',
    clearSelection: '선택 해제',
    bulkAction: '일괄 작업',
  },

  // Status
  status: {
    active: '활성',
    inactive: '비활성',
    published: '게시됨',
    draft: '초안',
    pending: '대기 중',
    under_review: '검토 중',
    resolved: '해결됨',
    dismissed: '기각됨',
    escalated: '상위 보고',
    online: '온라인',
    offline: '오프라인',
    verified: '인증됨',
    unverified: '미인증',
  },

  // Dashboard Page
  dashboard: {
    title: '관리자 대시보드',
    overview: '개요',
    statistics: '통계',
    recentActivity: '최근 활동',
    systemHealth: '시스템 상태',
    
    // Stats Cards
    totalUsers: '전체 사용자',
    activeUsers: '활성 사용자',
    newUsers: '신규 사용자',
    inactiveUsers: '비활성 사용자',
    
    totalPosts: '전체 포스트',
    publishedPosts: '게시된 포스트',
    draftPosts: '초안 포스트',
    todayPosts: '오늘 작성',
    
    totalComments: '전체 댓글',
    todayComments: '오늘 댓글',
    pendingComments: '검토 대기',
    
    totalReports: '전체 신고',
    pendingReports: '처리 대기',
    resolvedReports: '처리 완료',
    todayReports: '오늘 신고',
    
    // Metrics
    dau: '일일 활성 사용자',
    mau: '월간 활성 사용자',
    avgPostsPerUser: '사용자당 평균 포스트',
    avgCommentsPerPost: '포스트당 평균 댓글',
    avgSessionDuration: '평균 세션 시간',
    bounceRate: '이탈률',
    
    // Charts
    weeklyTrends: '주간 동향',
    userDistribution: '사용자 분포',
    contentGrowth: '콘텐츠 증가',
    performanceMetrics: '성능 메트릭',
  },

  // Users Page
  users: {
    title: '사용자 관리',
    subtitle: '사용자 계정 및 권한 관리',
    searchPlaceholder: '이름, 이메일로 검색...',
    
    // Table Headers
    name: '이름',
    email: '이메일',
    username: '사용자명',
    role: '역할',
    status: '상태',
    joinDate: '가입일',
    lastLogin: '마지막 로그인',
    actions: '작업',
    
    // Roles
    admin: '관리자',
    moderator: '중재자',
    user: '일반 사용자',
    
    // Filters
    allUsers: '전체 사용자',
    activeOnly: '활성 사용자만',
    inactiveOnly: '비활성 사용자만',
    adminsOnly: '관리자만',
    
    // Actions
    viewProfile: '프로필 보기',
    editUser: '사용자 편집',
    resetPassword: '비밀번호 재설정',
    sendEmail: '이메일 보내기',
    toggleStatus: '상태 변경',
    changeRole: '역할 변경',
    deleteAccount: '계정 삭제',
  },

  // Posts Page
  posts: {
    title: '포스트 관리',
    subtitle: '블로그 포스트 및 콘텐츠 관리',
    searchPlaceholder: '포스트 검색...',
    
    // Stats
    totalPosts: '전체 포스트',
    published: '게시됨',
    drafts: '초안',
    totalViews: '전체 조회수',
    
    // Table Headers
    title: '제목',
    author: '작성자',
    status: '상태',
    category: '카테고리',
    stats: '통계',
    publishedDate: '게시일',
    actions: '작업',
    
    // Filters
    allStatus: '모든 상태',
    publishedOnly: '게시됨',
    draftsOnly: '초안',
    allCategories: '모든 카테고리',
    
    // Actions
    viewPost: '포스트 보기',
    editPost: '포스트 편집',
    togglePublish: '게시 상태 변경',
    deletePost: '포스트 삭제',
    
    // Bulk Actions
    bulkPublish: '선택 게시',
    bulkUnpublish: '선택 게시 취소',
    bulkDelete: '선택 삭제',
    selectedPosts: '개 포스트 선택됨',
    
    // Messages
    noPostsFound: '포스트가 없습니다',
    loadingPosts: '포스트 불러오는 중...',
    allPostsLoaded: '모든 포스트를 불러왔습니다',
  },

  // Reports Page
  reports: {
    title: '신고 관리',
    subtitle: '사용자 신고 및 콘텐츠 관리',
    searchPlaceholder: '신고 내용 검색...',
    
    // Stats
    totalReports: '전체 신고',
    pending: '대기 중',
    resolved: '해결됨',
    escalated: '에스컬레이션',
    
    // Table Headers
    reporter: '신고자',
    target: '대상',
    type: '유형',
    reason: '사유',
    priority: '우선순위',
    status: '상태',
    date: '신고일',
    actions: '작업',
    
    // Report Types
    post: '포스트',
    comment: '댓글',
    user: '사용자',
    
    // Report Reasons
    spam: '스팸',
    harassment: '괴롭힘',
    hateSpeed: '혐오 발언',
    violence: '폭력적 콘텐츠',
    misinformation: '잘못된 정보',
    copyright: '저작권 침해',
    inappropriate: '부적절한 콘텐츠',
    other: '기타',
    
    // Priority Levels
    critical: '긴급',
    high: '높음',
    medium: '보통',
    low: '낮음',
    info: '정보',
    
    // Priority Descriptions
    criticalDesc: '즉시 조치 필요 (폭력적 콘텐츠, 불법 활동)',
    highDesc: '24시간 내 검토 필요 (괴롭힘, 혐오 발언)',
    mediumDesc: '3일 내 검토 필요 (스팸, 부적절한 콘텐츠)',
    lowDesc: '7일 내 검토 가능 (경미한 규칙 위반)',
    infoDesc: '정보성 신고 (검토 우선순위 낮음)',
    
    // Actions
    review: '검토',
    approve: '승인',
    dismiss: '기각',
    escalate: '에스컬레이션',
    takeAction: '조치하기',
    
    // Action Options
    removeContent: '콘텐츠 삭제',
    warnUser: '사용자 경고',
    suspendUser: '사용자 정지',
    banUser: '사용자 차단',
    noAction: '조치 없음',
    
    // Status Descriptions
    statusDescriptions: {
      pending: '신규 신고 - 검토 대기 중',
      under_review: '관리자가 현재 검토 중',
      resolved: '신고 확인 및 조치 완료',
      dismissed: '신고 내용 부적합 - 기각',
      escalated: '중요 사안 - 상위 관리자 검토 필요',
    },
    
    // Automatic Actions
    autoActions: {
      autoEscalation: '동일 대상 5건 이상 신고 시 자동 상위 보고',
      autoHide: '동일 대상 10건 이상 신고 시 자동 숨김 처리',
    },
    
    // Messages
    targetNotFound: '대상이 삭제되었거나 찾을 수 없음',
    noReportsFound: '신고가 없습니다',
    loadingReports: '신고 불러오는 중...',
    
    // Review Dialog
    reviewReport: '신고 검토',
    reportDetails: '신고 상세',
    moderatorNotes: '관리자 메모',
    notesPlaceholder: '검토 내용을 입력하세요...',
    updateStatus: '상태 업데이트',
    actionTaken: '취한 조치',
  },

  // Settings Page
  settings: {
    title: '설정',
    subtitle: '시스템 설정 및 구성',
    
    // Sections
    general: '일반 설정',
    security: '보안 설정',
    email: '이메일 설정',
    appearance: '외관 설정',
    advanced: '고급 설정',
    
    // General Settings
    siteName: '사이트 이름',
    siteDescription: '사이트 설명',
    siteUrl: '사이트 URL',
    timezone: '시간대',
    language: '언어',
    dateFormat: '날짜 형식',
    
    // Security Settings
    twoFactorAuth: '2단계 인증',
    sessionTimeout: '세션 시간 초과',
    passwordPolicy: '비밀번호 정책',
    loginAttempts: '로그인 시도 제한',
    
    // Email Settings
    smtpHost: 'SMTP 호스트',
    smtpPort: 'SMTP 포트',
    smtpUser: 'SMTP 사용자',
    smtpPassword: 'SMTP 비밀번호',
    fromEmail: '발신 이메일',
    fromName: '발신자 이름',
    
    // Actions
    saveSettings: '설정 저장',
    resetDefaults: '기본값으로 재설정',
    testConnection: '연결 테스트',
    
    // Messages
    settingsSaved: '설정이 저장되었습니다',
    settingsError: '설정 저장 중 오류가 발생했습니다',
  },

  // Common Messages
  messages: {
    loading: '불러오는 중...',
    saving: '저장 중...',
    deleting: '삭제 중...',
    success: '성공',
    error: '오류',
    warning: '경고',
    info: '정보',
    
    confirmDelete: '정말로 삭제하시겠습니까?',
    confirmAction: '이 작업을 수행하시겠습니까?',
    cannotUndo: '이 작업은 되돌릴 수 없습니다.',
    
    noData: '데이터가 없습니다',
    noResults: '검색 결과가 없습니다',
    tryAgain: '다시 시도해주세요',
    
    unauthorized: '권한이 없습니다',
    sessionExpired: '세션이 만료되었습니다',
    loginRequired: '로그인이 필요합니다',
    
    updateSuccess: '업데이트가 완료되었습니다',
    updateError: '업데이트 중 오류가 발생했습니다',
    deleteSuccess: '삭제가 완료되었습니다',
    deleteError: '삭제 중 오류가 발생했습니다',
  },

  // Date/Time
  dateTime: {
    today: '오늘',
    yesterday: '어제',
    thisWeek: '이번 주',
    lastWeek: '지난 주',
    thisMonth: '이번 달',
    lastMonth: '지난 달',
    days: '일',
    hours: '시간',
    minutes: '분',
    seconds: '초',
    ago: '전',
  },

  // Pagination
  pagination: {
    previous: '이전',
    next: '다음',
    page: '페이지',
    of: '/',
    total: '전체',
    showing: '표시',
    to: '~',
    entries: '개 항목',
  },
};

// Type-safe translation helper
export type TranslationKey = keyof typeof adminTranslations;
export type TranslationSection<T extends TranslationKey> = keyof typeof adminTranslations[T];

export const t = adminTranslations;