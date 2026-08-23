import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './cdn-proxy.js';

test('rejects write methods without contacting OCI', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('unexpected');
  };

  try {
    const response = await worker.fetch(
      new Request('https://cdn.aigory.com/uploads/file.webp', { method: 'PUT' }),
      { ORIGIN_BASE_URL: 'https://object.example/o' },
    );
    assert.equal(response.status, 405);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects encoded traversal paths', async () => {
  const response = await worker.fetch(
    new Request('https://cdn.aigory.com/uploads/%2e%2e%2fsecret'),
    { ORIGIN_BASE_URL: 'https://object.example/o' },
  );
  assert.equal(response.status, 404);
});

test('proxies safe reads and strips OCI headers', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response('image', {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        etag: 'test-etag',
        'opc-request-id': 'internal',
      },
    });
  };

  try {
    const response = await worker.fetch(
      new Request('https://cdn.aigory.com/uploads/image.webp'),
      { ORIGIN_BASE_URL: 'https://object.example/o' },
    );
    assert.equal(requestedUrl, 'https://object.example/o/uploads/image.webp');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('opc-request-id'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not expose origin configuration errors', async () => {
  const response = await worker.fetch(
    new Request('https://cdn.aigory.com/uploads/file.webp'),
    {},
  );
  assert.equal(response.status, 500);
  assert.equal(await response.text(), 'Internal Server Error');
});
