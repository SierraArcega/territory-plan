import type { ActiveRep } from "@/lib/reps";

// Resolved subject of a dashboard request: one rep (the caller by default, or any
// selected rep) or the whole-team aggregate. `emails` is the SQL filter set —
// a single email in rep mode, every active rep's in team mode.
export type DashboardScope =
  | { mode: "rep"; rep: { id: string; email: string }; emails: string[] }
  | { mode: "team"; emails: string[] };

// Maps `?rep=` to a scope. Absent → the caller (even if the caller is not in the
// rep roster, e.g. an admin viewing their own dashboard). "team" → every rep,
// summed. A non-caller id must be in the active roster; an unknown id → null
// (route returns 400).
export function resolveScope(
  repParam: string | null,
  reps: ActiveRep[],
  caller: { id: string; email: string },
): DashboardScope | null {
  if (repParam === "team") {
    return { mode: "team", emails: reps.map((r) => r.email) };
  }
  const targetId = repParam ?? caller.id;
  if (targetId === caller.id) {
    const email = reps.find((r) => r.id === caller.id)?.email ?? caller.email;
    return { mode: "rep", rep: { id: caller.id, email }, emails: [email] };
  }
  const found = reps.find((r) => r.id === targetId);
  if (!found) return null;
  return { mode: "rep", rep: { id: found.id, email: found.email }, emails: [found.email] };
}
