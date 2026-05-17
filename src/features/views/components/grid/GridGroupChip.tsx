"use client";
import { useState } from "react";
import { Layers, Plus, X } from "lucide-react";
import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import { GroupFieldPicker } from "./GroupFieldPicker";

interface GridGroupChipProps {
  source: SavedListSource;
  layout: GridViewLayout;
  onChange: (next: GridViewLayout) => void;
  /** When true, the component renders nothing — used by News cards mode. */
  hidden?: boolean;
}

export function GridGroupChip({
  source,
  layout,
  onChange,
  hidden,
}: GridGroupChipProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (hidden) return null;

  const groupBy = layout.groupBy ?? null;
  const groupedCol = groupBy
    ? SOURCE_COLUMNS[source].find((c) => c.id === groupBy.id) ?? null
    : null;

  const pickGroup = (column: ColumnDef) => {
    onChange({ ...layout, groupBy: { id: column.id } });
    setPickerOpen(false);
  };

  const clearGroup = () => onChange({ ...layout, groupBy: null });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2">
        {groupBy && (
          <div className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-2 py-0.5 text-[12px] text-[#403770]">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1"
              aria-label={`Change group field`}
            >
              <Layers className="h-3 w-3" />
              <span className="whitespace-nowrap font-medium">
                {groupedCol?.header ?? groupBy.id}
              </span>
            </button>
            <button
              type="button"
              aria-label="Remove group"
              onClick={clearGroup}
              className="ml-1 text-[#8A80A8] hover:text-[#403770]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {!groupBy && (
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[#E2DEEC] px-2 py-0.5 text-[12px] text-[#544A78] hover:bg-[#F7F5FA]"
          >
            <Plus className="h-3 w-3" />
            <span className="whitespace-nowrap">Group</span>
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="absolute left-3 top-full z-30 mt-1">
          <GroupFieldPicker
            source={source}
            currentGroupId={groupBy?.id ?? null}
            onPick={pickGroup}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
