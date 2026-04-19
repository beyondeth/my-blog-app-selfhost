export type PublicNavItem = {
  href: string;
  labelKey: string;
  descriptionKey?: string;
};

export type PublicDocsSection = {
  title: string;
  items: Array<{
    href: string;
    label: string;
  }>;
};

export const PUBLIC_USE_CASES: PublicNavItem[] = [
  {
    href: '/product#use-cases',
    labelKey: 'publicSite.useCases.autopost.label',
    descriptionKey: 'publicSite.useCases.autopost.description',
  },
  {
    href: '/product#community',
    labelKey: 'publicSite.useCases.community.label',
    descriptionKey: 'publicSite.useCases.community.description',
  },
  {
    href: '/product#marketplace',
    labelKey: 'publicSite.useCases.marketplace.label',
    descriptionKey: 'publicSite.useCases.marketplace.description',
  },
];

export const PUBLIC_RESOURCES: PublicNavItem[] = [
  {
    href: '/docs/get-started',
    labelKey: 'publicSite.resources.docs.label',
    descriptionKey: 'publicSite.resources.docs.description',
  },
  {
    href: '/updates',
    labelKey: 'publicSite.resources.updates.label',
    descriptionKey: 'publicSite.resources.updates.description',
  },
  {
    href: '/support',
    labelKey: 'publicSite.resources.support.label',
    descriptionKey: 'publicSite.resources.support.description',
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
  { href: '/legal/privacy', labelKey: 'publicSite.legal.privacy' },
  { href: '/legal/terms', labelKey: 'publicSite.legal.terms' },
  { href: '/legal/guidelines', labelKey: 'publicSite.legal.guidelines' },
] as const;
