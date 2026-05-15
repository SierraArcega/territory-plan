import { ChevronUp, ChevronDown } from "lucide-react";

interface GridHeaderCellProps {
  label: string;
  sortable: boolean;
  sortDir: "asc" | "desc" | null;
  onSortChange: (next: "asc" | "desc" | null) => void;
}

export function GridHeaderCell({ label, sortable, sortDir, onSortChange }: GridHeaderCellProps) {
  if (!sortable) return <span className="whitespace-nowrap">{label}</span>;
  const next: "asc" | "desc" | null =
    sortDir === null ? "asc" : sortDir === "asc" ? "desc" : null;
  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      className="flex items-center gap-1 whitespace-nowrap text-inherit hover:text-[#403770]"
    >
      <span>{label}</span>
      {sortDir === "asc" && <ChevronUp className="h-3 w-3" />}
      {sortDir === "desc" && <ChevronDown className="h-3 w-3" />}
    </button>
  );
}
