import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSafeMcpLoopbackCallback,
  getSafeRelativeRedirectPath,
} from '../src/lib/utils/sanitize.ts';
import { serializeJsonLd } from '../src/lib/security/json-ld.ts';
import { shouldHideProductionRoute } from '../src/lib/security/production-route-policy.ts';

test('allows only normalized app-relative login redirects', () => {
  assert.equal(
    getSafeRelativeRedirectPath('/settings/profile?tab=security#password'),
    '/settings/profile?tab=security#password',
  );
  assert.equal(getSafeRelativeRedirectPath('//evil.example/phish'), null);
  assert.equal(getSafeRelativeRedirectPath('/\\evil.example/phish'), null);
  assert.equal(getSafeRelativeRedirectPath('https://example.com/profile'), null);
  assert.equal(getSafeRelativeRedirectPath('javascript:alert(1)'), null);
});

test('allows only the exact MCP loopback callback', () => {
  assert.equal(
    getSafeMcpLoopbackCallback('http://localhost:7777/callback?code=ok'),
    'http://localhost:7777/callback?code=ok',
  );
  assert.equal(
    getSafeMcpLoopbackCallback('http://127.0.0.1:7777/callback?state=ok'),
    'http://127.0.0.1:7777/callback?state=ok',
  );
  assert.equal(
    getSafeMcpLoopbackCallback('https://localhost:7777/callback'),
    null,
  );
  assert.equal(
    getSafeMcpLoopbackCallback('http://localhost:7778/callback'),
    null,
  );
  assert.equal(
    getSafeMcpLoopbackCallback('http://localhost:7777/callback/extra'),
    null,
  );
  assert.equal(
    getSafeMcpLoopbackCallback(
      'https://evil.example/?next=localhost:7777/callback',
    ),
    null,
  );
  assert.equal(
    getSafeMcpLoopbackCallback('javascript:alert(1)//localhost:7777/callback'),
    null,
  );
});

test('escapes JSON-LD script breakout characters without changing data', () => {
  const value = {
    title: '</script><script>alert(1)</script>',
    text: 'a&b\u2028c\u2029d',
  };
  const serialized = serializeJsonLd(value);

  assert.equal(serialized.includes('</script>'), false);
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('>'), false);
  assert.equal(serialized.includes('&'), false);
  assert.equal(serialized.includes('\u2028'), false);
  assert.equal(serialized.includes('\u2029'), false);
  assert.deepEqual(JSON.parse(serialized), value);
});

test('keeps payments hidden and gates admin debug behind the server flag', () => {
  for (const pathname of [
    '/pricing',
    '/pricing/team',
    '/account/subscription',
    '/mock-checkout/result',
  ]) {
    assert.equal(shouldHideProductionRoute(pathname, true), true);
  }

  assert.equal(shouldHideProductionRoute('/admin/debug', false), true);
  assert.equal(shouldHideProductionRoute('/admin/debug/jobs', false), true);
  assert.equal(shouldHideProductionRoute('/admin/debug', true), false);
  assert.equal(shouldHideProductionRoute('/pricing-preview', false), false);
});
