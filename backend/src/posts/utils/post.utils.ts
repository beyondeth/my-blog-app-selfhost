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
    // Remove query parameters first (version parameters, etc.)
    const cleanUrl = url.split('?')[0];

    // Direct S3 key (already in correct format)
    if (cleanUrl.startsWith('uploads/')) return cleanUrl;

    // CDN URLs: https://cdn.codebase.blog/uploads/...
    if (cleanUrl.includes('cdn.codebase.blog/uploads/')) {
      const pathMatch = cleanUrl.match(/cdn\.codebase\.blog\/(.+)/);
      if (pathMatch) return pathMatch[1];
    }

    // Generic CDN pattern: https://cdn.domain.com/...
    const genericCdnMatch = cleanUrl.match(/https:\/\/cdn\.[^\/]+\/(.+)/);
    if (genericCdnMatch) return genericCdnMatch[1];

    // Proxy URLs: /api/v1/files/proxy/...
    if (cleanUrl.includes('/api/v1/files/proxy/')) {
      const proxyMatch = cleanUrl.match(/\/api\/v1\/files\/proxy\/(.+)/);
      if (proxyMatch) return proxyMatch[1];
    }

    // AWS S3 URLs: https://bucket.s3.region.amazonaws.com/...
    const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
    const s3Match = cleanUrl.match(s3Pattern);
    if (s3Match) return s3Match[1];

    // Oracle Cloud Object Storage: https://namespace.compat.objectstorage.region.oraclecloud.com/...
    const oraclePattern = /https:\/\/[^\/]+\.compat\.objectstorage\.[^\/]+\.oraclecloud\.com\/(.+)/;
    const oracleMatch = cleanUrl.match(oraclePattern);
    if (oracleMatch) return oracleMatch[1];

    // Google Cloud Storage: https://storage.googleapis.com/... or https://bucket.storage.googleapis.com/...
    const googlePattern = /https:\/\/(?:[^\/]+\.)?storage\.googleapis\.com\/(.+)/;
    const googleMatch = cleanUrl.match(googlePattern);
    if (googleMatch) return googleMatch[1];

    // Local development: localhost:3000/api/v1/files/proxy/...
    if (cleanUrl.includes('localhost:3000/api/v1/files/proxy/')) {
      const localMatch = cleanUrl.match(/localhost:3000\/api\/v1\/files\/proxy\/(.+)/);
      if (localMatch) return localMatch[1];
    }

    // Docker internal: http://backend:3000/api/v1/files/proxy/...
    if (cleanUrl.includes('backend:3000/api/v1/files/proxy/')) {
      const dockerMatch = cleanUrl.match(/backend:3000\/api\/v1\/files\/proxy\/(.+)/);
      if (dockerMatch) return dockerMatch[1];
    }

    return null;
  } catch (error) {
    console.error('Error extracting S3 key from URL:', url, error);
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