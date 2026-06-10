"use client";

// SortDropdown — multi-column sort control. A button (with an active-count
// badge) opens a popover listing the active sorts: per-column Asc/Desc
// toggle, drag-to-reorder priority (@dnd-kit), × to remove, and an
// "Add sort" list of remaining columns. Controlled: pass `sorts` +
// `onChange`; the same state can be written by table-header clicks so
// board/table share one source of truth. Compare rows with buildComparator
// from filter-builder-utils.

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOutsideClick } from "@/features/shared/lib/use-outside-click";
import type { ColumnSort, FilterColumn } from "./filter-builder-utils";

interface SortDropdownProps<Row> {
  columns: FilterColumn<Row>[];
  sorts: ColumnSort[];
  onChange: (sorts: ColumnSort[]) => void;
}

function SortableSortRow({
  sort,
  index,
  label,
  onToggleDir,
  onRemove,
}: {
  sort: ColumnSort;
  index: number;
  label: string;
  onToggleDir: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sort.key });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 px-[11px] py-1.5"
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        {...attributes}
        {...listeners}
        className="flex cursor-grab touch-none border-0 bg-transparent p-0 text-[#C2BBD4] active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>
      <span className="w-4 shrink-0 text-[9.5px] font-bold text-[#A69DC0]">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-semibold text-[#403770]">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggleDir}
        aria-label={`${label}: sorted ${sort.dir === "asc" ? "ascending" : "descending"}, toggle direction`}
        className="inline-flex items-center gap-[3px] whitespace-nowrap rounded-md border border-[#D4CFE2] bg-white px-[7px] py-[3px] text-[10.5px] font-bold text-[#5C5277] hover:bg-[#FAF8FC]"
      >
        {sort.dir === "asc" ? (
          <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
        {sort.dir === "asc" ? "Asc" : "Desc"}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove sort: ${label}`}
        className="flex rounded-[5px] p-[3px] text-[#A69DC0] hover:text-[#C25A52]"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function SortDropdown<Row>({
  columns,
  sorts,
  onChange,
}: SortDropdownProps<Row>) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setAdding(false);
  }, []);

  useOutsideClick(rootRef, close, open);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const available = columns.filter((c) => !sorts.some((s) => s.key === c.key));
  const labelFor = (key: string) =>
    columns.find((c) => c.key === key)?.label ?? key;

  const addSort = (key: string) => {
    onChange([...sorts, { key, dir: "asc" }]);
    setAdding(false);
  };
  const toggleDir = (i: number) =>
    onChange(
      sorts.map((s, idx) =>
        idx === i ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s,
      ),
    );
  const remove = (i: number) => onChange(sorts.filter((_, idx) => idx !== i));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sorts.findIndex((s) => s.key === active.id);
    const to = sorts.findIndex((s) => s.key === over.id);
    if (from === -1 || to === -1) return;
    onChange(arrayMove(sorts, from, to));
  };

  const onRootKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div ref={rootRef} onKeyDown={onRootKeyDown} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-[11px] py-[7px] text-[12.5px] font-semibold text-[#403770] ${
          sorts.length
            ? "border-[#403770] bg-[#F3F0FB]"
            : "border-[#C2BBD4] bg-white hover:bg-[#FAF8FC]"
        }`}
      >
        <SlidersHorizontal size={14} className="text-[#A69DC0]" />
        <span className="whitespace-nowrap">Sort</span>
        {sorts.length > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#403770] px-1 text-[10px] font-bold text-white tabular-nums">
            {sorts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[35] w-[268px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[#D4CFE2] bg-white shadow-[0_10px_28px_-8px_rgba(64,55,112,0.22)]">
          <div className="border-b border-[#EFEDF5] px-[11px] py-[9px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#8A80A8]">
            Sort by
          </div>

          {sorts.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sorts.map((s) => s.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="py-1.5">
                  {sorts.map((s, i) => (
                    <SortableSortRow
                      key={s.key}
                      sort={s}
                      index={i}
                      label={labelFor(s.key)}
                      onToggleDir={() => toggleDir(i)}
                      onRemove={() => remove(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="px-3 pb-1 pt-3 text-[12.5px] text-[#A69DC0]">
              No sort applied.
            </div>
          )}

          {adding ? (
            <div className="max-h-[220px] overflow-y-auto border-t border-[#EFEDF5] py-1">
              {available.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => addSort(c.key)}
                  className="flex w-full items-center px-[11px] py-2 text-left text-[13px] text-[#403770] hover:bg-[#FAF8FC]"
                >
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                    {c.label}
                  </span>
                </button>
              ))}
              {!available.length && (
                <div className="px-3 py-2.5 text-xs text-[#A69DC0]">
                  All columns sorted.
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={!available.length}
              className={`flex w-full items-center gap-1.5 border-t border-[#EFEDF5] px-3 py-2.5 text-[12.5px] font-bold ${
                available.length
                  ? "text-[#F37167] hover:bg-[#FAF8FC]"
                  : "cursor-not-allowed text-[#C2BBD4]"
              }`}
            >
              <Plus size={13} />
              <span className="whitespace-nowrap">Add sort</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
