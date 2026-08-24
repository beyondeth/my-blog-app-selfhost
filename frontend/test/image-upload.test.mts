import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getImageUploadProgress,
  mapWithConcurrency,
} from '../src/utils/imageUpload.ts';

test('maps image processing stages to monotonic user-visible progress', () => {
  assert.deepEqual(getImageUploadProgress('validating'), {
    stage: 'validating',
    progress: 0,
  });
  assert.deepEqual(getImageUploadProgress('optimizing', 100), {
    stage: 'optimizing',
    progress: 55,
  });
  assert.deepEqual(getImageUploadProgress('uploading', 50), {
    stage: 'uploading',
    progress: 78,
  });
  assert.deepEqual(getImageUploadProgress('complete'), {
    stage: 'complete',
    progress: 100,
  });
});

test('limits concurrent image work and preserves the selected file order', async () => {
  let active = 0;
  let peak = 0;

  const results = await mapWithConcurrency([40, 5, 20, 10], 2, async (delay, index) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return `image-${index}`;
  });

  assert.equal(peak, 2);
  assert.deepEqual(
    results.map((result) =>
      result.status === 'fulfilled' ? result.value.value : 'failed',
    ),
    ['image-0', 'image-1', 'image-2', 'image-3'],
  );
});

test('settles each image independently so one failure does not discard successes', async () => {
  const results = await mapWithConcurrency(['first', 'broken', 'third'], 2, async (value) => {
    if (value === 'broken') throw new Error('upload failed');
    return value;
  });

  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[2].status, 'fulfilled');
});
