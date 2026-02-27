const clientDeletedPostIds = new Set<string>();

export function markClientDeletedPost(postId: string): void {
  clientDeletedPostIds.add(postId);
}

export function unmarkClientDeletedPost(postId: string): void {
  clientDeletedPostIds.delete(postId);
}

export function filterClientDeletedFeedItems<T extends { id: string }>(
  items: T[],
): T[] {
  if (!items?.length) return items;
  return items.filter((item) => !clientDeletedPostIds.has(item.id));
}
