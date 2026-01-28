const YOUTUBE_THUMBNAIL_MARKER = /<!--\s*YT_THUMBNAIL:([a-zA-Z0-9_-]{11})\s*-->/i;

export function extractYouTubeThumbnailMarker(markdown: string): string | null {
  if (!markdown) return null;
  const match = markdown.match(YOUTUBE_THUMBNAIL_MARKER);
  return match?.[1] ?? null;
}

export function stripYouTubeThumbnailMarker(markdown: string): string {
  if (!markdown) return '';
  return markdown.replace(YOUTUBE_THUMBNAIL_MARKER, '').trimEnd();
}

export function appendYouTubeThumbnailMarker(
  markdown: string,
  videoId: string | null,
): string {
  const cleaned = stripYouTubeThumbnailMarker(markdown ?? '');
  if (!videoId) return cleaned;
  const suffix = cleaned && !cleaned.endsWith('\n') ? '\n' : '';
  return `${cleaned}${suffix}<!--YT_THUMBNAIL:${videoId}-->`;
}

export function extractYouTubeIdsFromMarkdown(markdown: string): string[] {
  if (!markdown) return [];
  const ids = new Set<string>();

  const urlPattern =
    /(https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[^\s)<>"]+)/gi;
  let match: RegExpExecArray | null;
  urlPattern.lastIndex = 0;
  while ((match = urlPattern.exec(markdown)) !== null) {
    const videoId = extractYouTubeVideoId(match[1]);
    if (videoId) ids.add(videoId);
  }

  const iframePattern =
    /<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"?]+)[^"']*["'][^>]*><\/iframe>/gi;
  iframePattern.lastIndex = 0;
  while ((match = iframePattern.exec(markdown)) !== null) {
    const id = normalizeYouTubeId(match[1]);
    if (id) ids.add(id);
  }

  const dataWrapperPattern =
    /data-youtube-video[^>]*>(?:[\s\S]*?)<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"?]+)[^"']*["'][^>]*>/gi;
  dataWrapperPattern.lastIndex = 0;
  while ((match = dataWrapperPattern.exec(markdown)) !== null) {
    const id = normalizeYouTubeId(match[1]);
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    const isYouTubeHost =
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be' ||
      host === 'www.youtu.be' ||
      host === 'youtube-nocookie.com' ||
      host === 'www.youtube-nocookie.com';

    if (!isYouTubeHost) return null;

    if (host.includes('youtu.be')) {
      return normalizeYouTubeId(parsed.pathname.split('/')[1]);
    }

    if (parsed.pathname.startsWith('/watch')) {
      return normalizeYouTubeId(parsed.searchParams.get('v'));
    }

    if (parsed.pathname.startsWith('/shorts/')) {
      return normalizeYouTubeId(parsed.pathname.split('/')[2]);
    }

    if (parsed.pathname.startsWith('/embed/')) {
      return normalizeYouTubeId(parsed.pathname.split('/')[2]);
    }

    if (parsed.pathname.startsWith('/v/')) {
      return normalizeYouTubeId(parsed.pathname.split('/')[2]);
    }

    return null;
  } catch {
    const fallback = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    );
    return fallback?.[1] ?? null;
  }
}

function normalizeYouTubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/[a-zA-Z0-9_-]{11}/);
  return match ? match[0] : null;
}
