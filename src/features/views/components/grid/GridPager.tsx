"use client";

/**
 * GridPager — footer pagination control for the shared GridView table.
 *
 * Layout:
 *   Rows: [ 50 ▾ ]   Showing 101–150 of 738      ‹  Page [ 3 ▾ ] of 15  ›
 *
 * - A native <select> for both controls renders an OS-native picker on iOS.
 * - Changing rows-per-page resets to page 1 (handled by GridView's querySig).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageMeta, PAGE_SIZE_OPTIONS, type PageSize } from "./grid-pagination";

interface GridPagerProps {
  total: number;
  /** Current page (1-based). Clamped internally via pageMeta. */
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

const arrowBtn =
  "inline-flex items-center justify-center rounded-md border border-[#D4CFE2] " +
  "bg-white p-1 text-[#544A78] transition-colors duration-100 " +
  "hover:text-[#403770] hover:border-[#403770] " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "disabled:hover:text-[#544A78] disabled:hover:border-[#D4CFE2]";

const selectCls =
  "rounded-md border border-[#D4CFE2] bg-white px-2 py-1 text-[12px] font-semibold " +
  "text-[#544A78] transition-colors duration-100 hover:border-[#403770] " +
  "focus:outline-none focus:ring-2 focus:ring-[#D4CFE2]";

export default function GridPager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: GridPagerProps) {
  const meta = pageMeta(total, page, pageSize);
  const atFirst = meta.page <= 1;
  const atLast = meta.page >= meta.pageCount;

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFEDF5] bg-white px-4 py-2">
      {/* Left: rows-per-page + showing label */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-[#8A80A8] whitespace-nowrap">Rows:</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className={selectCls}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[12px] text-[#8A80A8] whitespace-nowrap">
          Showing {meta.from.toLocaleString()}–{meta.to.toLocaleString()} of{" "}
          {meta.total.toLocaleString()}
        </span>
      </div>
      {/* Right: page navigation */}
      <div className="flex items-center gap-2 whitespace-nowrap text-[12px] font-semibold text-[#544A78]">
        <button
          type="button"
          aria-label="Previous page"
          disabled={atFirst}
          onClick={() => onPageChange(meta.page - 1)}
          className={arrowBtn}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="flex items-center gap-1.5">
          <span>Page</span>
          <select
            aria-label="Go to page"
            value={meta.page}
            onChange={(e) => onPageChange(Number(e.target.value))}
            className={selectCls}
          >
            {Array.from({ length: meta.pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span>of {meta.pageCount.toLocaleString()}</span>
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={atLast}
          onClick={() => onPageChange(meta.page + 1)}
          className={arrowBtn}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
