export const SUPPORTED_LOCALES = ['en', 'ko'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE_NAME = 'cb_locale';
export const LOCALE_HEADER_NAME = 'x-codebase-locale';

const LOCALIZED_ROUTE_PATTERNS = [
  /^\/product(?:\/|$)/,
  /^\/pricing(?:\/|$)/,
  /^\/updates(?:\/|$)/,
  /^\/support(?:\/|$)/,
  /^\/landing(?:\/|$)/,
  /^\/docs(?:\/|$)/,
  /^\/legal(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/register(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
  /^\/consent(?:\/|$)/,
  /^\/auth\/mcp-consent(?:\/|$)/,
];

function splitPathSuffix(pathname: string) {
  const match = pathname.match(/^([^?#]*)(.*)$/);
  return {
    path: match?.[1] || pathname,
    suffix: match?.[2] || '',
  };
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as AppLocale));
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }

  const normalized = value.toLowerCase().trim();
  if (isSupportedLocale(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('ko')) {
    return 'ko';
  }

  return DEFAULT_LOCALE;
}

export function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

export function detectPreferredLocale(acceptLanguage: string | null | undefined): AppLocale {
  return DEFAULT_LOCALE;
}

export function extractLocaleFromPathname(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  const segments = normalizedPathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (!isSupportedLocale(firstSegment)) {
    return {
      locale: null,
      hasLocalePrefix: false,
      pathnameWithoutLocale: normalizedPathname,
    };
  }

  const pathnameWithoutLocale = `/${segments.slice(1).join('/')}`.replace(/\/$/, '') || '/';

  return {
    locale: firstSegment,
    hasLocalePrefix: true,
    pathnameWithoutLocale,
  };
}

export function stripLocalePrefix(pathname: string): string {
  return extractLocaleFromPathname(pathname).pathnameWithoutLocale;
}

export function shouldLocalizePath(pathname: string): boolean {
  const { path } = splitPathSuffix(pathname);
  const normalizedPathname = stripLocalePrefix(path);
  return LOCALIZED_ROUTE_PATTERNS.some((pattern) => pattern.test(normalizedPathname));
}

export function localizePath(pathname: string, _locale?: AppLocale): string {
  if (!pathname.startsWith('/')) {
    return pathname;
  }

  const { path, suffix } = splitPathSuffix(pathname);
  const { pathnameWithoutLocale } = extractLocaleFromPathname(path);
  return `${pathnameWithoutLocale}${suffix}`;
}
