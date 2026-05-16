import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";

interface FilterFieldPickerProps {
  source: SavedListSource;
  /** Field ids already used in the current filter — disabled in the picker */
  usedFieldIds: string[];
  onPick: (column: ColumnDef) => void;
  onClose: () => void;
}

export function FilterFieldPicker({
  source,
  usedFieldIds,
  onPick,
  onClose,
}: FilterFieldPickerProps) {
  const candidates = SOURCE_COLUMNS[source].filter(
    (c) => c.filterWidget !== null,
  );

  return (
    <div className="w-56 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
      <div className="px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-[#8A80A8]">
        Add filter
      </div>
      <div className="max-h-64 overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8]">
            No filterable columns
          </div>
        ) : (
          candidates.map((col) => {
            const fieldId = col.filterFieldId ?? col.id;
            const used = usedFieldIds.includes(fieldId);
            return (
              <button
                key={col.id}
                type="button"
                disabled={used}
                onClick={() => {
                  // Call only onPick — the parent transitions directly to widget
                  // mode. Calling onClose() here would race with onPick() inside
                  // React's batched event handler and clear the state to null.
                  onPick(col);
                }}
                className="block w-full px-2 py-1 text-left text-[13px] hover:bg-[#F7F5FA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {col.header}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
