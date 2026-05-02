"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";

interface Props {
  sql: string;
  source: string;
  onClose: () => void;
}

export function SqlPreviewModal({ sql, source, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore — older browsers without permission
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SQL for this query"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#403770]/30 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E2DEEC] p-5">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-[#8A80A8]">
              SQL
            </div>
            <h2 className="truncate text-base font-semibold text-[#403770]">{source}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-3 py-1.5 text-xs font-medium text-[#403770] transition-colors duration-100 hover:bg-[#F7F5FA]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-100 hover:bg-[#EFEDF5] hover:text-[#403770]"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[#F7F5FA] p-5">
          <pre className="whitespace-pre font-mono text-xs leading-relaxed text-[#322a5a]">
            {sql}
          </pre>
        </div>
      </div>
    </div>
  );
}
