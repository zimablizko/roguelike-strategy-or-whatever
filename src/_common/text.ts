import { Color, Font, FontUnit, Text } from 'excalibur';

/**
 * Measure the rendered pixel width of a text string.
 * Caches nothing — callers should avoid calling this in tight loops.
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  color: Color = Color.White
): number {
  return new Text({
    text,
    font: new Font({
      size: fontSize,
      unit: FontUnit.Px,
      color,
    }),
  }).width;
}

/**
 * Wrap text into lines that fit within maxWidth pixels.
 * Uses approximate character-width estimation for speed.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [''];
  }

  const maxChars = Math.max(18, Math.floor(maxWidth / (fontSize * 0.56)));
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}
