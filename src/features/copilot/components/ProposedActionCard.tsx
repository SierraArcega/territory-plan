"use client";

import { Check, Ban, AlertTriangle, Loader2 } from "lucide-react";
import type { ProposedAction } from "../lib/types";

export type ActionStatus = "idle" | "pending" | "confirmed" | "dismissed" | "error";

export function ProposedActionCard({
  action,
  status,
  error,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  status: ActionStatus;
  error?: string;
  onConfirm: (a: ProposedAction) => void;
  onDismiss: (id: string) => void;
}) {
  if (status === "confirmed") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#1F7A3F]">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {action.preview.title} — done.
      </p>
    );
  }
  if (status === "dismissed") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[#6E6390]">
        <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Dismissed.
      </p>
    );
  }

  const destructive = action.preview.destructive;
  const confirmClasses = destructive
    ? "bg-[#F37167] hover:bg-[#E0605A]"
    : "bg-[#403770] hover:bg-[#322a5a]";

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2DEEC] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#F0EDF6] bg-[#FBFAFD] px-3 py-2">
        <span className="rounded-md bg-[#EFEDF5] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#403770] whitespace-nowrap">
          {action.preview.title}
        </span>
      </div>
      <p className="px-3 pt-2.5 text-sm font-semibold text-[#403770]">{action.preview.summary}</p>
      {action.preview.rows.length > 0 && (
        <dl className="px-3 pb-2 pt-1 space-y-1">
          {action.preview.rows.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-[#8A80A8] whitespace-nowrap">{r.label}</dt>
              <dd className="m-0 whitespace-pre-wrap break-words text-[#403770]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {status === "error" && (
        <p className="flex items-center gap-1 px-3 pb-2 text-xs text-[#A8281C]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error ?? "Something went wrong."}
        </p>
      )}
      <div className="flex gap-2 border-t border-[#F0EDF6] px-3 py-2.5">
        <button
          type="button"
          onClick={() => onConfirm(action)}
          disabled={status === "pending"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${confirmClasses}`}
        >
          {status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : destructive ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => onDismiss(action.id)}
          disabled={status === "pending"}
          className="flex-1 rounded-lg border border-[#E2DEEC] px-3 py-2 text-xs font-semibold text-[#6E6390] transition-colors hover:bg-[#F7F5FA] disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
