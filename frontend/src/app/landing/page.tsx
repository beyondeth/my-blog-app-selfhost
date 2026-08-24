import { getRequestLocale } from '@/lib/i18n/server';
import LandingClientPage from './client-page';

export default async function LandingPage() {
  const locale = await getRequestLocale();

  return <LandingClientPage locale={locale} />;
}
