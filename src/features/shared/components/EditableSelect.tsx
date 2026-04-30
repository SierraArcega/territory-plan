"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

export interface EditableSelectOption<TValue extends string = string> {
  id: TValue;
  label: string;
  /** Optional color dot rendered next to the label. Hex string. */
  dot?: string;
}

export interface EditableSelectProps<TValue extends string = string> {
  value: TValue | null | undefined;
  options: EditableSelectOption<TValue>[];
  onChange?: (next: TValue) => void;
  readOnly?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Override the value rendered in the closed-state button. */
  renderValue?: (option: EditableSelectOption<TValue> | null) => React.ReactNode;
}

/**
 * Click-to-open dropdown. Brand-styled. Closes on outside click or Esc.
 */
export default function EditableSelect<TValue extends string = string>({
  value,
  options,
  onChange,
  readOnly,
  className,
  ariaLabel,
  renderValue,
}: EditableSelectProps<TValue>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={readOnly}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium rounded-md",
          "border border-[#D4CFE2] bg-white text-[#403770]",
          readOnly ? "cursor-default opacity-90" : "cursor-pointer hover:bg-[#FFFCFA]"
        )}
      >
        {renderValue ? (
          renderValue(current)
        ) : (
          <span className="inline-flex items-center gap-2">
            {current?.dot && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: current.dot }}
                aria-hidden="true"
              />
            )}
            {current?.label ?? "Select…"}
          </span>
        )}
        {!readOnly && <ChevronDown className="w-3 h-3 text-[#8A80A8]" />}
      </button>

      {open && !readOnly && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-full bg-white border border-[#D4CFE2] rounded-lg shadow-[0_10px_15px_-3px_rgba(64,55,112,0.10)] p-1"
        >
          {options.map((o) => {
            const selected = o.id === value;
            return (
              <button
                key={o.id}
                role="option"
                aria-selected={selected}
                type="button"
                onClick={() => {
                  onChange?.(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full text-left text-[13px] px-2.5 py-1.5 rounded-md whitespace-nowrap text-[#403770]",
                  selected ? "bg-[#EFEDF5]" : "hover:bg-[#EFEDF5]"
                )}
              >
                {o.dot && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: o.dot }}
                    aria-hidden="true"
                  />
                )}
                <span>{o.label}</span>
                {selected && <Check className="w-3.5 h-3.5 ml-auto text-[#403770]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
