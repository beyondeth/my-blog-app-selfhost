export function extractImageUrlsFromContent(content: string): string[] {
  if (!content) return [];
  const imgRegex = /<img[^>]+src="([^">]+)"/gi;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanUrl = match[1].split('?')[0];
      urls.push(cleanUrl);
    }
  }
  return urls;
}

export function extractS3KeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith('uploads/')) return url;
    if (url.includes('/api/v1/files/proxy/')) {
      const proxyMatch = url.match(/\/api\/v1\/files\/proxy\/(.+)/);
      if (proxyMatch) return proxyMatch[1].split('?')[0];
    }
    const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
    const match = url.match(s3Pattern);
    if (match) return match[1].split('?')[0];
    if (url.includes('localhost:3000/api/v1/files/proxy/')) {
      const proxyMatch = url.match(/localhost:3000\/api\/v1\/files\/proxy\/(.+)/);
      if (proxyMatch) return proxyMatch[1].split('?')[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function generateSlug(title: string, createdAt?: Date): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
  const now = createdAt || new Date();
  const date = now.toISOString().split('T')[0];
  const timestamp = now.getTime().toString().slice(-6);
  return `${date}-${baseSlug}-${timestamp}`;
} 