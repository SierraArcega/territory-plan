"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import type { CopilotNudge } from "../lib/nudge-types";
import type { RecentConversation } from "../lib/recent-conversations";

/** Static starter prompts. `send: false` ones populate the composer for editing. */
const SUGGESTED_PROMPTS: Array<{ label: string; prompt: string; send: boolean }> = [
  { label: "My plan summary", prompt: "Give me a summary of my territory plan.", send: true },
  { label: "What's gone stale?", prompt: "Which of my plans or deals need attention?", send: true },
  { label: "Log a call", prompt: "Log a call with ", send: false },
  { label: "Find high-fit districts", prompt: "Find high-fit districts I'm not working yet.", send: true },
];

function greetingPrefix(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface Props {
  firstName: string | null;
  nudges: CopilotNudge[];
  recent: RecentConversation[];
  /** Seed a prompt into the composer; autoSend=true sends immediately. */
  onSeed: (prompt: string, autoSend: boolean) => void;
  onResume: (conversationId: string) => void;
}

export function CopilotHomeState({ firstName, nudges, recent, onSeed, onResume }: Props) {
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="text-lg font-semibold text-[#403770]">
        {greetingPrefix()}{firstName ? `, ${firstName}` : ""}
        <span className="mt-1 block text-sm font-normal text-[#6E6390]">
          Here&apos;s what&apos;s worth a look — or just ask.
        </span>
      </div>

      {nudges.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">
            Worth your attention
          </p>
          <div className="flex flex-col gap-1.5">
            {nudges.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSeed(n.seedPrompt, true)}
                className="flex items-start gap-2.5 rounded-[10px] border border-[#E2DEEC] bg-[#FBFAFD] px-3 py-2.5 text-left transition-colors hover:border-[#403770] hover:bg-[#F7F5FA]"
              >
                <span className={`mt-0.5 shrink-0 ${n.severity === "risk" ? "text-[#F37167]" : "text-[#403770]"}`}>
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-[#403770]">{n.headline}</span>
                  <span className="block text-xs text-[#6E6390]">{n.reason}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">Jump in</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSeed(s.prompt, s.send)}
              className="rounded-2xl bg-[#EFEDF5] px-3 py-1.5 text-xs text-[#403770] transition-colors hover:bg-[#403770] hover:text-white whitespace-nowrap"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">Recent</p>
          <div className="flex flex-col">
            {recent.map((c) => (
              <button
                key={c.conversationId}
                type="button"
                onClick={() => onResume(c.conversationId)}
                className="flex items-center gap-2 border-t border-[#F0EDF6] py-2 text-left text-[13px] text-[#6E6390] transition-colors hover:text-[#403770]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#A89FC4]" aria-hidden="true" />
                <span className="truncate">{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
