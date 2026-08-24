export function hasPendingImageUpload(content: string | null | undefined): boolean {
  if (!content) {
    return false;
  }

  return /<div\b[^>]*\bdata-type=["']image-upload["'][^>]*>/i.test(content);
}
