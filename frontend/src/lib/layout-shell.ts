const LAYOUTLESS_PATHS = new Set([
  '/mock-home-shell',
  '/mock-home-shell-ko',
  '/mock-home-shell-ink',
  '/mock-home-shell-harbor',
  '/mock-home-shell-harbor-white',
]);

const AUTH_PATH_PREFIXES = [
  '/login',
  '/register',
  '/consent',
  '/forgot-password',
  '/reset-password',
];

const LEGAL_PATH_PREFIXES = [
  '/legal/terms',
  '/legal/privacy',
  '/legal/marketing-consent',
  '/legal/newsletter-consent',
  '/legal/guidelines',
];

const ALWAYS_PUBLIC_PATH_PREFIXES = [
  '/product',
  '/pricing',
  '/updates',
  '/support',
  '/docs',
  '/legal',
  '/landing',
  '/community',
];

const COMMUNITY_RESTRICTED_SEGMENTS = new Set([
  'create',
  'submit',
  'settings',
  'report-moderator',
  'flairs',
  'edit',
]);

const BLOG_RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  'account',
  'admin',
  'analytics',
  'api',
  'auth',
  'blog',
  'bookmarks',
  'c',
  'community',
  'consent',
  'desktop',
  'dm',
  'docs',
  'drafts',
  'forgot-password',
  'invite',
  'landing',
  'legal',
  'login',
  'marketplace',
  'mobile',
  'mock-checkout',
  'mock-home-shell',
  'mock-home-shell-harbor',
  'mock-home-shell-harbor-white',
  'mock-home-shell-ink',
  'mock-home-shell-ko',
  'new-story',
  'p',
  'pricing',
  'privacy',
  'product',
  'register',
  'replica',
  'reset-password',
  'settings',
  'simple',
  'subscription',
  'support',
  'terms',
  'updates',
]);

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getPathSegments(pathname: string) {
  return pathname.split('/').filter(Boolean);
}

function safeDecode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function isLayoutlessPath(pathname: string) {
  return LAYOUTLESS_PATHS.has(pathname);
}

export function isAuthPath(pathname: string) {
  return AUTH_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function isLegalPath(pathname: string) {
  return LEGAL_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function isAlwaysPublicPath(pathname: string) {
  return ALWAYS_PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function isLoggedOutLandingPath(pathname: string) {
  return pathname === '/';
}

export function isPublicCommunityPath(pathname: string) {
  const segments = getPathSegments(pathname);

  if (segments[0] !== 'c') {
    return false;
  }

  return !segments.some((segment) => COMMUNITY_RESTRICTED_SEGMENTS.has(segment));
}

export function isPotentialPublicBlogPath(pathname: string) {
  const segments = getPathSegments(pathname);

  if (segments.length === 0 || segments.length > 2) {
    return false;
  }

  const normalizedFirstSegment = safeDecode(segments[0]).replace(/^@/, '');

  if (!normalizedFirstSegment) {
    return false;
  }

  return !BLOG_RESERVED_TOP_LEVEL_SEGMENTS.has(normalizedFirstSegment);
}
