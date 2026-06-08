/** Stable client-side row id for a list item (not persisted). */
export function newRowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
