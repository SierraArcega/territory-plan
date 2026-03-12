/**
 * Truncate a string at the end with an ellipsis character.
 * truncateEnd("Springfield School District", 20) → "Springfield School D…"
 */
export function truncateEnd(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\u2026";
}

/**
 * Truncate a string in the middle, keeping start and end visible.
 * truncateMiddle("Springfield School District", 20) → "Springfiel…l District"
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const startLen = Math.ceil(maxLength / 2);
  const endLen = Math.floor(maxLength / 2);
  return text.slice(0, startLen) + "\u2026" + text.slice(text.length - endLen);
}
