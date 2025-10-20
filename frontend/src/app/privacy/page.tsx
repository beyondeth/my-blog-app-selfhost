import { redirect } from 'next/navigation';

/**
 * 기존 /privacy 페이지를 /legal/privacy로 리다이렉트
 */
export default function PrivacyRedirect() {
  redirect('/legal/privacy');
}
