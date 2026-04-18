"use client";

import { useState, type KeyboardEvent } from "react";

interface Props {
  placeholder?: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

export default function ChatInput({
  placeholder = "Ask a follow-up…",
  disabled,
  onSend,
}: Props) {
  const [value, setValue] = useState("");

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 border-t border-[#E2DEEC] p-4 w-full">
      <div className="flex w-[calc(100%-8px)] items-center justify-between gap-2 rounded-xl border border-[#C2BBD4] bg-white px-3.5 py-2.5">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[13px] font-normal text-[#544A78] outline-none placeholder:text-[#A69DC0] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-plum px-2.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#322a5a] transition-colors disabled:opacity-50"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
      <p className="text-[10px] font-normal text-[#A69DC0]">
        Shift + Enter for a new line
      </p>
    </div>
  );
}
