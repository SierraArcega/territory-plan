const LMS_BASE = "https://lms.fullmindlearning.com/opportunities/kanban";

/** K-12 school year string like "2025-26"; rolls to the next year in July+. */
export function schoolYearFor(now: Date): string {
  const m = now.getMonth(); // 0=Jan
  const start = m >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/**
 * URL for creating/finding an opportunity in the external LMS. District scoping
 * awaits a confirmed LMS account param; until then we open the generic board for
 * the current school year. `accountLmsId` is accepted for the future enhancement.
 */
export function lmsOpportunityUrl(opts: { now?: Date; accountLmsId?: string | null } = {}): string {
  const now = opts.now ?? new Date();
  const params = new URLSearchParams({ school_year: schoolYearFor(now) });
  // Future: if LMS adds an account filter param, append it from opts.accountLmsId here.
  return `${LMS_BASE}?${params.toString()}`;
}
