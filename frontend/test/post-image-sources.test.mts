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

test('keeps a configured public CDN URL instead of converting it back to the API proxy', async () => {
  const previousCdnBaseUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL;
  const previousStoragePublicUrl = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL;
  process.env.NEXT_PUBLIC_CDN_BASE_URL = 'https://cdn.aigory.com';
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL = 'https://cdn.aigory.com';

  try {
    const configuredModule = await import('../src/utils/imageUtils.ts?configured-cdn');
    const cdnImage = 'https://cdn.aigory.com/uploads/image/example.webp';

    assert.equal(configuredModule.normalizeImageUrl(cdnImage), cdnImage);
  } finally {
    if (previousCdnBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CDN_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_CDN_BASE_URL = previousCdnBaseUrl;
    }
    if (previousStoragePublicUrl === undefined) {
      delete process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL;
    } else {
      process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL = previousStoragePublicUrl;
    }
  }
});
