import type { ToolContext } from '../core/types.js';
import type { ToolName } from './catalog.js';

const TOOL_REQUIRED_SCOPES: Record<ToolName, string[]> = {
  check_auth: ['mcp:tools'],
  list_my_published_posts: ['mcp:tools', 'mcp:read'],
  search_my_published_posts: ['mcp:tools', 'mcp:read'],
  read_my_published_post: ['mcp:tools', 'mcp:read'],
  get_writing_style_guide: ['mcp:tools'],
  create_post: ['mcp:tools', 'mcp:write'],
  get_image_upload_url: ['mcp:tools', 'mcp:write'],
  finalize_uploaded_image: ['mcp:tools', 'mcp:write'],
};

function parseScopes(scope: string | undefined): Set<string> {
  return new Set(
    (scope || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function getRequiredScopes(toolName: ToolName): string[] {
  return TOOL_REQUIRED_SCOPES[toolName] || ['mcp:tools'];
}

export function getScopeAuthorizationError(
  toolName: ToolName,
  context: ToolContext,
): { requiredScopes: string[]; grantedScopes: string[]; missingScopes: string[] } | null {
  // API Key route(/mcp)는 OAuth scope 개념을 사용하지 않으므로 기존 동작 유지
  if (!context.oauthToken) {
    return null;
  }

  const requiredScopes = getRequiredScopes(toolName);
  const grantedScopes = parseScopes(context.oauthScope);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));

  if (missingScopes.length === 0) {
    return null;
  }

  return {
    requiredScopes,
    grantedScopes: Array.from(grantedScopes),
    missingScopes,
  };
}
