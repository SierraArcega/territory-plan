import type { FilterWidget } from "@/features/views/lib/columns";

interface ToggleWidgetProps {
  widget: Extract<FilterWidget, { kind: "toggle" }>;
  value: boolean | null;
  onApply: (next: boolean) => void;
  onCancel: () => void;
}

export function ToggleWidget({ widget, value, onApply }: ToggleWidgetProps) {
  const labels = widget.labels;
  return (
    <div
      className="inline-flex rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md"
      role="group"
    >
      <button
        type="button"
        onClick={() => onApply(true)}
        className={`rounded px-3 py-1 text-[12px] ${
          value === true
            ? "bg-[#403770] text-white"
            : "text-[#544A78] hover:bg-[#F7F5FA]"
        }`}
      >
        {labels.on}
      </button>
      <button
        type="button"
        onClick={() => onApply(false)}
        className={`rounded px-3 py-1 text-[12px] ${
          value === false
            ? "bg-[#403770] text-white"
            : "text-[#544A78] hover:bg-[#F7F5FA]"
        }`}
      >
        {labels.off}
      </button>
    </div>
  );
}
