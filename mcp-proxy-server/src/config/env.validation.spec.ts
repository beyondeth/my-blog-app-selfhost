import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'development';
process.env.BACKEND_BASE_URL = 'http://backend:3000';
process.env.BACKEND_API_URL = 'http://backend:3000/api/v1';
process.env.BACKEND_PUBLIC_URL = 'http://localhost:3000';
process.env.PUBLIC_SITE_URL = 'http://localhost:3001';
process.env.MCP_BASE_URL = 'http://localhost:3002';
process.env.MCP_SHARED_SECRET = 'test-mcp-shared-secret-with-enough-entropy';
process.env.METRICS_AUTH_TOKEN = '';

const { config } = await import('./env.validation.js');

test('treats an empty optional metrics token as unset', () => {
  assert.equal(config.METRICS_AUTH_TOKEN, undefined);
});
