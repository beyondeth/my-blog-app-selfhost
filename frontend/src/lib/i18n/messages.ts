import { DEFAULT_LOCALE, type AppLocale } from './config';

type MessageValue = string | MessageTree;

type MessageTree = {
  [key: string]: MessageValue;
};

const en: MessageTree = {
  locale: {
    en: 'English',
    ko: 'Legacy Korean',
    switcher: 'Language',
  },
  common: {
    back: 'Back',
    loading: 'Loading...',
    cancel: 'Cancel',
    save: 'Save',
  },
  connections: {
    title: 'Connections',
    following: 'Following',
    followers: 'Followers',
    emptyFollowing: 'No following users yet.',
    emptyFollowers: 'No followers yet.',
  },
  followButton: {
    loading: 'Loading...',
    unfollowed: 'Unfollowed',
    following: 'Following',
    follow: 'Follow',
    followers: 'Followers',
    loginRequired: 'Login is required.',
    cannotFollowSelf: 'You cannot follow yourself.',
    updateFailed: 'Failed to update follow status.',
    titleFollowing: 'Following',
    titleFollow: 'Follow',
  },
  profileCard: {
    followers: 'Followers',
    visitBlog: 'Visit blog',
    report: 'Report',
    block: 'Block',
  },
  publicSite: {
    header: {
      docsSidebar: 'Toggle docs sidebar',
      features: 'Features',
      useCases: 'Use Cases',
      community: 'Community',
      pricing: 'Pricing',
      docs: 'Docs',
      getStarted: 'Get started',
      openApp: 'Open app',
      mobileMenu: 'Open public site menu',
    },
    useCases: {
      autopost: {
        label: 'Automated MCP publishing',
        description: 'Turn AI conversations into structured posts with a single workflow.',
      },
      community: {
        label: 'Community knowledge sharing',
        description: 'Publish what your team learns and keep it discoverable for others.',
      },
      marketplace: {
        label: 'Knowledge distribution',
        description: 'Prepare guides and assets for future distribution without opening billing yet.',
      },
    },
    resources: {
      docs: {
        label: 'Documentation',
        description: 'Learn the product flow and connection guides.',
      },
      updates: {
        label: 'Changelog',
        description: 'See product updates and release notes.',
      },
      support: {
        label: 'Support',
        description: 'Open help resources, FAQ, and support channels.',
      },
    },
    legal: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      guidelines: 'Community Guidelines',
    },
    footer: {
      resources: 'Resources',
      legal: 'Legal',
      description:
        'Codebase turns everyday AI conversations into structured knowledge for teams, communities, and individual builders.',
      cookiePreferences: 'Cookie preferences',
    },
  },
  legal: {
    privacyTitle: 'Privacy Policy',
    privacyDescription: 'Read how Codebase collects, uses, and protects personal data.',
    termsTitle: 'Terms of Service',
    termsDescription: 'Review the terms that govern your use of Codebase.',
    guidelinesTitle: 'Community Guidelines',
    guidelinesDescription: 'Read the rules and expectations for participating in the community.',
    marketingTitle: 'Marketing Consent',
    marketingDescription: 'Review the optional marketing consent terms.',
    newsletterTitle: 'Newsletter Consent',
    newsletterDescription: 'Review the optional newsletter consent terms.',
    loadError: 'We could not load this document. Please try again later.',
    backToTop: 'Back to top',
  },
  auth: {
    consent: {
      heading: 'Review and continue',
      subheading: 'Please review the required terms before using the service.',
      over16: 'I confirm that I am at least 14 years old.',
      terms: 'I agree to the Terms of Service (required)',
      privacy: 'I agree to the Privacy Policy (required)',
      marketing: 'I want to receive product updates and promotional emails (optional)',
      newsletter: 'I want to receive newsletter updates (optional)',
      all: 'Accept all',
      submit: 'Continue',
      success: 'Your preferences have been saved.',
      ageError: 'This service is available only to users aged 14 or older.',
      requiredError: 'Please agree to the required terms.',
      submitError: 'We could not save your consent. Please try again.',
      pageTitle: 'Terms and privacy',
      pageDescription: 'Complete the required consent step to finish sign in.',
    },
  },
  cookieConsent: {
    title: 'Privacy settings',
    description:
      'Essential cookies keep Codebase secure and functional. Optional analytics only run after your approval.',
    accept: 'Accept analytics',
    reject: 'Reject analytics',
    manage: 'Privacy settings',
    save: 'Save settings',
    saved: 'Your privacy settings have been updated.',
    essentialTitle: 'Essential cookies',
    essentialDescription: 'Required for sign-in, account security, and core site functionality.',
    analyticsTitle: 'Analytics',
    analyticsDescription:
      'Google Analytics and Mixpanel are loaded only after you explicitly opt in.',
    alwaysOn: 'Always on',
  },
  beta: {
    billingDisabledTitle: 'Billing is disabled during the free beta',
    billingDisabledDescription:
      'Pricing and payment flows remain in the codebase, but they are not exposed to public users during this beta launch.',
  },
};

