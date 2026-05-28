"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { ProposedAction } from "../lib/types";
import type { ActionStatus } from "./ProposedActionCard";

/** Naive pluralizer, good enough for our object nouns (activity→activities). */
function pluralize(noun: string, n: number): string {
  if (n === 1) return noun;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Card title from the group's shared action, e.g. "Log 3 activities". */
function pluralTitle(action: ProposedAction, n: number): string {
  // preview.title is like "Log activity" / "Create contact".
  const [verb, ...rest] = action.preview.title.split(" ");
  const noun = rest.join(" ") || "items";
  return `${verb} ${n} ${pluralize(noun, n)}`;
}

export function BatchActionCard({
  actions,
  statusById,
  onConfirmMany,
  onDismissAll,
}: {
  actions: ProposedAction[];
  statusById: Record<string, ActionStatus>;
  onConfirmMany: (selected: ProposedAction[]) => void;
  onDismissAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => actions.filter((a) => !excluded.has(a.id)),
    [actions, excluded],
  );
  const anyPending = actions.some((a) => statusById[a.id] === "pending");
  const allSettled = actions.every(
    (a) => statusById[a.id] === "confirmed" || statusById[a.id] === "dismissed",
  );
  const destructive = actions[0]?.preview.destructive ?? false;
  const confirmClasses = destructive
    ? "bg-[#F37167] hover:bg-[#E0605A]"
    : "bg-[#403770] hover:bg-[#322a5a]";

  if (allSettled) {
    const done = actions.filter((a) => statusById[a.id] === "confirmed").length;
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#1F7A3F]">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {done} of {actions.length} done.
      </p>
    );
  }

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2DEEC] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#F0EDF6] bg-[#FBFAFD] px-3 py-2">
        <span className="rounded-md bg-[#EFEDF5] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#403770] whitespace-nowrap">
          {pluralTitle(actions[0]!, actions.length)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Review"
          className="ml-auto flex items-center gap-1 text-xs font-medium text-[#6E6390] hover:text-[#403770]"
        >
          Review
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <ul className="divide-y divide-[#F0EDF6] px-3 py-1">
          {actions.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 text-xs text-[#403770]">
              <input
                type="checkbox"
                aria-label={a.preview.summary}
                checked={!excluded.has(a.id)}
                onChange={() => toggle(a.id)}
                className="accent-[#403770]"
              />
              <span className="truncate">{a.preview.summary}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-[#F0EDF6] px-3 py-2.5">
        <button
          type="button"
          disabled={anyPending || selected.length === 0}
          onClick={() => onConfirmMany(selected)}
          aria-label={`Confirm ${selected.length}`}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${confirmClasses}`}
        >
          {anyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          Confirm {selected.length}
        </button>
        <button
          type="button"
          disabled={anyPending}
          onClick={onDismissAll}
          className="flex-1 rounded-lg border border-[#E2DEEC] px-3 py-2 text-xs font-semibold text-[#6E6390] transition-colors hover:bg-[#F7F5FA] disabled:opacity-50"
        >
          Dismiss all
        </button>
      </div>
    </div>
  );
}
