const HEX3_REGEX = /^#?([0-9a-f]{3})$/i;
const HEX6_REGEX = /^#?([0-9a-f]{6})$/i;

/**
 * Parse a hex color string to RGB components.
 * Accepts 3-char (#FFF) or 6-char (#FFFFFF), with or without #.
 * Throws on invalid input.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let match = hex.match(HEX6_REGEX);
  if (match) {
    const h = match[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  match = hex.match(HEX3_REGEX);
  if (match) {
    const h = match[1];
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  throw new Error(`Invalid hex color: "${hex}"`);
}

/**
 * Return an rgba() CSS string from a hex color + opacity.
 */
export function withOpacity(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value from 1 (no contrast) to 21 (max contrast).
 * WCAG AA: >= 4.5 for normal text, >= 3.0 for large text (18px+ bold / 24px+).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
