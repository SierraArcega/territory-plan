"use client";

import { Send, Sparkles } from "lucide-react";
import { useState } from "react";

interface Props {
  inFlight: boolean;
  latestVersionN: number | null;
  onSubmit: (text: string) => void;
}

export function Composer({ inFlight, latestVersionN, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || inFlight) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="shrink-0 border-t border-[#E2DEEC] bg-[#FFFCFA] p-3">
      <div
        className="flex items-center gap-2 rounded-[10px] border border-[#C2BBD4] bg-white px-3 py-1.5 transition-opacity duration-150"
        style={{
          opacity: inFlight ? 0.55 : 1,
          boxShadow: "0 1px 2px rgba(64,55,112,0.04)",
        }}
      >
        <input
          value={value}
          disabled={inFlight}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            inFlight
              ? "Working…"
              : latestVersionN != null
                ? "Ask a follow-up — refines the latest version"
                : "Ask a question to get started"
          }
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#403770] outline-none placeholder:text-[#A69DC0]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={inFlight || !value.trim()}
          className="inline-flex items-center gap-1 rounded-md border-0 px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: inFlight || !value.trim() ? "#EFEDF5" : "#403770",
            color: inFlight || !value.trim() ? "#A69DC0" : "#fff",
            cursor: inFlight || !value.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          <Send size={12} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-[#A69DC0]">
        <Sparkles size={11} />
        <span>
          {inFlight ? (
            "Working… composer locked until response completes."
          ) : latestVersionN != null ? (
            <>
              Continues from{" "}
              <strong className="font-semibold text-[#544A78]">v{latestVersionN}</strong>. Click any
              version marker to view its result.
            </>
          ) : (
            "Claude writes the SQL for you — ask a question in plain English."
          )}
        </span>
      </div>
    </div>
  );
}
