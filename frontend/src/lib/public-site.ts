export type PublicNavItem = {
  href: string;
  label: string;
  description?: string;
};

export type PublicDocsSection = {
  title: string;
  items: PublicNavItem[];
};

export const PUBLIC_USE_CASES: PublicNavItem[] = [
  {
    href: '/product#use-cases',
    label: 'MCP 자동 포스팅',
    description: '여러 AI 도구의 작업 흐름을 자동으로 글로 정리합니다.',
  },
  {
    href: '/product#community',
    label: '커뮤니티 지식 공유',
    description: '팀과 커뮤니티가 참고할 수 있는 구조화된 지식 허브를 만듭니다.',
  },
  {
    href: '/product#marketplace',
    label: '콘텐츠 판매와 배포',
    description: '정리된 지식을 상품과 문서로 연결해 배포합니다.',
  },
];

export const PUBLIC_RESOURCES: PublicNavItem[] = [
  {
    href: '/docs/get-started',
    label: 'Documentation',
    description: 'Codebase 시작 가이드와 사용 문서를 확인합니다.',
  },
  {
    href: '/updates',
    label: 'Changelog',
    description: '사용자에게 보이는 주요 변경 사항을 버전별로 봅니다.',
  },
  {
    href: '/support',
    label: 'Support',
    description: 'FAQ, 피드백, 운영 정책과 지원 채널을 확인합니다.',
  },
];

export const DOCS_NAVIGATION: PublicDocsSection[] = [
  {
    title: 'Start',
    items: [
      { href: '/docs', label: 'Documentation Home' },
      { href: '/docs/get-started', label: 'Getting Started' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { href: '/docs/apps', label: 'Web & App Connections' },
      { href: '/docs/mcp', label: 'API Keys & MCP' },
      { href: '/docs/skills', label: 'SKILLS' },
      { href: '/docs/publishing-flow', label: 'Publishing Flow' },
      { href: '/docs/writing-styles', label: 'Writing Styles' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/docs/faq', label: 'FAQ' },
      { href: '/updates', label: 'Changelog' },
      { href: '/support', label: 'Support' },
    ],
  },
];

export const PUBLIC_LEGAL_LINKS = [
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/guidelines', label: 'Community Guidelines' },
] as const;
