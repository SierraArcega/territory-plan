import { useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;
const clampWidth = (w: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));

interface GridHeaderCellProps {
  label: string;
  sortable: boolean;
  sortDir: "asc" | "desc" | null;
  sortIndex?: number;       // 1-based precedence when participating in multi-sort
  onSortChange: (next: "asc" | "desc" | null, shift: boolean) => void;
  width?: number;
  /** Fired on every pointer-move during a drag for live (uncommitted) feedback. */
  onWidthPreview?: (next: number) => void;
  /** Fired once on pointer-up with the final width to persist. */
  onWidthChange?: (next: number) => void;
}

export function GridHeaderCell({ label, sortable, sortDir, sortIndex, onSortChange, width, onWidthPreview, onWidthChange }: GridHeaderCellProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const beginResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Start from the column's resolved width so the first drag pixel maps 1:1.
    const startWidth = width ?? MIN_WIDTH;
    dragStateRef.current = { startX: e.clientX, startWidth };
    handleRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    const next = clampWidth(state.startWidth + (e.clientX - state.startX));
    onWidthPreview?.(next);
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    handleRef.current?.releasePointerCapture?.(e.pointerId);
    dragStateRef.current = null;
    const delta = e.clientX - state.startX;
    // Only commit if the pointer actually moved — a plain click is a no-op.
    if (delta !== 0) onWidthChange?.(clampWidth(state.startWidth + delta));
  };

  const resizeHandle = onWidthChange ? (
    <div
      ref={handleRef}
      onPointerDown={beginResize}
      onPointerMove={onMove}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none hover:bg-[#D4CFE2]"
      aria-hidden
    />
  ) : null;

  if (!sortable) {
    return (
      <>
        <span className="whitespace-nowrap">{label}</span>
        {resizeHandle}
      </>
    );
  }

  const next: "asc" | "desc" | null =
    sortDir === null ? "asc" : sortDir === "asc" ? "desc" : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => onSortChange(next, e.shiftKey)}
        className="flex items-center gap-1 whitespace-nowrap text-inherit hover:text-[#403770]"
      >
        <span>{label}</span>
        {sortDir === "asc"  && <ChevronUp   className="h-3 w-3" />}
        {sortDir === "desc" && <ChevronDown className="h-3 w-3" />}
        {sortIndex !== undefined && sortDir !== null && (
          <span className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#EFEDF5] text-[9px] font-semibold text-[#403770]">
            {sortIndex}
          </span>
        )}
      </button>
      {resizeHandle}
    </>
  );
}
