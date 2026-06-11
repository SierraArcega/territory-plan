"use client";
import { useState } from "react";

interface Props {
  value: number;
  onValue: (n: number) => void;
  className?: string;
  step?: string;
  min?: number;
  max?: number;
  "aria-label"?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}

/** Number input that doesn't fight the cursor: focus selects the current value
 *  (typing replaces a lone 0 instead of producing "01"/"10"), and the field may
 *  sit empty mid-edit — blur commits empty as 0. State stays a plain number. */
export default function NumberInput({ value, onValue, inputMode = "decimal", ...rest }: Props) {
  // While editing, the raw string drives the input so "" doesn't snap back to 0.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode={inputMode}
      value={draft ?? String(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onValue(n);
      }}
      onBlur={() => {
        if (draft !== null && draft.trim() === "") onValue(0);
        setDraft(null);
      }}
      {...rest}
    />
  );
}
