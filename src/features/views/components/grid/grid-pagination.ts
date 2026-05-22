/**
 * Pure pagination math for the shared GridView table.
 *
 * GridView fetches one fixed-size window at a time (limit = GRID_PAGE_SIZE,
 * offset = (page - 1) * GRID_PAGE_SIZE). This helper turns the server's true
 * `total` (a COUNT(*) OVER() from /api/views/data) plus the current page into
 * the values the pager UI needs: clamped page, page count, and the 1-based
 * row range for the "Showing X–Y of N" label.
 *
 * Kept pure (no React) so the off-by-one math is unit-testable in isolation.
 */
export const GRID_PAGE_SIZE = 50;

export interface PageMeta {
  /** Current page, clamped into [1, pageCount]. */
  page: number;
  /** Total number of pages, never below 1 (an empty result still has 1 page). */
  pageCount: number;
  /** 1-based index of the first row on this page; 0 when there are no rows. */
  from: number;
  /** 1-based index of the last row on this page; 0 when there are no rows. */
  to: number;
  /** Echoed-back total row count (floored, never negative). */
  total: number;
}

export function pageMeta(
  total: number,
  page: number,
  pageSize: number = GRID_PAGE_SIZE,
): PageMeta {
  const safeTotal = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(safeTotal / pageSize));
  const clamped = Math.min(Math.max(1, Math.floor(page)), pageCount);

  if (safeTotal === 0) {
    return { page: 1, pageCount: 1, from: 0, to: 0, total: 0 };
  }

  const from = (clamped - 1) * pageSize + 1;
  const to = Math.min(clamped * pageSize, safeTotal);
  return { page: clamped, pageCount, from, to, total: safeTotal };
}
