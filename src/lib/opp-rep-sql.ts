import { Prisma } from "@prisma/client";

/**
 * SQL fragment that resolves an opportunity's sales rep to a `user_profiles.id`:
 * a valid `sales_rep_id` wins; otherwise fall back to matching `sales_rep_email`
 * (handles orphan/stale rep IDs).
 *
 * Assumes the `opportunities` row is aliased `o` in the surrounding query.
 * Used by both the owner sync and the collaborator sync.
 */
export const RESOLVE_OPP_REP = Prisma.sql`COALESCE(
  (SELECT u.id FROM user_profiles u WHERE u.id = o.sales_rep_id),
  (SELECT u2.id FROM user_profiles u2 WHERE lower(u2.email) = lower(o.sales_rep_email) LIMIT 1)
)`;

/** Numbered live sales-pipeline stages: "0 - Meeting Booked" .. "5 - Commitment". */
export const LIVE_STAGE_REGEX = "^[0-5] - ";
