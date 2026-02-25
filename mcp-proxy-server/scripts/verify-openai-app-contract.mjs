#!/usr/bin/env node

const EXPECTED_TOOLS = [
  'check_auth',
  'get_writing_style_guide',
  'create_post',
];
const EXPECTED_WIDGET_URI = 'ui://widget/codebase-dashboard-v20260224a.html';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function normalizeTools(payload) {
  return (payload?.tools || []).map((tool) => tool.name);
}

async function main() {
  const baseUrl = process.env.MCP_VERIFY_BASE_URL || 'http://localhost:3002';
  const endpoint = '/mcp-openai';
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      fail(`${endpoint} returned HTTP ${response.status}`);
      process.exit(process.exitCode || 1);
    }

    const payload = await response.json();
    const names = normalizeTools(payload);

    if (names.length !== EXPECTED_TOOLS.length) {
      fail(
        `${endpoint} tool count mismatch: expected ${EXPECTED_TOOLS.length}, got ${names.length}`
      );
    } else if (names.some((name, idx) => name !== EXPECTED_TOOLS[idx])) {
      fail(`${endpoint} tool order/name mismatch: ${names.join(', ')}`);
    } else {
      ok(`${endpoint} exposes expected MVP tool catalog`);
    }

    if (!Array.isArray(payload.authentication) || !payload.authentication.includes('oauth2')) {
      fail(`${endpoint} must declare oauth2 authentication`);
    } else {
      ok(`${endpoint} declares oauth2 authentication`);
    }

    if (payload?.endpoints?.jsonrpc !== '/mcp-openai') {
      fail(`${endpoint} endpoint jsonrpc must be /mcp-openai`);
    } else {
      ok(`${endpoint} endpoint metadata is valid`);
    }

    if (payload?.capabilities?.resources !== true) {
      fail(`${endpoint} must expose resources capability`);
    } else {
      ok(`${endpoint} declares resources capability`);
    }

    if (payload?.widget?.resourceUri !== EXPECTED_WIDGET_URI) {
      fail(`${endpoint} widget URI mismatch`);
    } else {
      ok(`${endpoint} widget URI metadata is valid`);
    }
  } catch (error) {
    fail(`${endpoint} contract check failed: ${error.message}`);
  }

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

await main();
