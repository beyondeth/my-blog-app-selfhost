import { permanentRedirect } from 'next/navigation';

/**
 * 레거시 블로그 홈 라우트 - 301 리다이렉트
 *
 * 기존 URL: /blog/[blogSlug]
 * 새 URL: /[blogSlug]
 *
 * SEO 유지를 위한 영구 리다이렉트
 */
export default async function LegacyBlogHomePage({
  params
}: {
  params: Promise<{ blogSlug: string }>
}) {
  const { blogSlug } = await params;
  permanentRedirect(`/${blogSlug}`);
}
