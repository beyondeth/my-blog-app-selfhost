/**
 * 블로그 URL 관련 유틸리티 함수
 *
 * alias와 slug에 따른 일관된 URL 생성을 담당합니다.
 * 항상 alias를 우선적으로 사용하고, 없을 경우 slug를 사용합니다.
 */

export interface BlogIdentifier {
  alias?: string | null;
  slug: string;
}

export interface PostIdentifier {
  slug?: string | null;
  id: string;
}

/**
 * 블로그 URL 생성
 * @param blog - 블로그 정보 (alias 또는 slug 필드 필요)
 * @returns 블로그 URL (@alias 우선, 없으면 /slug)
 *
 * @example
 * getBlogUrl({ alias: 'park', slug: 'user123' }) // '/@park'
 * getBlogUrl({ alias: null, slug: 'user123' }) // '/user123'
 */
export function getBlogUrl(blog: BlogIdentifier): string {
  // Defensive coding: blog 객체 유효성 검사
  if (!blog) {
    console.warn('[getBlogUrl] blog 객체가 없습니다');
    return '#';
  }

  // Defensive coding: slug 필드 필수 확인
  if (!blog.slug) {
    console.warn('[getBlogUrl] blog.slug가 없습니다:', blog);
    return '#';
  }

  // alias가 있고 비어있지 않으면 @alias 형태로 반환
  if (blog.alias && blog.alias.trim() !== '') {
    return `/@${blog.alias.trim()}`;
  }

  // alias가 없거나 비어있으면 slug로 반환
  return `/${blog.slug}`;
}

/**
 * 포스트 URL 생성
 * @param blog - 블로그 정보
 * @param post - 포스트 정보
 * @returns 포스트 전체 URL
 *
 * @example
 * getPostUrl({ alias: 'park', slug: 'user123' }, { slug: 'my-post', id: 'abc' })
 * // '/@park/my-post'
 *
 * getPostUrl({ alias: null, slug: 'user123' }, { slug: 'my-post', id: 'abc' })
 * // '/user123/my-post'
 */
export function getPostUrl(blog: BlogIdentifier, post: PostIdentifier): string {
  const blogUrl = getBlogUrl(blog);

  // 포스트 slug가 있으면 사용, 없으면 id 사용
  const postIdentifier = post.slug || post.id;

  return `${blogUrl}/${postIdentifier}`;
}

/**
 * 사용자 프로필에서 블로그 링크 생성 시 사용
 * UserAvatar, UserProfileCard 등에서 사용
 */
export function getBlogLinkFromUser(user: { blog?: { alias?: string | null; slug: string } | null }): string {
  if (!user?.blog) {
    return '#';
  }

  return getBlogUrl(user.blog);
}