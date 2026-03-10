const MCP_FULL_SCOPE = ['mcp:tools', 'mcp:read', 'mcp:write'] as const;

export function normalizeLegacyScope(scope?: string): string {
  const tokens = (scope || '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return MCP_FULL_SCOPE.join(' ');
  }

  const unique = Array.from(new Set(tokens));
  const hasTools = unique.includes('mcp:tools');
  const hasRead = unique.includes('mcp:read');
  const hasWrite = unique.includes('mcp:write');

  // Legacy mcporter clients hard-code `mcp:tools`.
  // Keep backwards compatibility by upgrading that exact legacy request
  // to the full tool/read/write scope set.
  if (hasTools && !hasRead && !hasWrite && unique.length === 1) {
    return MCP_FULL_SCOPE.join(' ');
  }

  if (hasRead && !hasTools) {
    unique.unshift('mcp:tools');
  }

  if (hasWrite && !unique.includes('mcp:tools')) {
    unique.unshift('mcp:tools');
  }

  return unique.join(' ');
}

export function expandLegacyScopeTokens(scope?: string): Set<string> {
  return new Set(
    normalizeLegacyScope(scope)
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}
