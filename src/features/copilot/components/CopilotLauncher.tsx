"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

export const COACHMARK_KEY = "copilot:coachmark-dismissed";

export function CopilotLauncher({ onOpen }: { onOpen: () => void }) {
  const [showCoach, setShowCoach] = useState(() => {
    try { return !localStorage.getItem(COACHMARK_KEY); }
    catch { return false; }
  });

  function dismissCoach() {
    setShowCoach(false);
    try { localStorage.setItem(COACHMARK_KEY, "1"); } catch { /* ignore */ }
  }

  return (
    <>
      {showCoach && (
        <div className="fixed bottom-20 right-5 z-[51] max-w-[200px] rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-lg">
          <button
            type="button"
            onClick={dismissCoach}
            aria-label="Dismiss tip"
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-[#A89FC4] hover:text-[#403770]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <p className="pr-3 text-xs text-[#403770]">
            Ask me what&apos;s slipping, or to log a call — <b>I&apos;m right here.</b>
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open Copilot"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#403770] px-4 py-3 text-white shadow-lg transition-colors hover:bg-[#322a5a]"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium whitespace-nowrap">Copilot</span>
      </button>
    </>
  );
}
