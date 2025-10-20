import { redirect } from 'next/navigation';

/**
 * 기존 /terms 페이지를 /legal/terms로 리다이렉트
 */
export default function TermsRedirect() {
  redirect('/legal/terms');
}
