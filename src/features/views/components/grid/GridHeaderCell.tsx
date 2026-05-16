import { useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface GridHeaderCellProps {
  label: string;
  sortable: boolean;
  sortDir: "asc" | "desc" | null;
  onSortChange: (next: "asc" | "desc" | null) => void;
  width?: number;
  onWidthChange?: (next: number) => void;
}

export function GridHeaderCell({ label, sortable, sortDir, onSortChange, width, onWidthChange }: GridHeaderCellProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [draggingWidth, setDraggingWidth] = useState<number | null>(null);

  const beginResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = width ?? 0;
    dragStateRef.current = { startX: e.clientX, startWidth };
    handleRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    const delta = e.clientX - state.startX;
    const next = Math.max(60, Math.min(600, state.startWidth + delta));
    setDraggingWidth(next);
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    handleRef.current?.releasePointerCapture?.(e.pointerId);
    dragStateRef.current = null;
    const delta = e.clientX - state.startX;
    const finalWidth = Math.max(60, Math.min(600, state.startWidth + delta));
    // Only commit if the pointer actually moved (delta != 0 or draggingWidth was set).
    if (draggingWidth != null || delta !== 0) onWidthChange?.(finalWidth);
    setDraggingWidth(null);
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
        onClick={() => onSortChange(next)}
        className="flex items-center gap-1 whitespace-nowrap text-inherit hover:text-[#403770]"
      >
        <span>{label}</span>
        {sortDir === "asc" && <ChevronUp className="h-3 w-3" />}
        {sortDir === "desc" && <ChevronDown className="h-3 w-3" />}
      </button>
      {resizeHandle}
    </>
  );
}
