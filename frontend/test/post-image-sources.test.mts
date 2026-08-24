import assert from 'node:assert/strict';
import test from 'node:test';
import { getPreferredPostImageSources } from '../src/utils/imageUtils.ts';

test('prefers the canonical uploaded image while preserving thumbnail order', () => {
  const proxyThumbnail =
    'http://localhost:3000/api/v1/files/proxy/uploads/image/2026/08/example.webp';
  const canonicalImage =
    'https://cdn.aigory.com/uploads/image/2026/08/example.webp';

  assert.deepEqual(
    getPreferredPostImageSources([canonicalImage], proxyThumbnail),
    [canonicalImage],
  );
});

test('keeps an explicitly selected thumbnail first and removes logical duplicates', () => {
  const first = 'https://cdn.aigory.com/uploads/image/first.webp';
  const selected = 'https://cdn.aigory.com/uploads/image/selected.webp';
  const selectedProxy = '/api/v1/files/proxy/uploads/image/selected.webp';

  assert.deepEqual(
    getPreferredPostImageSources([first, selectedProxy, selected], selectedProxy),
    [selected, first],
  );
});
