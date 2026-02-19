'use client';

const STORAGE_KEY = 'codebase.viewer_id';

function createViewerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getViewerId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const generated = createViewerId();
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}
