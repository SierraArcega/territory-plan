// Acceptance SLA: a New lead must be accepted within 2 business days of
// assignment. Direct port of slaState() from the design handoff
// (Docs/design_handoff_leads/design_files/leadsData.js), with `now` injectable
// so the math is deterministic in tests.

export type SlaUrgency = "ok" | "due-soon" | "overdue";

export interface SlaState {
  /** Signed ms until (positive) or since (negative) the due time. */
  ms: number;
  overdue: boolean;
  /** e.g. "1d 4h left", "5h overdue", "32m left". */
  label: string;
  urgency: SlaUrgency;
  dueAt: Date;
}

export const SLA_BUSINESS_DAYS = 2;
const DUE_SOON_MS = 6 * 3.6e6; // < 6h left → due-soon

/** Add N business days (Mon–Fri) to a date; weekends are skipped. */
export function addBizDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/**
 * Compute the SLA state for a lead assigned at `assignedAtISO`, relative to
 * `now`. Returns null when there's no assignment timestamp.
 */
export function slaState(
  assignedAtISO: string | null | undefined,
  now: Date = new Date(),
): SlaState | null {
  if (!assignedAtISO) return null;
  const due = addBizDays(new Date(assignedAtISO), SLA_BUSINESS_DAYS);
  const ms = due.getTime() - now.getTime();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3.6e6);
  const dys = Math.floor(h / 24);
  const rem = h % 24;
  const mins = Math.floor(abs / 6e4);
  const txt = dys > 0 ? `${dys}d ${rem}h` : h > 0 ? `${h}h` : `${mins}m`;
  let urgency: SlaUrgency = "ok";
  if (overdue) urgency = "overdue";
  else if (ms < DUE_SOON_MS) urgency = "due-soon";
  return {
    ms,
    overdue,
    label: overdue ? `${txt} overdue` : `${txt} left`,
    urgency,
    dueAt: due,
  };
}
