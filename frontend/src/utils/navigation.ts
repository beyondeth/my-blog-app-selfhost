/**
 * Navigation utilities for consistent routing behavior
 */

/**
 * Navigate to a URL - handles both internal and external navigation
 * @param url - The URL to navigate to
 * @param options - Navigation options
 */
export function navigateTo(
  url: string,
  options: {
    external?: boolean;
    newTab?: boolean;
    replace?: boolean;
  } = {}
) {
  const { external = false, newTab = false, replace = false } = options;

  // External URLs or OAuth redirects
  if (external || url.startsWith('http://') || url.startsWith('https://')) {
    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
    return;
  }

  // Internal navigation - Next.js handles this better with router
  // But for contexts where router isn't available, use location
  if (replace) {
    window.location.replace(url);
  } else {
    window.location.href = url;
  }
}

/**
 * Determine whether to use replace based on context
 * @param context - The navigation context
 * @returns Whether to use replace method
 */
export function shouldUseReplace(context: 'login' | 'logout' | 'redirect' | 'navigation'): boolean {
  switch (context) {
    case 'login':
    case 'logout':
    case 'redirect':
      // 이런 경우는 히스토리를 대체하는 것이 좋음
      return true;
    case 'navigation':
    default:
      // 일반 네비게이션은 히스토리에 추가
      return false;
  }
}

/**
 * Get the current URL for sharing/copying
 * @returns The current page URL
 */
export function getCurrentUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.href;
}

/**
 * Copy URL to clipboard
 * @param url - Optional URL to copy, defaults to current URL
 * @returns Promise that resolves when copied
 */
export async function copyUrlToClipboard(url?: string): Promise<void> {
  const urlToCopy = url || getCurrentUrl();
  
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = urlToCopy;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
    return;
  }
  
  await navigator.clipboard.writeText(urlToCopy);
}

/**
 * Share URL using Web Share API
 * @param options - Share options
 */
export async function shareUrl(options: {
  url?: string;
  title?: string;
  text?: string;
}): Promise<void> {
  const { url = getCurrentUrl(), title = document.title, text } = options;
  
  if (!navigator.share) {
    // Fallback to copying URL
    await copyUrlToClipboard(url);
    throw new Error('Web Share API not supported');
  }
  
  await navigator.share({
    url,
    title,
    text: text || title,
  });
}