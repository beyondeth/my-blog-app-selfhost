const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

export async function getCsrfHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') {
    return {};
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_URL}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('CSRF token request failed');
        }
        const payload = (await response.json()) as { csrfToken?: string };
        if (!payload.csrfToken) {
          throw new Error('CSRF token missing from response');
        }
        csrfToken = payload.csrfToken;
        return payload.csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return { 'X-CSRF-Token': await csrfTokenPromise };
}
