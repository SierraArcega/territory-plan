"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TurnEvent } from "../../lib/agent/types";
import { TraceLine, type TraceLineState } from "./TraceLine";

/**
 * Compact inline arg extractor — used for Style B (Terminal) trace lines.
 * The brief is explicit: don't over-engineer this. We try a handful of
 * common shapes (string input, single-string-field object, a `query`/`table`
 * field, a SELECT prefix) and fall back to "…" so the line still renders
 * deterministically.
 */
function extractArg(toolName: string, rawInput: unknown): string {
  if (rawInput == null) return "…";
  if (typeof rawInput === "string") return quote(rawInput);

  if (typeof rawInput === "object") {
    const obj = rawInput as Record<string, unknown>;

    // Tool-specific best guesses for the most useful single arg to surface.
    const preferred: Record<string, string[]> = {
      search_metadata: ["query"],
      describe_table: ["table"],
      sample_rows: ["sql"],
      get_column_values: ["column", "table"],
      count_rows: ["from_sql"],
      run_sql: ["sql"],
      search_saved_reports: ["query"],
      get_saved_report: ["id"],
    };
    const keys = preferred[toolName] ?? [];
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return quote(truncate(v));
      if (typeof v === "number") return String(v);
    }

    // Generic fallback: first scalar string field, then any number.
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.trim()) return quote(truncate(v));
    }
    for (const v of Object.values(obj)) {
      if (typeof v === "number") return String(v);
    }
  }

  return "…";
}

function quote(s: string): string {
  return `"${s}"`;
}

function truncate(s: string, max = 28): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1) + "…";
}

/**
 * Fold a `TurnEvent[]` into trace lines. Each `model_call` opens one line per
 * `toolUse` it requested; the matching `tool_result` closes that line and
 * stamps it with elapsed ms. We don't have per-event timestamps from the
 * agent loop, so `ms` is approximated as `(finishedIndex - startedIndex)` slot
 * ticks — close enough for terminal-style display while keeping the agent
 * loop's contract minimal. (The real wall-clock duration is captured at the
 * route level for the `↳ N steps · X.Xs` total, not here.)
 *
 * Pending tool-uses (model_call requested them, but the tool_result hasn't
 * arrived yet) become the `active` line. Anything beyond the first pending
 * line is `queued`.
 */
interface Line {
  toolName: string;
  arg: string;
  state: TraceLineState;
  ms: number | undefined;
  /** Stable key — composite of tool-use id + index. */
  key: string;
}

const HIDDEN_TOOL_NAMES = new Set(["ghost_report_retry"]);

interface PendingByToolUseId {
  toolName: string;
  arg: string;
  modelCallIndex: number;
}

function eventsToLines(events: TurnEvent[], completed: boolean): Line[] {
  const lines: Line[] = [];
  const pending = new Map<string, PendingByToolUseId>();

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.kind === "model_call") {
      for (const t of e.toolUses) {
        if (HIDDEN_TOOL_NAMES.has(t.name)) continue;
        pending.set(t.id, {
          toolName: t.name,
          arg: extractArg(t.name, t.input),
          modelCallIndex: i,
        });
        lines.push({
          toolName: t.name,
          arg: extractArg(t.name, t.input),
          state: "queued",
          ms: undefined,
          key: t.id,
        });
      }
    } else {
      // tool_result
      if (HIDDEN_TOOL_NAMES.has(e.toolName)) continue;
      const start = pending.get(e.toolUseId);
      const lineIndex = lines.findIndex((l) => l.key === e.toolUseId);
      if (lineIndex !== -1) {
        const startedAt = start ? start.modelCallIndex : i;
        // Approx duration in event ticks — purely visual.
        const approxMs = Math.max(1, (i - startedAt) * 20);
        lines[lineIndex] = {
          ...lines[lineIndex]!,
          state: "done",
          ms: approxMs,
        };
        pending.delete(e.toolUseId);
      }
    }
  }

  // The first still-pending line is `active`. The rest stay `queued`.
  // When `completed`, even pending lines collapse to `done` so the toggled
  // collapsed view doesn't show a half-open trace if the loop ended without
  // closing the last tool_result (shouldn't happen in practice, but defensive).
  let activeAssigned = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.state === "queued") {
      if (completed) {
        lines[i] = { ...lines[i]!, state: "done" };
      } else if (!activeAssigned) {
        lines[i] = { ...lines[i]!, state: "active" };
        activeAssigned = true;
      }
    }
  }

  return lines;
}

interface Props {
  events: TurnEvent[];
  /** True when the turn has finished (terminal `result` event arrived). */
  completed: boolean;
  /** Total wall-clock for the turn, ms — used in the `N steps · X.Xs` toggle. */
  totalMs?: number;
  /** When set, header label includes "Working on v{n} · step X of N". */
  pendingVersionN?: number;
  /** When `completed`, render only the toggle by default; expand on click. */
  defaultExpanded?: boolean;
}

export function LiveTrace({
  events,
  completed,
  totalMs,
  pendingVersionN,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const lines = eventsToLines(events, completed);

  if (lines.length === 0 && completed) {
    // Nothing to render — the assistant card prelude shouldn't show a toggle.
    return null;
  }

  // Completed + collapsed: just the toggle.
  if (completed && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "none",
          padding: "2px 0",
          fontSize: 11.5,
          color: "#8A80A8",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <ChevronRight size={11} />{" "}
        <span style={{ whiteSpace: "nowrap" }}>
          {lines.length} {lines.length === 1 ? "step" : "steps"}
          {totalMs != null ? ` · ${(totalMs / 1000).toFixed(1)}s` : ""}
        </span>
      </button>
    );
  }

  // In-flight: header with pulsing coral dot + "Working on v{n} · step X of N"
  const activeIdx = lines.findIndex((l) => l.state === "active");
  const stepNumber = (activeIdx === -1 ? lines.length : activeIdx) + 1;

  return (
    <div style={{ marginTop: 6 }}>
      {completed ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
            background: "transparent",
            border: "none",
            padding: 0,
            fontSize: 11.5,
            color: "#8A80A8",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <ChevronDown size={11} />{" "}
          <span style={{ whiteSpace: "nowrap" }}>
            {lines.length} {lines.length === 1 ? "step" : "steps"}
            {totalMs != null ? ` · ${(totalMs / 1000).toFixed(1)}s` : ""}
          </span>
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            fontSize: 11,
            color: "#544A78",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#F37167",
              boxShadow: "0 0 0 3px rgba(243,113,103,0.2)",
              animation: "fm-pulse 1.4s ease-in-out infinite",
            }}
          />
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            {pendingVersionN != null ? `Working on v${pendingVersionN}` : "Working"}
            {lines.length > 0 ? ` · step ${stepNumber} of ${lines.length}` : ""}
          </span>
        </div>
      )}
      {lines.map((l) => (
        <TraceLine
          key={l.key}
          tool={l.toolName}
          arg={l.arg}
          state={l.state}
          ms={l.ms}
        />
      ))}
    </div>
  );
}
