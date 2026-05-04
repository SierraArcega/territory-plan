import type { VacancyFailureReason } from "@prisma/client";

export type FailureContext =
  | "no_job_board_url"
  | "scan_timeout"
  | "statewide_unattributable"
  | "enrollment_ratio_skip"
  | "claude_fallback_empty"
  | "thrown_error";

const CONTEXT_MAP: Partial<Record<FailureContext, VacancyFailureReason>> = {
  no_job_board_url: "no_job_board_url",
  scan_timeout: "scan_timeout",
  statewide_unattributable: "statewide_unattributable",
  enrollment_ratio_skip: "enrollment_ratio_skip",
  claude_fallback_empty: "claude_fallback_failed",
};

// Order matters: first match wins. More-specific patterns precede more-generic ones.
const PATTERNS: Array<{ regex: RegExp; reason: VacancyFailureReason }> = [
  { regex: /timed out|aborted|abort/i, reason: "scan_timeout" },
  { regex: /anthropic|claude api/i, reason: "claude_fallback_failed" },
  { regex: /statewide board returned/i, reason: "statewide_unattributable" },
  { regex: /regional aggregator/i, reason: "enrollment_ratio_skip" },
  { regex: /no job board url/i, reason: "no_job_board_url" },
  { regex: /4\d\d|not found|forbidden|gone/i, reason: "http_4xx" },
  { regex: /5\d\d|server error|bad gateway|service unavailable/i, reason: "http_5xx" },
  { regex: /econnrefused|enotfound|network|fetch failed|getaddrinfo/i, reason: "network_timeout" },
];

export function categorizeFailure(args: {
  errorMessage: string;
  context?: FailureContext;
}): VacancyFailureReason {
  const ctx = args.context ?? "thrown_error";
  const direct = CONTEXT_MAP[ctx];
  if (direct) return direct;

  // Fall through to regex matching for thrown_error context
  for (const { regex, reason } of PATTERNS) {
    if (regex.test(args.errorMessage)) return reason;
  }
  return "unknown_error";
}