const ko: MessageTree = {
  ...en,
  locale: {
    en: 'English',
    ko: '한국어',
    switcher: '언어',
  },
  common: {
    back: '뒤로',
    loading: '불러오는 중...',
    cancel: '취소',
    save: '저장',
  },
  publicSite: {
    header: {
      docsSidebar: '문서 사이드바 열기',
      features: '기능',
      useCases: '활용 사례',
      community: '커뮤니티',
      pricing: '요금',
      docs: '문서',
      getStarted: '시작하기',
      openApp: '앱 열기',
      mobileMenu: '공개 사이트 메뉴 열기',
    },
    useCases: {
      autopost: {
        label: 'MCP 자동 포스팅',
        description: 'AI 대화를 한 번의 작업 흐름으로 구조화된 글로 바꿉니다.',
      },
      community: {
        label: '커뮤니티 지식 공유',
        description: '팀이 배운 내용을 발행하고 다른 사람이 다시 찾을 수 있게 보관합니다.',
      },
      marketplace: {
        label: '지식 배포',
        description: '결제 기능을 공개하기 전에 가이드와 자료의 배포 구조를 준비합니다.',
      },
    },
    resources: {
      docs: {
        label: '문서',
        description: '제품 흐름과 연결 방법을 확인합니다.',
      },
      updates: {
        label: '변경 내역',
        description: '제품 업데이트와 릴리스 내용을 확인합니다.',
      },
      support: {
        label: '지원',
        description: '도움말, 자주 묻는 질문과 지원 채널을 엽니다.',
      },
    },
    legal: {
      privacy: '개인정보처리방침',
      terms: '이용약관',
      guidelines: '커뮤니티 가이드라인',
    },
    footer: {
      resources: '자료',
      legal: '법적 고지',
      description:
        'Codebase는 일상의 AI 대화를 팀, 커뮤니티와 개인 빌더가 다시 쓸 수 있는 구조화된 지식으로 바꿉니다.',
      cookiePreferences: '쿠키 설정',
    },
  },
};

const allMessages = {
  en,
  ko,
} as const satisfies Record<AppLocale, MessageTree>;

function getMessageValue(tree: MessageTree, key: string): MessageValue | undefined {
  return key.split('.').reduce<MessageValue | undefined>((acc, segment) => {
    if (!acc || typeof acc === 'string') {
      return undefined;
    }

    return acc[segment];
  }, tree);
}

export function getMessages(locale: AppLocale): MessageTree {
  return allMessages[locale] ?? allMessages[DEFAULT_LOCALE];
}

export function translate(locale: AppLocale, key: string): string {
  const value = getMessageValue(getMessages(locale), key);
  return typeof value === 'string' ? value : key;
}
