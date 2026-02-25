import axios from 'axios';
import type { ToolContext } from '../types.js';

export function toPublicPostUrl(pathOrUrl: string, frontendBaseUrl: string): string {
  if (!pathOrUrl) return frontendBaseUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const base = frontendBaseUrl.endsWith('/') ? frontendBaseUrl : `${frontendBaseUrl}/`;
  const relativePath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;

  return new URL(relativePath, base).toString();
}

export function toPublicBlogUrl(blogSlug: string, frontendBaseUrl: string): string {
  if (!blogSlug) return frontendBaseUrl;
  const base = frontendBaseUrl.endsWith('/') ? frontendBaseUrl : `${frontendBaseUrl}/`;
  return new URL(blogSlug, base).toString();
}

export function buildBackendAuthHeaders(context: ToolContext): Record<string, string> {
  const headers: Record<string, string> = {};

  if (context.apiKey) {
    headers['X-API-Key'] = context.apiKey;
  } else if (context.oauthToken) {
    headers['Authorization'] = `Bearer ${context.oauthToken}`;
    headers['X-OAuth-User-Id'] = context.userData.userId;
    headers['X-OAuth-Blog-Id'] = context.userData.blogId;
  }

  if (context.config.MCP_SHARED_SECRET) {
    headers['X-Internal-Secret'] = context.config.MCP_SHARED_SECRET;
  }

  return headers;
}

/**
 * MCP API Key의 postsCreated 카운트 증가 (비동기)
 */
export async function incrementPostsCreated(
  keyId: string,
  backendUrl: string,
  sharedSecret?: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (sharedSecret) {
    headers['X-Internal-Secret'] = sharedSecret;
  }

  await axios.post(
    `${backendUrl}/api/v1/mcp/keys/${keyId}/increment-posts`,
    {},
    { timeout: 3000, headers }
  );
}
