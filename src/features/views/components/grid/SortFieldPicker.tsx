import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";

interface SortFieldPickerProps {
  source: SavedListSource;
  /** Field ids already in the sort stack — disabled in the picker. */
  usedFieldIds: string[];
  onPick: (column: ColumnDef) => void;
  onClose: () => void;
}

export function SortFieldPicker({
  source,
  usedFieldIds,
  onPick,
}: SortFieldPickerProps) {
  const candidates = SOURCE_COLUMNS[source].filter((c) => c.sortable);

  return (
    <div
      className="w-56 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md"
      style={{ maxWidth: "calc(100vw - 16px)" }}
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-[#8A80A8] whitespace-nowrap">
        Add sort
      </div>
      <div className="max-h-64 overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8] whitespace-nowrap">
            No sortable columns
          </div>
        ) : (
          candidates.map((col) => {
            const used = usedFieldIds.includes(col.id);
            return (
              <button
                key={col.id}
                type="button"
                disabled={used}
                onClick={() => onPick(col)}
                className="block w-full whitespace-nowrap px-2 py-1 text-left text-[13px] hover:bg-[#F7F5FA] disabled:cursor-not-allowed disabled:opacity-50"
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
