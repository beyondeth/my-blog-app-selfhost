import { cookies, headers } from 'next/headers';
import {
  detectPreferredLocale,
  isSupportedLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  type AppLocale,
} from './config';

export async function getRequestLocale(): Promise<AppLocale> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const requestLocale = headerStore.get(LOCALE_HEADER_NAME);

  if (isSupportedLocale(requestLocale)) {
    return requestLocale;
  }

  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return detectPreferredLocale(headerStore.get('accept-language'));
}
