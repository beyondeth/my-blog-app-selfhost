export const IMAGE_UPLOAD_LIMITS = {
  maxBatchSizeBytes: 50 * 1024 * 1024,
  concurrency: 2,
} as const;

export type ImageUploadStage =
  | 'validating'
  | 'optimizing'
  | 'preparing'
  | 'uploading'
  | 'finalizing'
  | 'complete';

export interface ImageUploadProgress {
  progress: number;
  stage: ImageUploadStage;
}

export interface IndexedUploadResult<T> {
  index: number;
  value: T;
}

export function clampProgress(progress: number): number {
  return Math.min(100, Math.max(0, Math.round(progress)));
}

export function getImageUploadProgress(
  stage: ImageUploadStage,
  stageProgress = 0,
): ImageUploadProgress {
  const normalized = clampProgress(stageProgress);

  switch (stage) {
    case 'validating':
      return { stage, progress: Math.min(2, normalized) };
    case 'optimizing':
      return { stage, progress: 2 + Math.round(normalized * 0.53) };
    case 'preparing':
      return { stage, progress: 55 + Math.round(normalized * 0.05) };
    case 'uploading':
      return { stage, progress: 60 + Math.round(normalized * 0.35) };
    case 'finalizing':
      return { stage, progress: 95 + Math.round(normalized * 0.05) };
    case 'complete':
      return { stage, progress: 100 };
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<IndexedUploadResult<R>>>> {
  const results = new Array<PromiseSettledResult<IndexedUploadResult<R>>>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        const value = await mapper(items[index], index);
        results[index] = { status: 'fulfilled', value: { index, value } };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
