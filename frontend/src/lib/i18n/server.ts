import { DEFAULT_LOCALE, type AppLocale } from './config';

export async function getRequestLocale(): Promise<AppLocale> {
  return DEFAULT_LOCALE;
}
