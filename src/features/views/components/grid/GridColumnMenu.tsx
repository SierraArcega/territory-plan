"use client";
import { useState, useRef, useEffect } from "react";
import { Settings, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SOURCE_COLUMNS, getDefaultLayoutColumns } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

interface GridColumnMenuProps {
  source: SavedListSource;
  layout: GridViewLayout;
  onChange: (next: GridViewLayout) => void;
}

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing without needing DOM drag simulation
// ---------------------------------------------------------------------------
export function reorderColumns(
  source: SavedListSource,
  layout: GridViewLayout,
  activeId: string,
  overId: string,
): GridViewLayout {
  const orderedIds = SOURCE_COLUMNS[source]
    .slice()
    .sort((a, b) => {
      const oa = layout.columns.find((l) => l.id === a.id)?.order ?? a.defaultOrder;
      const ob = layout.columns.find((l) => l.id === b.id)?.order ?? b.defaultOrder;
      return oa - ob;
    })
    .map((c) => c.id);

  const oldIndex = orderedIds.indexOf(activeId);
  const newIndex = orderedIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return layout;

  const reordered = [...orderedIds];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  const baseCols = SOURCE_COLUMNS[source].map((c) => {
    const found = layout.columns.find((l) => l.id === c.id);
    return {
      id: c.id,
      order: found?.order ?? c.defaultOrder,
      visible: found?.visible ?? c.defaultVisible,
      ...(found?.width !== undefined ? { width: found.width } : {}),
    };
  });

  const next = baseCols.map((col) => {
    const idx = reordered.indexOf(col.id);
    return idx === -1 ? col : { ...col, order: idx };
  });

  return { ...layout, columns: next };
}

// ---------------------------------------------------------------------------
// SortableRow — wraps each column row with drag handle + dnd-kit bindings
// ---------------------------------------------------------------------------
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 hover:bg-[#F7F5FA]"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="cursor-grab text-[#8A80A8] hover:text-[#403770]"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GridColumnMenu
// ---------------------------------------------------------------------------
export function GridColumnMenu({ source, layout, onChange }: GridColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Columns sorted by their current layout order (falling back to defaultOrder)
  const orderedColumns = SOURCE_COLUMNS[source].slice().sort((a, b) => {
    const oa = layout.columns.find((l) => l.id === a.id)?.order ?? a.defaultOrder;
    const ob = layout.columns.find((l) => l.id === b.id)?.order ?? b.defaultOrder;
    return oa - ob;
  });

  const isVisible = (id: string) =>
    layout.columns.find((l) => l.id === id)?.visible ??
    SOURCE_COLUMNS[source].find((c) => c.id === id)?.defaultVisible ??
    true;

  /**
   * Build a full column array from SOURCE_COLUMNS merged with layout overrides.
   * Always produces one entry per source column so nothing is silently dropped.
   */
  function buildBaseCols() {
    return SOURCE_COLUMNS[source].map((c) => {
      const found = layout.columns.find((l) => l.id === c.id);
      return {
        id: c.id,
        order: found?.order ?? c.defaultOrder,
        visible: found?.visible ?? c.defaultVisible,
        ...(found?.width !== undefined ? { width: found.width } : {}),
      };
    });
  }

  const toggleVisible = (id: string) => {
    const baseCols = buildBaseCols();
    const next = baseCols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
    onChange({ ...layout, columns: next });
  };

  const moveColumn = (id: string, direction: -1 | 1) => {
    const target = orderedColumns.findIndex((c) => c.id === id);
    const swapWith = target + direction;
    if (swapWith < 0 || swapWith >= orderedColumns.length) return;

    const baseCols = buildBaseCols();
    const sourceId = id;
    const targetId = orderedColumns[swapWith].id;

    const sourceOrder = baseCols.find((c) => c.id === sourceId)!.order;
    const targetOrder = baseCols.find((c) => c.id === targetId)!.order;

    const next = baseCols.map((c) => {
      if (c.id === sourceId) return { ...c, order: targetOrder };
      if (c.id === targetId) return { ...c, order: sourceOrder };
      return c;
    });
    onChange({ ...layout, columns: next });
  };

  const reset = () => {
    onChange({
      ...layout,
      columns: getDefaultLayoutColumns(source),
      sort: [],
      // filters are intentionally preserved
    });
    setOpen(false);
  };

  // dnd-kit sensors — require 4px movement before activating to avoid
  // accidentally swallowing checkbox / button clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(reorderColumns(source, layout, String(active.id), String(over.id)));
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Columns"
        className="rounded p-1 text-[#544A78] hover:bg-[#F7F5FA]"
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-[#E2DEEC] bg-white p-2 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
          <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.06em] text-[#8A80A8]">
            Columns
          </div>
          <div className="max-h-72 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedColumns.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedColumns.map((col, i) => {
                  // Disambiguate columns that share a short header (e.g.
                  // "Count"/"Min"/"Max" appear once per deal-status group).
                  const label = col.group
                    ? `${col.group} ${col.header}`
                    : col.header;
                  return (
                  <SortableRow key={col.id} id={col.id}>
                    <input
                      type="checkbox"
                      aria-label={`Show ${label}`}
                      checked={isVisible(col.id)}
                      onChange={() => toggleVisible(col.id)}
                    />
                    <span className="flex-1 whitespace-nowrap text-[13px] text-[#403770]">
                      {label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${label} up`}
                      disabled={i === 0}
                      onClick={() => moveColumn(col.id, -1)}
                      className="text-[#8A80A8] hover:text-[#403770] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${label} down`}
                      disabled={i === orderedColumns.length - 1}
                      onClick={() => moveColumn(col.id, 1)}
                      className="text-[#8A80A8] hover:text-[#403770] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </SortableRow>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-1 w-full rounded px-2 py-1 text-left text-[12px] text-[#8A80A8] hover:bg-[#F7F5FA] hover:text-[#403770]"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
