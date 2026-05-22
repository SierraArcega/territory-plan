"use client";

/**
 * AiPromptBlock — promoted-primary entrypoint to the list-builder.
 *
 * Layout:
 *   ┌─ ✨ Describe what you want — AI handles complex logic ─┐
 *   │ [ prompt text input         ] [ Build • plum ]           │
 *   │ chip · chip · chip · chip                                │
 *   │ optional amber notice / red error                        │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Wires up to `streamAiListBuilder()` from the SSE client. Each event:
 *   - trace      → updates the 3-dot indicator cycle.
 *   - ok         → calls `onSuccess({listSpec, name})` so the parent can
 *                  flatten the tree + populate fields.
 *   - clarifying → renders text inside the prompt block (not an error).
 *   - error      → red notice; chips remain clickable.
 *
 * Parent passes `externalNotice` to surface amber warnings (e.g. "Some
 * advanced logic was simplified") produced by the flatten step it ran on the
 * AI's tree.
 */
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { ListSpec } from "@/lib/saved-views/filter-tree";
import {
  streamAiListBuilder,
  type AiListBuilderEvent,
} from "../../lib/ai-list-builder/client";

interface AiPromptBlockProps {
  /** Initial value for the prompt field (e.g. when reopening from a seed). */
  initialPrompt?: string;
  /** Called when the model emits a list spec — parent flattens + populates. */
  onSuccess: (payload: { listSpec: ListSpec; name: string }) => void;
  /** Amber warning text the parent wants to display under the prompt. */
  externalNotice?: string | null;
}

const SUGGESTED_CHIPS = [
  "News at Northeast Pod districts",
  "Vacancies in Iowa districts",
  "Open RFPs > $100K closing this quarter",
  "Champions I haven't talked to in 30d",
] as const;

export default function AiPromptBlock({
  initialPrompt = "",
  onSuccess,
  externalNotice = null,
}: AiPromptBlockProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifying, setClarifying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Cycle the dot-progress indicator while busy.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setProgress((p) => (p + 1) % 3), 320);
    return () => clearInterval(id);
  }, [busy]);

  // Abort any in-flight stream on unmount (per CLAUDE.md cleanup rule).
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const runBuild = async (rawPrompt: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setClarifying(null);
    setProgress(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      for await (const ev of streamAiListBuilder({
        prompt: trimmed,
        signal: ctrl.signal,
      })) {
        const stop = handleEvent(ev);
        if (stop) break;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // user-cancelled — silent
      } else {
        setError("Couldn't generate — try rephrasing");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  /** Returns true when the loop should stop iterating. */
  const handleEvent = (ev: AiListBuilderEvent): boolean => {
    switch (ev.kind) {
      case "trace":
        // Dot progress is advanced on the interval; nothing to do per-event.
        return false;
      case "ok":
        onSuccess({ listSpec: ev.listSpec, name: ev.name });
        return true;
      case "clarifying":
        setClarifying(ev.text);
        return true;
      case "error":
        setError("Couldn't generate — try rephrasing");
        return true;
      default: {
        // exhaustiveness guard
        const _exhaustive: never = ev;
        void _exhaustive;
        return true;
      }
    }
  };

  const onPromptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void runBuild(prompt);
    }
  };

  const isBuildDisabled = busy || prompt.trim().length === 0;

  return (
    <div
      data-testid="ai-prompt-block"
      className="rounded-xl p-3.5 border border-[#F0D9D6]"
      style={{
        background:
          "linear-gradient(135deg, #FEF2F1 0%, #F7F0FA 100%)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-[#F37167]" aria-hidden />
        <span className="text-xs font-bold text-[#403770] whitespace-nowrap">
          Describe what you want
        </span>
        <span className="ml-auto text-[10px] text-[#8A80A8] whitespace-nowrap">
          AI handles complex logic
        </span>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          aria-label="AI prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onPromptKeyDown}
          disabled={busy}
          placeholder="e.g. Vacancies at NY districts posted in the last 14 days"
          className="flex-1 min-w-0 px-2.5 py-2 text-sm text-[#403770] bg-white border border-[#E0CFCC] rounded-md outline-none focus:border-[#F37167] placeholder:text-[#A69DC0] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void runBuild(prompt)}
          disabled={isBuildDisabled}
          className={[
            "px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-100 whitespace-nowrap",
            isBuildDisabled
              ? "bg-[#403770]/50 text-white cursor-not-allowed"
              : "bg-[#403770] text-white hover:bg-[#322a5a]",
          ].join(" ")}
          aria-busy={busy}
        >
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <span>Thinking</span>
              <span className="inline-flex gap-0.5" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={[
                      "inline-block w-1 h-1 rounded-full bg-white transition-opacity duration-150",
                      progress === i ? "opacity-100" : "opacity-40",
                    ].join(" ")}
                  />
                ))}
              </span>
            </span>
          ) : (
            "Build"
          )}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTED_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setPrompt(chip);
              void runBuild(chip);
            }}
            disabled={busy}
            className="px-2 py-0.5 text-[11px] bg-white border border-[#E2DEEC] rounded-full text-[#544A78] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100 disabled:opacity-50 whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {clarifying && (
        <div
          role="status"
          className="text-[11px] text-[#544A78] mt-2 px-2 py-1 bg-white border border-[#E2DEEC] rounded-md"
        >
          {clarifying}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="text-[11px] text-[#c25a52] mt-2 px-2 py-1 bg-[#fef1f0] border border-[#f58d85] rounded-md"
        >
          {error}
        </div>
      )}

      {externalNotice && (
        <div
          role="status"
          className="text-[11px] text-[#7d6d3a] mt-2 px-2 py-1 bg-[#fffaf1] border border-[#ffd98d] rounded-md"
        >
          {externalNotice}
        </div>
      )}
    </div>
  );
}
