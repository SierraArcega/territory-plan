/** Stable client-side row id for a list item (not persisted). */
export function newRowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Extracts the Drive file id from a Google Docs URL ("/d/<id>/"). */
export function docIdFromUrl(url: string): string | null {
  return /\/d\/([^/?#]+)/.exec(url)?.[1] ?? null;
}
