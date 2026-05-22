import { useState, useMemo } from "react";
import { useEnumValues } from "@/features/views/hooks/useEnumValues";
import type { FilterWidget } from "@/features/views/lib/columns";

interface SelectWidgetProps {
  widget: Extract<FilterWidget, { kind: "select" }>;
  value: string | null;
  onApply: (next: string) => void;
  onCancel: () => void;
}

export function SelectWidget({
  widget,
  value,
  onApply,
  onCancel,
}: SelectWidgetProps) {
  const [selected, setSelected] = useState<string | null>(value);
  const [query, setQuery] = useState("");

  const isDynamic = "enumSource" in widget;
  const enumQuery = useEnumValues(isDynamic ? widget.enumSource : null);

  const options: { value: string; label: string }[] = isDynamic
    ? (enumQuery.data?.values ?? [])
    : widget.values.map((v) => ({ value: v, label: v }));

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="w-64 rounded-lg border border-[#E2DEEC] bg-white p-2 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
      <input
        autoFocus
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px]"
      />
      <div className="mt-2 max-h-56 overflow-y-auto">
        {isDynamic && enumQuery.isLoading ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8]">No matches</div>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] ${
                selected === opt.value
                  ? "bg-[#EFEDF5] text-[#403770]"
                  : "hover:bg-[#F7F5FA]"
              }`}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">
          Cancel
        </button>
        <button
          onClick={() => selected !== null && onApply(selected)}
          disabled={selected === null}
          className="rounded bg-[#403770] px-3 py-1 text-[12px] text-white disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
