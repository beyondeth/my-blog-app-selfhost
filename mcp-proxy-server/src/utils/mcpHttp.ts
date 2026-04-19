import type { Response } from 'express';

const MCP_ROUTE_PREFIXES = ['/mcp', '/mcp-remote', '/mcp-openai', '/oauth', '/.well-known'];
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const TRUSTED_BROWSER_HOST_SUFFIXES = ['antigravity.google', 'chatgpt.com', 'claude.ai'];

export const MCP_CORS_ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'MCP-Protocol-Version',
  'MCP-Session-Id',
  'Last-Event-ID',
].join(', ');

export const MCP_CORS_EXPOSE_HEADERS = [
  'MCP-Session-Id',
  'WWW-Authenticate',
].join(', ');

export function isMcpEndpointPath(pathname: string): boolean {
  return MCP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAllowedMcpBrowserOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const { hostname, protocol } = parsed;

    if (LOCAL_HOSTNAMES.has(hostname)) {
      return protocol === 'http:' || protocol === 'https:';
    }

    if (protocol !== 'https:') {
      return false;
    }

    return TRUSTED_BROWSER_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function applyMcpStreamingHeaders(res: Response): void {
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');
}
