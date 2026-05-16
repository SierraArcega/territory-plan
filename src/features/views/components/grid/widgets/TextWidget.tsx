import { useState, useEffect, useRef } from "react";
import type { FilterWidget } from "@/features/views/lib/columns";

interface TextWidgetProps {
  widget: Extract<FilterWidget, { kind: "text" }>;
  value: string | null;
  onApply: (next: string) => void;
  onCancel: () => void;
}

export function TextWidget({ value, onApply, onCancel }: TextWidgetProps) {
  const [text, setText] = useState(value ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms debounce: commit text via onApply after the user pauses typing
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text === (value ?? "")) return; // no diff — skip
    timerRef.current = setTimeout(() => onApply(text), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // intentional: onApply / value omitted from deps to keep the debounce focused on text changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="w-64 rounded-lg border border-[#E2DEEC] bg-white p-2 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
      <input
        autoFocus
        placeholder="Search…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px]"
      />
      <div className="mt-2 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">
          Cancel
        </button>
      </div>
    </div>
  );
}
