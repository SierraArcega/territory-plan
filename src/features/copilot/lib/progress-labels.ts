import type { TurnEvent } from "@/features/reports/lib/agent/types";

/** Friendly phrase per known tool. Unknown tools fall back to "Working…" —
 *  internal tool names must never reach the rep. */
const TOOL_LABELS: Record<string, string> = {
  run_sql: "Searching your data…",
  sample_rows: "Looking through records…",
  get_schema: "Checking your data…",
  propose_actions: "Drafting…",
};

export function friendlyProgressLabel(events: TurnEvent[] | undefined): string {
  if (!events || events.length === 0) return "Thinking…";
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "model_call" && e.toolUses.length > 0) {
      const name = e.toolUses[e.toolUses.length - 1]!.name;
      return TOOL_LABELS[name] ?? "Working…";
    }
  }
  return "Thinking…";
}
