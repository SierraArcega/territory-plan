"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import type { ActionLogEntry } from "../lib/action-log";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** Read-only feed of the rep's confirmed copilot writes (the audit log). */
export function CopilotActivityLog() {
  const [entries, setEntries] = useState<ActionLogEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/copilot/actions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data: { entries: ActionLogEntry[] }) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="px-4 py-4 text-sm text-[#6E6390]">Couldn’t load your activity log.</p>;
  }
  if (entries === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-sm text-[#6E6390]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-[#6E6390]">
        No copilot actions yet. Confirmed creates and edits show up here.
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-4 py-4">
      {entries.map((e) => (
        <li
          key={e.id}
          className="panel-content-enter flex items-start gap-2 rounded-lg border border-[#E2DEEC] bg-white p-3 shadow-sm"
        >
          <span
            className={`mt-0.5 shrink-0 ${e.status === "success" ? "text-[#69B34A]" : "text-[#F37167]"}`}
            aria-label={e.status === "success" ? "Succeeded" : "Failed"}
          >
            {e.status === "success" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#403770] break-words">{e.label}</p>
            <p className="text-xs text-[#8A80A8] whitespace-nowrap">{formatWhen(e.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
