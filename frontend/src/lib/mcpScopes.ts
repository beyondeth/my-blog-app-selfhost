export type McpScopeInfo = {
  scope: string;
  label: string;
  description: string;
};

export const MCP_SCOPE_INFO: Record<string, McpScopeInfo> = {
  'mcp:tools': {
    scope: 'mcp:tools',
    label: '도구 연결',
    description: '인증 확인과 글쓰기 스타일 가이드를 사용할 수 있습니다.',
  },
  'mcp:read': {
    scope: 'mcp:read',
    label: '내 발행글 조회',
    description: '내가 발행한 글 목록을 찾고, 검색하고, 본문을 읽을 수 있습니다.',
  },
  'mcp:write': {
    scope: 'mcp:write',
    label: '포스트 작성',
    description: '새 글 작성과 이미지 업로드를 실행할 수 있습니다.',
  },
};

export function parseMcpScopes(scopeValue?: string | null): McpScopeInfo[] {
  const uniqueScopes = [...new Set((scopeValue ?? '').split(/\s+/).map((scope) => scope.trim()).filter(Boolean))];

  return uniqueScopes.map((scope) => {
    return MCP_SCOPE_INFO[scope] ?? {
      scope,
      label: scope,
      description: '연결된 앱이 이 권한을 요청했습니다.',
    };
  });
}

export function getMcpScopeLabel(scope: string): string {
  return MCP_SCOPE_INFO[scope]?.label ?? scope;
}
