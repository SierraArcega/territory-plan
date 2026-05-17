import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";

interface GroupFieldPickerProps {
  source: SavedListSource;
  /** The currently grouped field id, if any — disabled in the picker. */
  currentGroupId: string | null;
  onPick: (column: ColumnDef) => void;
  onClose: () => void;
}

function isGroupableWidget(col: ColumnDef): boolean {
  const w = col.filterWidget;
  if (!w) return false;
  return w.kind === "multiselect" || w.kind === "select" || w.kind === "toggle";
}

export function GroupFieldPicker({
  source,
  currentGroupId,
  onPick,
}: GroupFieldPickerProps) {
  const candidates = SOURCE_COLUMNS[source].filter(
    (c) => c.sortable && isGroupableWidget(c),
  );

  return (
    <div
      className="w-56 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md"
      style={{ maxWidth: "calc(100vw - 16px)" }}
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-[#8A80A8] whitespace-nowrap">
        Group by
      </div>
      <div className="max-h-64 overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8] whitespace-nowrap">
            No groupable columns
          </div>
        ) : (
          candidates.map((col) => {
            const used = col.id === currentGroupId;
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
