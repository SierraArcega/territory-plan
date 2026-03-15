import type { SortState } from "@/features/shared/hooks/useSortableTable";

interface SortHeaderProps {
  field: string;
  label: string;
  sortState: SortState;
  onSort: (field: string) => void;
  className?: string;
  tooltip?: React.ReactNode;
}

// Renders a sortable <th> per the Fullmind Data Table spec.
// Visual states:
//   - Inactive: text-[#8A80A8], arrow hidden (opacity-0), faint arrow on hover
//   - Active asc/desc: text-[#403770], arrow visible at full opacity
// The 50% opacity on hover applies to the arrow element only, not the label text.
export function SortHeader({ field, label, sortState, onSort, className = "", tooltip }: SortHeaderProps) {
  const isActive = sortState.field === field;
  const dir = isActive ? sortState.dir : null;

  return (
    <th
      className={`group px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none ${
        isActive ? "text-[#403770]" : "text-[#8A80A8]"
      } ${className}`}
      aria-sort={!isActive ? "none" : dir === "asc" ? "ascending" : "descending"}
      tabIndex={0}
      onClick={() => onSort(field)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(field);
        }
      }}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {/* Arrow is always rendered; opacity controls visibility so hover works via CSS */}
        <span
          className={`w-3 h-3 inline-flex items-center justify-center text-[8px] leading-none transition-opacity ${
            isActive
              ? "opacity-100 text-[#403770]"
              : "opacity-0 group-hover:opacity-50 text-[#A69DC0]"
          }`}
          aria-hidden="true"
        >
          {dir === "desc" ? "▼" : "▲"}
        </span>
      </div>
      {/* Render tooltip (e.g. ColumnTooltip) if provided — positioned as a sibling to the label/arrow row */}
      {tooltip}
    </th>
  );
}
