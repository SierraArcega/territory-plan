"use client";

import { useEffect, useState } from "react";

interface TextFilterProps {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onClose: () => void;
}

// Per-column text filter — single input, applies on Enter / blur.
export default function TextFilter({ value, placeholder, onChange, onClose }: TextFilterProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft.trim() !== value) onChange(draft.trim());
    onClose();
  }

  return (
    <div className="p-2 w-64">
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onClose();
        }}
        placeholder={placeholder ?? "Contains…"}
        className="w-full px-2.5 py-1.5 text-xs text-[#403770] placeholder:text-[#A69DC0] bg-white border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#F37167]"
      />
      <div className="flex items-center justify-end mt-2 gap-1">
        {value && (
          <button
            type="button"
            onClick={() => { setDraft(""); onChange(""); onClose(); }}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#F37167]"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={commit}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white bg-[#403770] rounded-md hover:bg-[#322a5a]"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
