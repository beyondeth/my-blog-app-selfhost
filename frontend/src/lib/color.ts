/**
 * HEX 색상을 RGB 튜플로 변환
 * @param hex HEX 문자열 (#RRGGBB 또는 RRGGBB)
 * @returns [r, g, b] 튜플 또는 null
 */
export function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const normalized = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return [r, g, b];
}

/**
 * HEX 색상을 rgba() CSS 문자열로 변환
 * @param hex HEX 문자열
 * @param alpha 투명도 (0~1)
 * @returns rgba 문자열 또는 undefined
 */
export function hexToRgbaString(hex?: string | null, alpha: number = 1): string | undefined {
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampedAlpha})`;
}
