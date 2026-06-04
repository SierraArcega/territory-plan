import { Prisma } from "@prisma/client";
import type { ActiveRep } from "@/lib/reps";

// Resolved subject of a dashboard request: one rep (the caller by default, or any
// selected rep) or the whole-team aggregate. In rep mode `emails` is the SQL
// filter set (a single email). Team mode carries no email set — it covers the
// WHOLE book (every non-null sales_rep_email / every plan owner), so its SQL
// filter is "no restriction" rather than an enumerated roster. Ranking and the
// "N reps" count stay scoped to the active role='rep' roster regardless of mode.
export type DashboardScope =
  | { mode: "rep"; rep: { id: string; email: string }; emails: string[] }
  | { mode: "team" };

// Maps `?rep=` to a scope. Absent → the caller (even if the caller is not in the
// rep roster, e.g. an admin viewing their own dashboard). "team" → the whole book
// (all emails). A non-caller id must be in the active roster; an unknown id → null
// (route returns 400).
export function resolveScope(
  repParam: string | null,
  reps: ActiveRep[],
  caller: { id: string; email: string },
): DashboardScope | null {
  if (repParam === "team") {
    return { mode: "team" };
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

// Appendable SQL email filter for a scope. Team = the whole book (every non-null
// value of the email column); rep = the subject's single email. `col` is the
// email column to filter, e.g. Prisma.sql`o.sales_rep_email` or Prisma.sql`u.email`.
export function emailFilterSql(scope: DashboardScope, col: Prisma.Sql): Prisma.Sql {
  return scope.mode === "team"
    ? Prisma.sql`AND ${col} IS NOT NULL`
    : Prisma.sql`AND ${col} = ANY(${scope.emails})`;
}

// JS-side predicate mirroring emailFilterSql: is this email part of the scope's
// subject set? Team covers every (non-null) email; rep is the single subject.
export function emailInScope(scope: DashboardScope, email: string | null): boolean {
  return scope.mode === "team" ? email != null : email != null && scope.emails.includes(email);
}
