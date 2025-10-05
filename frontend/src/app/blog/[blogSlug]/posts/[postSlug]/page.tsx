import { redirect } from 'next/navigation';

/**
 * 레거시 포스트 상세 라우트 - 301 리다이렉트
 *
 * 기존 URL: /blog/[blogSlug]/posts/[postSlug]
 * 새 URL: /[blogSlug]/[postSlug]
 *
 * SEO 유지를 위한 영구 리다이렉트
 */
export default function LegacyPostDetailPage({
  params
}: {
  params: { blogSlug: string; postSlug: string }
}) {
  redirect(`/${params.blogSlug}/${params.postSlug}`);
}
