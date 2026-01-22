/**
 * 서버 컴포넌트용 공통 fetch 헬퍼
 *
 * @description
 * - 서버 컴포넌트에서 백엔드 API 호출 시 사용
 * - 인증이 필요한 요청은 access_token 쿠키를 자동으로 전달
 * - refresh_token은 전달하지 않음 (보안 원칙)
 *
 * @example
 * // 공개 데이터 조회 (캐시 사용)
 * const post = await fetchPublic<Post>('/posts/123');
 *
 * // 인증된 데이터 조회 (캐시 비활성화)
 * const community = await fetchAuthed<Community>('/community/my-community');
 */

import { cookies } from 'next/headers';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 인증 쿠키 헤더 생성 (access_token만 전달)
 *
 * @description
 * - refresh_token은 보안상 전달하지 않음
 * - access_token이 없으면 undefined 반환
 */
export async function getAuthCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();

  // Next.js 15+ ReadonlyRequestCookies 호환
  const readCookieValue = (name: string): string | undefined => {
    if (
      cookieStore &&
      typeof (cookieStore as { get?: (key: string) => { value?: string } | undefined }).get ===
        'function'
    ) {
      return (cookieStore as { get: (key: string) => { value?: string } | undefined })
        .get(name)
        ?.value;
    }
    if (
      cookieStore &&
      typeof (cookieStore as { getAll?: () => Array<{ name: string; value: string }> }).getAll ===
        'function'
    ) {
      const allCookies = (
        cookieStore as { getAll: () => Array<{ name: string; value: string }> }
      ).getAll();
      return allCookies.find((cookie) => cookie.name === name)?.value;
    }
    return undefined;
  };

  const accessToken = readCookieValue('access_token');

  // access_token만 전달 (refresh_token은 보안상 전달하지 않음)
  return accessToken ? `access_token=${accessToken}` : undefined;
}

/**
 * 공개 데이터 조회 (캐시 사용)
 *
 * @description
 * - 인증 쿠키 없이 요청
 * - ISR 캐시 사용 (기본 60초)
 * - SEO 메타데이터 생성에 적합
 *
 * @param endpoint - API 엔드포인트 (예: '/posts/123')
 * @param options - 캐시 옵션
 * @returns 데이터 또는 null
 */
export async function fetchPublic<T>(
  endpoint: string,
  options?: { revalidate?: number }
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      next: { revalidate: options?.revalidate ?? 60 },
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      // 403 (비공개 커뮤니티) 등 다른 에러도 null 반환
      return null;
    }

    const json = await res.json();
    return json.success !== false ? (json.data ?? json) : null;
  } catch (error) {
    console.error(`[serverFetch] fetchPublic error for ${endpoint}:`, error);
    return null;
  }
}

/**
 * 인증된 데이터 조회 (캐시 비활성화)
 *
 * @description
 * - access_token 쿠키를 백엔드에 전달
 * - 캐시 비활성화 (개인화 데이터)
 * - 쿠키가 없으면 fetchPublic으로 폴백
 *
 * @param endpoint - API 엔드포인트 (예: '/community/my-community')
 * @returns 데이터 또는 null
 */
export async function fetchAuthed<T>(endpoint: string): Promise<T | null> {
  const cookieHeader = await getAuthCookieHeader();

  // 쿠키가 없으면 공개 조회로 폴백
  if (!cookieHeader) {
    return fetchPublic<T>(endpoint);
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      cache: 'no-store', // 개인화 데이터는 캐시 비활성화
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      // 403 (비공개 커뮤니티 접근 불가) 등
      if (res.status === 403) return null;
      return null;
    }

    const json = await res.json();
    return json.success !== false ? (json.data ?? json) : null;
  } catch (error) {
    console.error(`[serverFetch] fetchAuthed error for ${endpoint}:`, error);
    return null;
  }
}

/**
 * 인증 여부에 따라 적절한 fetch 선택
 *
 * @description
 * - 쿠키가 있으면 인증 요청, 없으면 공개 요청
 * - generateMetadata와 Page 컴포넌트 간 중복 호출 방지에 적합
 *
 * @param endpoint - API 엔드포인트
 * @returns 데이터 또는 null
 */
export async function fetchWithAuth<T>(endpoint: string): Promise<T | null> {
  const cookieHeader = await getAuthCookieHeader();
  return cookieHeader ? fetchAuthed<T>(endpoint) : fetchPublic<T>(endpoint);
}
