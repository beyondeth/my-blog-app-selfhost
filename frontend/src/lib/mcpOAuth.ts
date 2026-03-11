export const MCP_OAUTH_SESSION_KEY = 'mcpOAuth';

export type McpOAuthSessionData = {
  state: string;
  callback_url: string;
  client_name: string;
  scope: string;
};

export function parseMcpOAuthSessionData(raw: string | null): McpOAuthSessionData | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<McpOAuthSessionData>;
    if (!parsed.state || !parsed.callback_url) {
      return null;
    }

    return {
      state: parsed.state,
      callback_url: parsed.callback_url,
      client_name: parsed.client_name || 'MCP Client',
      scope: parsed.scope || 'mcp:tools',
    };
  } catch {
    return null;
  }
}

export function readMcpOAuthSession(): McpOAuthSessionData | null {
  if (typeof window === 'undefined') return null;
  return parseMcpOAuthSessionData(sessionStorage.getItem(MCP_OAUTH_SESSION_KEY));
}

export function writeMcpOAuthSession(data: McpOAuthSessionData): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(MCP_OAUTH_SESSION_KEY, JSON.stringify(data));
}

export function clearMcpOAuthSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(MCP_OAUTH_SESSION_KEY);
}

function buildMcpOAuthQueryString(data: McpOAuthSessionData): string {
  return new URLSearchParams({
    mcp_oauth: 'true',
    state: data.state,
    callback_url: data.callback_url,
    client_name: data.client_name,
    scope: data.scope,
  }).toString();
}

export function buildMcpOAuthConsentPath(data: McpOAuthSessionData): string {
  return `/auth/mcp-consent?${buildMcpOAuthQueryString(data)}`;
}

export function buildMcpOAuthLoginPath(data: McpOAuthSessionData): string {
  return `/login?${buildMcpOAuthQueryString(data)}`;
}

export function buildMcpOAuthDeniedCallbackUrl(data: McpOAuthSessionData): string {
  const callbackUrl = new URL(data.callback_url);
  callbackUrl.searchParams.set('state', data.state);
  callbackUrl.searchParams.set('error', 'access_denied');
  callbackUrl.searchParams.set('error_description', 'User denied access');
  return callbackUrl.toString();
}
